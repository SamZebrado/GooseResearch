/* Standalone, client-only launcher for comments attached to an authored quote. */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const leftTop = (rect) => ({ x: rect.left, y: rect.top });
  const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  let nextPanel = 0;
  function clamp(point, size, viewport, margin = 8) {
    return {
      x: Math.max(margin, Math.min(viewport.width - margin - size.width, point.x)),
      y: Math.max(margin, Math.min(viewport.height - margin - size.height, point.y))
    };
  }
  function boxPosition(node, point) {
    node.style.left = point.x + 'px';
    node.style.top = point.y + 'px';
  }
  function makePath(from, to) {
    const x = from.right <= to.left ? from.right : to.right < from.left ? from.left : (from.left + from.right) / 2;
    const y = from.bottom <= to.top ? from.bottom : to.bottom < from.top ? from.top : (from.top + from.bottom) / 2;
    const tx = Math.max(to.left, Math.min(to.right, x)), ty = Math.max(to.top, Math.min(to.bottom, y));
    const cx = (x + tx) / 2;
    return `M ${x} ${y} C ${cx} ${y} ${cx} ${ty} ${tx} ${ty}`;
  }
  function create({ root }) {
    if (!root?.querySelectorAll) throw TypeError('A comment root is required.');
    const doc = root.ownerDocument, win = doc.defaultView, records = new Map();
    const overlay = doc.createElementNS(NS, 'svg');
    overlay.setAttribute('class', 'goose-comment-connectors');
    overlay.setAttribute('aria-hidden', 'true');
    doc.body.append(overlay);
    let active = null, frame = 0, destroyed = false;
    const viewport = () => ({ width: doc.documentElement.clientWidth || win.innerWidth, height: doc.documentElement.clientHeight || win.innerHeight });
    const visible = (r, size) => r.width > 0 && r.height > 0 && r.right > 0 && r.left < size.width && r.bottom > 0 && r.top < size.height;
    function line(from, to) {
      const path = doc.createElementNS(NS, 'path');
      path.setAttribute('d', makePath(from, to));
      overlay.append(path);
    }
    function paint() {
      frame = 0;
      overlay.replaceChildren();
      const view = viewport();
      for (const record of records.values()) {
        const { source, button, panel, offset } = record;
        const r = source.getBoundingClientRect(), inView = visible(r, view);
        // Do not leave a hidden section's launcher floating over a different view.
        if ((!r.width || !r.height) && active === record) close(record, false);
        button.classList.toggle('goose-comment-outside', !inView && active !== record);
        if (!inView && active !== record) {
          source.classList.remove('goose-comment-target');
          continue;
        }
        const b = button.getBoundingClientRect();
        const x = r.right + 5 + b.width <= view.width - 8 ? r.right + 5 : r.left - b.width - 5;
        const home = inView ? clamp({ x, y: r.top }, b, view) : record.home || { x: view.width - 48, y: 8 };
        record.home = home;
        const position = clamp({ x: home.x + (offset?.x || 0), y: home.y + (offset?.y || 0) }, b, view);
        boxPosition(button, position);
        const moved = !!offset && (Math.abs(position.x - home.x) > 1 || Math.abs(position.y - home.y) > 1);
        source.classList.toggle('goose-comment-target', inView && (active === record || !!record.drag?.moved));
        const marker = button.getBoundingClientRect();
        if (moved && inView) line(r, marker);
        if (active === record) {
          const p = panel.getBoundingClientRect();
          const right = marker.right + 8, left = marker.left - p.width - 8;
          const onSide = right + p.width <= view.width - 8 || left >= 8;
          boxPosition(panel, clamp({ x: right + p.width <= view.width - 8 ? right : left >= 8 ? left : marker.left, y: onSide ? marker.top : marker.bottom + 6 }, p, view));
        }
      }
    }
    function schedule() {
      if (!frame && !destroyed) frame = win.requestAnimationFrame(paint);
    }
    function close(record, restore = true) {
      record.panel.hidden = true;
      record.button.setAttribute('aria-expanded', 'false');
      if (active === record) active = null;
      if (restore && record.button.isConnected) record.button.focus({ preventScroll: true });
      schedule();
    }
    function toggle(record) {
      if (active === record) return close(record);
      if (active) close(active, false);
      active = record;
      record.panel.hidden = false;
      record.button.setAttribute('aria-expanded', 'true');
      schedule();
    }
    function register(host) {
      const owned = (selector) => [...host.querySelectorAll(selector)].find((el) => el.closest('[data-goose-comment]') === host);
      const button = owned('[data-goose-comment-button]'), source = owned('[data-goose-comment-quote]'), panel = owned('[data-goose-comment-panel]');
      if (!button || !source || !panel) return null;
      const controller = new win.AbortController(), options = { signal: controller.signal };
      const record = { controller, button, source, panel, offset: null, drag: null, suppressClick: false };
      button.classList.add('goose-comment-launcher');
      panel.classList.add('goose-comment-popup');
      if (button.tagName === 'BUTTON' && !button.hasAttribute('type')) button.type = 'button';
      if (!panel.id) {
        let id;
        do { id = 'goose-comment-panel-' + (++nextPanel); } while (doc.getElementById(id));
        panel.id = id;
      }
      button.setAttribute('aria-controls', panel.id);
      button.setAttribute('aria-expanded', 'false');
      if (!button.title) button.title = '点按打开或收起；拖动或用方向键移动，按 Home 回到原文旁。';
      panel.hidden = true;
      button.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        record.suppressClick = false;
        record.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, initial: leftTop(button.getBoundingClientRect()), moved: false };
        button.setPointerCapture?.(event.pointerId);
      }, options);
      button.addEventListener('pointermove', (event) => {
        const d = record.drag;
        if (d?.id !== event.pointerId || !record.home) return;
        const dx = event.clientX - d.x, dy = event.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        d.moved = true;
        record.suppressClick = true;
        button.classList.add('goose-comment-dragging');
        record.offset = { x: d.initial.x + dx - record.home.x, y: d.initial.y + dy - record.home.y };
        schedule();
      }, options);
      const end = (event) => {
        if (record.drag?.id !== event.pointerId) return;
        if (record.home && record.drag.moved) {
          const p = clamp({ x: record.home.x + record.offset.x, y: record.home.y + record.offset.y }, button.getBoundingClientRect(), viewport());
          record.offset = { x: p.x - record.home.x, y: p.y - record.home.y };
        }
        record.drag = null;
        button.classList.remove('goose-comment-dragging');
        schedule();
      };
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, end, options);
      button.addEventListener('click', (event) => {
        if (record.suppressClick && event.detail) { record.suppressClick = false; event.preventDefault(); return; }
        toggle(record);
      }, options);
      button.addEventListener('keydown', (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || !record.home) return;
        if (event.key === 'Home') {
          record.offset = null;
        } else if (Object.hasOwn(arrow, event.key)) {
          const current = button.getBoundingClientRect();
          const [dx, dy] = arrow[event.key], step = event.shiftKey ? 32 : 12;
          const p = clamp({ x: current.left + dx * step, y: current.top + dy * step }, current, viewport());
          record.offset = { x: p.x - record.home.x, y: p.y - record.home.y };
        } else return;
        event.preventDefault();
        schedule();
      }, options);
      panel.addEventListener('click', (event) => {
        if (event.target.closest?.('[data-goose-comment-close]')) { event.preventDefault(); close(record); }
      }, options);
      return record;
    }
    function unregister(record) {
      if (active === record) close(record, false);
      record.controller.abort();
      record.button.classList.remove('goose-comment-launcher', 'goose-comment-outside', 'goose-comment-dragging');
      record.button.style.removeProperty('left');
      record.button.style.removeProperty('top');
      record.source.classList.remove('goose-comment-target');
      record.panel.classList.remove('goose-comment-popup');
      record.panel.style.removeProperty('left');
      record.panel.style.removeProperty('top');
    }
    function refresh() {
      if (destroyed) return;
      const hosts = new Set(root.querySelectorAll('[data-goose-comment]'));
      if (root.matches?.('[data-goose-comment]')) hosts.add(root);
      for (const [host, record] of records) if (!hosts.has(host) || !host.contains(record.button) || !host.contains(record.source) || !host.contains(record.panel)) {
        unregister(record);
        records.delete(host);
      }
      for (const host of hosts) if (!records.has(host)) {
        const record = register(host);
        if (record) records.set(host, record);
      }
      schedule();
    }
    const controller = new win.AbortController(), signal = controller.signal;
    win.addEventListener('resize', schedule, { signal });
    win.addEventListener('scroll', schedule, { capture: true, passive: true, signal });
    root.addEventListener('toggle', schedule, { capture: true, signal });
    doc.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !active || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      close(active);
    }, { signal });
    refresh();
    return {
      refresh,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        controller.abort();
        if (frame) win.cancelAnimationFrame(frame);
        for (const record of records.values()) unregister(record);
        records.clear();
        overlay.remove();
      }
    };
  }
  global.GooseCommentBubbles = Object.freeze({ create });
})(window);
