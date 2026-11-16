const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function element(tag, bounds = {}) {
  const classes = new Set(), attrs = new Map(), listeners = new Map();
  return {
    tagName: tag,
    bounds, children: [], isConnected: true,
    classList: {
      add(...keys) { keys.forEach(k => classes.add(k)); },
      remove(...keys) { keys.forEach(k => classes.delete(k)); },
      contains(k) { return classes.has(k); },
      toggle(k, flag) { flag ? classes.add(k) : classes.delete(k); }
    },
    style: { removeProperty(k) { delete this[k]; } },
    setAttribute(k, v) { attrs.set(k, v); },
    getAttribute(k) { return attrs.get(k); },
    hasAttribute(k) { return attrs.has(k); },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(k, f) { listeners.set(k, f); },
    fire(k, opts = {}) { listeners.get(k)?.({ ...opts, preventDefault() { this.prevented = true; } }); },
    focus() { this.focused = true; },
    remove() { this.removed = true; },
    setPointerCapture(id) { this.captured = id; },
    getBoundingClientRect() {
      const left = parseInt(this.style.left) || this.bounds.left || 0;
      const top = parseInt(this.style.top) || this.bounds.top || 0;
      const width = this.bounds.width || 0, height = this.bounds.height || 0;
      return { left, top, width, height, right: left + width, bottom: top + height };
    }
  };
}

const win = element('WINDOW'), queue = [];
let token = 0;
Object.assign(win, {
  AbortController, innerWidth: 650, innerHeight: 400,
  requestAnimationFrame(fn) { queue.push(fn); return ++token; },
  cancelAnimationFrame() {}
});
function flush() {
  let loop = 0;
  while (queue.length) {
    assert(++loop < 10, 'painting settles');
    queue.shift()();
  }
}
const doc = element('DOCUMENT');
Object.assign(doc, {
  defaultView: win, documentElement: { clientWidth: 650, clientHeight: 400 }, body: element('BODY'),
  getElementById() { return null; },
  createElementNS(ns, tag) { return element(tag); }
});
const root = element('MAIN');
const host = element('ARTICLE');
Object.assign(root, { ownerDocument: doc, querySelectorAll: () => [host], matches: () => false });
const source = element('SPAN', { left: 120, top: 60, width: 60, height: 20 });
const panel = element('ASIDE', { width: 200, height: 100 });
const button = element('BUTTON', { width: 30, height: 30 });
for (const x of [source, panel, button]) x.closest = () => host;
Object.assign(host, {
  contains: (x) => [source, panel, button].includes(x),
  querySelectorAll: (s) => ({ '[data-goose-comment-quote]': [source], '[data-goose-comment-panel]': [panel], '[data-goose-comment-button]': [button] }[s] || [])
});
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'comment-bubbles.js'), 'utf8'), { window: win });
const api = win.GooseCommentBubbles.create({ root });
flush();
assert.equal(panel.hidden, true);
assert.equal(button.style.left, '185px');
assert.equal(button.getAttribute('aria-expanded'), 'false');
button.fire('click', { detail: 1 });
flush();
assert.equal(panel.hidden, false);
assert(source.classList.contains('goose-comment-target'));
button.fire('click', { detail: 1 });
flush();
assert.equal(panel.hidden, true);
assert(button.focused);
const pointer = { isPrimary: true, button: 0, pointerId: 1, clientX: 191, clientY: 65 };
button.fire('pointerdown', pointer);
assert.equal(button.captured, 1);
button.fire('pointermove', { ...pointer, clientX: 300 });
flush();
assert.equal(button.style.left, '294px');
assert.equal(doc.body.children[0].children.length, 1);
assert(source.classList.contains('goose-comment-target'));
button.fire('pointerup', pointer);
button.fire('click', { detail: 1 });
flush();
assert(panel.hidden);
assert(!source.classList.contains('goose-comment-target'));
assert.equal(doc.body.children[0].children.length, 1);
button.fire('keydown', { key: 'ArrowDown' });
flush();
assert.equal(button.style.top, '72px');
button.fire('keydown', { key: 'Home' });
flush();
assert.equal(button.style.top, '60px');
assert.equal(button.style.left, '185px');
assert.equal(doc.body.children[0].children.length, 0);
button.fire('click', { detail: 0 });
flush();
doc.fire('keydown', { key: 'Escape' });
flush();
assert(panel.hidden);
assert.equal(button.getAttribute('aria-controls'), panel.id);
doc.documentElement.clientWidth = 178;
win.fire('resize');
flush();
assert(parseInt(button.style.left) + 30 + 8 <= 178);
source.bounds.width = 0;
win.fire('scroll');
flush();
assert(button.classList.contains('goose-comment-outside'));
assert(!source.classList.contains('goose-comment-target'));
api.destroy();
assert(doc.body.children[0].removed);
assert(!button.classList.contains('goose-comment-launcher'));
console.log('PASS: toggle, pointer drag, click suppression, connector, arrow controls, Home, Escape, clamping, hidden source, teardown');
