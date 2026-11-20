// SPDX-License-Identifier: GPL-3.0-only
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

function mount(initial, host) {
  const states = [];
  const record = new Map(initial ? [['goose-research-dsh-v1', JSON.stringify(initial)]] : []);
  const fakeReact = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(init) {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof init === 'function' ? init() : init;
      return [states[i], (v) => { states[i] = v; }];
    },
    useRef(initial) { const i = cursor++; return states[i] ??= { current: initial }; },
    useEffect(fn) { if (!cleanup) cleanup = fn(); },
    Fragment: Symbol('Fragment'),
  };
  let cursor, plugin, view, slot, lastBlob, lastFile, cleanup, sends = 0;
  const selection = { selectionStart: 0, selectionEnd: 6 };
  const localStorage = { getItem: (k) => record.get(k) ?? null, setItem: (k, v) => record.set(k, v) };
  const ctx = {
    window: {
      __ModuleLoader__: { load({ id, factory }) {
        assert.equal(id, 'dsh-goose-research');
        plugin = factory(p => { assert.equal(p, 'react'); return fakeReact; });
      } },
      confirm: (message) => { host?.consent?.push(message); return host?.confirm !== false; },
      setTimeout: (f, ms) => { if (!ms || ms < 5000) f(); return 1; },
      clearTimeout() {},
    },
    crypto: webcrypto, Date, Blob, localStorage,
    fetch() { sends++; throw Error('unexpected network'); },
    document: { createElement: () => ({ click() { lastFile = this.download; }, remove() {} }), body: { appendChild() {} } },
    URL: { createObjectURL: (b) => { lastBlob = b; return 'blob:test'; }, revokeObjectURL() {} },
  };
  vm.runInNewContext(read('client.js'), ctx, { filename: 'client.js' });
  plugin.apply({ slots: {
    inject: (name, fn) => { assert.equal(name, 'conversation.view'); fn(); },
    register: (opts, render) => { slot = opts; view = render(opts.inject?.(host?.sessionId)); },
  }, sessions: host ? { binding: id => host.target(id) } : undefined });
  function tree() {
    cursor = 0;
    const root = view.type(view.props);
    const editorElem = nodes(x => x.type === 'textarea' && x.props.ref, root)[0];
    if (editorElem) editorElem.props.ref.current = selection;
    return root;
  }
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
    unmount: () => cleanup?.(), download: async () => [lastFile, await lastBlob.text()], networkCalls: () => sends,
  };
}

test('manifest, host and conversation view match the package identity', async () => {
  const p = JSON.parse(read('package.json'));
  const { inject } = mount().plugin;
  assert.deepEqual([...inject], ['slots', 'sessions']);
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


const send = '发到当前会话并等回复';
const apply = '应用新稿和逐条回复';
function harness() {
  const sessionId = 'fiction-session';
  let listeners = new Set(), entries = [], sent = [], wrong = false, rpc = 'fiction-rpc';
  let resolve;
  const session = {
    sessionId, getSnapshot: () => ({ sessionId, openState: 'open', subagent: null, removed: false, running: false,
      awaitingFirstTurn: false, pendingSubmissions: [] }),
    beginSubmission: ({ mode, text, attachments }) => {
      assert.equal(mode, 'queue'); assert.equal(attachments.length, 0);
      return { requestId: rpc, abandon() {} };
    },
    prompt: (content, mode, signal, requestId) => {
      assert.equal(mode, 'queue'); assert.equal(requestId, rpc); assert.equal(content.length, 1);
      sent.push(content[0].text);
      return new Promise(r => { resolve = r; });
    },
  };
  const binding = { sessionId, session, eventSource: {
    getSnapshot: () => ({ entries }),
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
  } };
  return {
    sessionId, sent, consent: [], target(id) { assert.equal(id, sessionId); return wrong ? { ...binding, sessionId: 'other' } : binding; },
    switch() { wrong = true; }, listeners: () => listeners.size,
    accept: async () => { resolve({ ok: true, value: { accepted: true } }); await Promise.resolve(); },
    reject: async () => { resolve({ ok: false, error: {} }); await Promise.resolve(); },
    event(type, data, transient = false) {
      const seq = entries.filter(x => x.type === 'event').length + 1;
      entries.push({ type: transient ? 'transient' : 'event', event: { type, data, seq } });
      for (const l of listeners) l();
    },
    request() { return JSON.parse(sent[0].split('\n\n')[1]); },
    match(turn = 1) { this.event('user/message', { source: { kind: 'user', rpcId: rpc }, content: [{type:'text',text:sent[0]}], turn }); },
    answer(turn = 1, changed = {}, interrupted = false) {
      const req = this.request();
      const data = { ...req.responseShape, revisedText: 'fiction edits', ...changed };
      this.event('assistant/message', { turn, step: 1, interrupted, message: { content: [{ type:'text', text: JSON.stringify(data) }] } });
    },
  };
}
function autoSetup(host) {
  const m = mount(undefined, host);
  m.click('弹幕记录'); m.fill('写一条（Ctrl / Cmd + Enter 保存）', 'DIARY-NEVER-TRANSMIT'); m.click('保存记录');
  m.click('大鹅改稿'); m.click('载入虚构示例'); m.click('引用选中文本');
  m.fill(note, 'fiction note'); m.click('添加意见');
  assert.equal(m.nodes(x => x.type === 'button' && x.children[0] === send).length, 0);
  m.nodes(x => x.type === 'input' && x.props.type === 'checkbox')[0].props.onChange({ target: {checked:true} });
  return m;
}
const hasPreview = m => m.nodes(x => x.type === 'button' && x.children[0] === apply).length > 0;
test('optional handoff sends once, excludes diary, ignores unrelated/transient replies, waits for matched completed turn and only previews', async () => {
  const host = harness(), m = autoSetup(host);
  const event = m.nodes(x => x.type === 'button' && x.children[0] === send)[0].props.onClick;
  event(); event();
  assert.equal(host.sent.length, 1); assert.ok(!host.sent[0].includes('DIARY-NEVER-TRANSMIT'));
  host.event('turn/start', { turn: 1 }); host.event('user/message', { source: { kind:'user', rpcId: 'unrelated' } });
  host.answer(1); host.event('turn/end', { turn: 1, reason: {kind:'completed'} });
  host.event('turn/start', { turn: 2 }); host.match(2); host.event('assistant/live-chunk', { turn: 2 }, true);
  await host.accept();
  assert.equal(hasPreview(m), false);
  host.answer(2);
  assert.equal(hasPreview(m), false);
  host.event('turn/end', { turn: 2, reason: {kind:'completed'} });
  assert.equal(hasPreview(m), true);
  assert.ok(!m.saved().after.includes('fiction edits'));
  m.click(apply); assert.equal(m.saved().after, 'fiction edits');
  assert.equal(host.listeners(), 0);
});
test('optional handoff is inert without confirmation and does not import ambiguous, stale, cancelled or mismatched responses', async () => {
  { const h = harness(), m = autoSetup(h); h.confirm = false; m.click(send); assert.equal(h.sent.length, 0); }
  for (const scenario of ['multiple', 'other-user', 'cancel', 'wrong-batch', 'edited', 'switch', 'unmount', 'reject', 'local-stop', 'interrupted', 'malformed', 'no-answer']) {
    const h = harness(), m = autoSetup(h);
    m.click(send);
    if (scenario === 'reject') await h.reject(); else await h.accept();
    if (scenario === 'unmount') m.unmount();
    if (scenario === 'local-stop') m.click('停止等候（不撤回已发送消息）');
    if (scenario === 'edited') m.fill(draft, 'another version');
    if (scenario === 'switch') h.switch();
    h.event('turn/start', { turn:1 }); h.match();
    if (scenario === 'other-user') h.event('user/message', { source:{kind:'user',rpcId:'other'} });
    if (scenario === 'malformed') h.event('assistant/message', {turn:1,step:1,message:{content:[{ type:'text', text:'not-json' }]}});
    else if (scenario !== 'no-answer') h.answer(1, scenario === 'wrong-batch' ? {batchId:'wrong'} : {}, scenario === 'interrupted');
    if (scenario === 'multiple') h.answer(1);
    h.event('turn/end', {turn:1, reason:{kind: scenario === 'cancel' ? 'aborted' : 'completed'}});
    assert.equal(hasPreview(m), false, scenario);
    assert.equal(h.sent.length, 1, scenario);
    assert.equal(h.listeners(), 0, scenario);
  }
});


test('UI and per-send confirmation disclose payload, current model route, and upstream log caveat; cancel writes nothing', () => {
  const host = harness(), m = autoSetup(host);
  const before = m.saved();
  const disclosure = m.nodes(n => n.type === 'p').map(n => n.children.join('')).join('\n');
  for (const term of [host.sessionId, '模型服务', '设备', '不附带弹幕', '使用官方模型 API 时上传会话日志', '不会阻止普通提示', '补传积压']) assert.ok(disclosure.includes(term), term);
  host.confirm = false;
  m.click(send);
  assert.equal(host.sent.length, 0);
  assert.equal(host.listeners(), 0);
  assert.deepEqual(m.saved(), before);
  for (const term of [host.sessionId, '完整当前稿', '全部 1 条', '不附带弹幕', '可能离开此设备', '官方 API', '尚未获接收', '会话日志', '重新开启可能补传积压', '取消不会发送', '手动导出']) assert.ok(host.consent[0].includes(term), term);
  assert.ok(m.nodes(n => n.type === 'p' && n.props.role === 'status')[0].children[0].includes('未向会话发送'));
  m.click('导出当前稿和意见');
  assert.equal(host.sent.length, 0);
  host.confirm = true;
  m.click(send);
  assert.equal(host.consent.length, 2);
  assert.equal(host.sent.length, 1);
});
