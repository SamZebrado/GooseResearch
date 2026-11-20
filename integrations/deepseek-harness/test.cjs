// SPDX-License-Identifier: GPL-3.0-only
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

function mount(initial) {
  const states = [];
  const record = new Map(initial ? [['goose-research-dsh-v1', JSON.stringify(initial)]] : []);
  const fakeReact = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(init) {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof init === 'function' ? init() : init;
      return [states[i], (v) => { states[i] = v; }];
    },
    useRef() { return { current: selection }; },
    Fragment: Symbol('Fragment'),
  };
  let cursor, plugin, view, slot, lastBlob, lastFile, sends = 0;
  const selection = { selectionStart: 0, selectionEnd: 6 };
  const localStorage = { getItem: (k) => record.get(k) ?? null, setItem: (k, v) => record.set(k, v) };
  const ctx = {
    window: {
      __ModuleLoader__: { load({ id, factory }) {
        assert.equal(id, 'dsh-goose-research');
        plugin = factory(p => { assert.equal(p, 'react'); return fakeReact; });
      } },
      confirm: () => true,
      setTimeout: (f) => f(),
    },
    crypto: webcrypto, Date, Blob, localStorage,
    fetch() { sends++; throw Error('unexpected network'); },
    document: { createElement: () => ({ click() { lastFile = this.download; }, remove() {} }), body: { appendChild() {} } },
    URL: { createObjectURL: (b) => { lastBlob = b; return 'blob:test'; }, revokeObjectURL() {} },
  };
  vm.runInNewContext(read('client.js'), ctx, { filename: 'client.js' });
  plugin.apply({ slots: {
    inject: (name, fn) => { assert.equal(name, 'conversation.view'); fn(); },
    register: (opts, render) => { slot = opts; view = render(); },
  } });
  function tree() { cursor = 0; return view.type(); }
  function nodes(predicate, x = tree()) {
    if (Array.isArray(x)) return x.flatMap(y => nodes(predicate, y));
    if (!x || typeof x !== 'object') return [];
    return [...(predicate(x) ? [x] : []), ...nodes(predicate, x.children)];
  }
  function click(name) {
    const elem = nodes(x => x.type === 'button' && x.children[0] === name)[0];
    assert.ok(elem && !elem.props.disabled, name);
    elem.props.onClick();
  }
  function fill(name, value) {
    const elem = nodes(x => x.type === 'label' && x.children[0] === name)[0];
    assert.ok(elem, name);
    elem.children[1].props.onChange({ target: { value } });
  }
  return { plugin, slot, click, fill, nodes, tree, selection, saved: () => JSON.parse(record.values().next().value),
    download: async () => [lastFile, await lastBlob.text()], networkCalls: () => sends,
  };
}

test('manifest, host and conversation view match the package identity', async () => {
  const p = JSON.parse(read('package.json'));
  const { inject } = mount().plugin;
  assert.deepEqual([...inject], ['slots']);
  assert.equal(mount().slot.id, p.name);
  assert.equal(p.dsh.client.platform, 'web');
  for (const file of Object.values(p.exports)) assert.ok(read(file).length);
  assert.equal(p.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(read('cordis.patch.yml').trim(), '- insert:\n    - id: ' + p.name + '\n      name: ' + p.name);
  const host = await import('data:text/javascript,' + encodeURIComponent(read('index.js')));
  assert.equal(host.name, p.name);
  assert.equal(host.apply({}), undefined);
});

const draft = '当前稿（可直接粘贴）';
const input = '粘贴 AI 回复 JSON（先校验，再应用）';
const note = '写意见';
test('revision supports two anchored comments, export, safe review, compare, follow-up and reload', async () => {
  const m = mount();
  m.click('弹幕记录');
  m.fill('写一条（Ctrl / Cmd + Enter 保存）', 'DIARY-ONLY-SYNTHETIC');
  m.click('保存记录');
  m.click('大鹅改稿');
  m.click('载入虚构示例');
  m.click('引用选中文本'); m.fill(note, '补充记录口径'); m.click('添加意见');
  m.selection.selectionStart = 10; m.selection.selectionEnd = 22;
  m.click('引用选中文本'); m.fill(note, '语气收紧'); m.click('添加意见');
  m.click('导出当前稿和意见');
  const [file, body] = await m.download();
  const req = JSON.parse(body);
  assert.ok(file.endsWith(req.batchId + '.json'));
  assert.equal(req.comments.length, 2);
  assert.ok(!Object.hasOwn(req, 'diary'));
  assert.ok(!body.includes('DIARY-ONLY-SYNTHETIC'));
  const r = { ...req.responseShape, revisedText: 'A revised greenhouse draft.', replies: req.comments.map(c => ({ id: c.id, text: '已修改。' })) };
  for (const invalid of [
    { ...r, batchId: 'wrong-batch' },
    { ...r, replies: [] },
    { ...r, replies: [r.replies[0], r.replies[0]] },
    { ...r, replies: [r.replies[0], { id: 'unknown', text: '??' }] },
    { ...r, revisedText: '' },
  ]) {
    m.fill(input, JSON.stringify(invalid)); m.click('校验回复');
    assert.equal(m.nodes(x => x.type === 'button' && x.children[0] === '应用新稿和逐条回复').length, 0);
    assert.equal(m.saved().after, req.draft);
  }
  m.fill(input, JSON.stringify(r)); m.click('校验回复');
  assert.equal(m.saved().after, req.draft);
  m.click('应用新稿和逐条回复');
  assert.equal(m.saved().before, req.draft);
  assert.equal(m.saved().after, r.revisedText);
  assert.equal(m.saved().comments[0].thread[0].by, 'AI');
  m.click('继续追问'); m.fill('追问', '还有个细节'); m.click('保存追问');
  const restored = mount(m.saved());
  restored.click('导出当前稿和意见');
  const [, next] = await restored.download();
  assert.equal(JSON.parse(next).comments[0].thread[1].text, '还有个细节');
  restored.fill(draft, 'new edit');
  restored.fill(input, JSON.stringify(r)); restored.click('校验回复');
  assert.equal(restored.nodes(x => x.type === 'button' && x.children[0] === '应用新稿和逐条回复').length, 0);
  assert.equal(m.networkCalls(), 0);
});

test('diary supports keyboard save, local date, Markdown export and separate storage', async () => {
  const m = mount();
  m.click('弹幕记录');
  const label = '写一条（Ctrl / Cmd + Enter 保存）';
  m.fill(label, '<b>虚构记录</b>');
  const field = m.nodes(x => x.type === 'label' && x.children[0] === label)[0].children[1];
  let prevented = false;
  field.props.onKeyDown({ key: 'Enter', ctrlKey: true, nativeEvent: { isComposing: true }, preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
  field.props.onKeyDown({ key: 'Enter', ctrlKey: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(m.saved().diary.length, 1);
  assert.equal(m.saved().comments.length, 0);
  const chosenDay = m.nodes(x => x.type === 'input' && x.props.type === 'date')[0].props.value;
  m.click('导出当天 Markdown');
  const [file, body] = await m.download();
  assert.equal(file, 'goose-pause-' + chosenDay + '.md');
  assert.ok(body.endsWith('；<b>虚构记录</b>'));
  assert.equal(m.nodes(x => Object.hasOwn(x.props, 'dangerouslySetInnerHTML')).length, 0);
  assert.equal(m.networkCalls(), 0);
});
