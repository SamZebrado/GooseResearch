// SPDX-License-Identifier: GPL-3.0-only
window.__ModuleLoader__.load({ id: 'dsh-goose-research', factory(require) {
  'use strict';
  const React = require('react');
  const h = React.createElement;
  const key = 'goose-research-dsh-v1';
  const max = 250000;
  const fresh = () => ({ before: '', after: '', comments: [], diary: [], batch: null });
  const sample = 'The greenhouse trial ran for six evenings.\nWe recorded leaf angles under two light settings.';
  const id = () => Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(16).padStart(8, '0')).join('');
  const isText = (x, cap = max) => typeof x === 'string' && x.length <= cap;
  const valid = s => s && isText(s.before) && isText(s.after) && Array.isArray(s.comments) && s.comments.length <= 200
    && s.comments.every(c => c && isText(c.id, 64) && isText(c.quote, 8000) && isText(c.note, 4000) && Array.isArray(c.thread)
      && c.thread.length <= 100 && c.thread.every(r => r && ['人', 'AI'].includes(r.by) && isText(r.text, 4000)))
    && Array.isArray(s.diary) && s.diary.length <= 5000 && s.diary.every(d => d && isText(d.id, 64) && isText(d.time, 40) && isText(d.text, 8000))
    && (s.batch === null || (s.batch && isText(s.batch.id, 64) && isText(s.batch.signature)));
  const signature = s => JSON.stringify([s.before, s.after, s.comments]);
  const isDay = (d, day) => localDay(new Date(d.time)) === day;
  function localDay(date) {
    const pad = x => String(x).padStart(2, '0');
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  }
  function addComment(s, quote, note, makeID = id) {
    if (!isText(quote, 8000) || !quote.trim() || !s.after.includes(quote)) throw Error('请在当前稿选中一段文字（最多 8000 字）。');
    if (!isText(note, 4000) || !note.trim()) throw Error('请输入意见（最多 4000 字）。');
    if (s.comments.length >= 200) throw Error('本轮已达到 200 条意见上限。');
    return { ...s, batch: null, comments: [...s.comments, { id: makeID(), quote, note: note.trim(), thread: [] }] };
  }
  function prepareBatch(s, makeID = id) {
    if (!s.comments.length) throw Error('至少添加一条意见。');
    const batch = { id: makeID(), signature: signature(s) };
    if (!isText(batch.signature)) throw Error('本轮太长，请缩减稿件或意见后再导出。');
    const request = {
      schema: 'goose-revisions-request/v1', batchId: batch.id, draft: s.after,
      comments: s.comments.map(({ id, quote, note, thread }) => ({ id, quote, note, thread })),
      responseShape: { schema: 'goose-revisions-reply/v1', batchId: batch.id, revisedText: '完整修改稿', replies: s.comments.map(c => ({ id: c.id, text: '逐条回复' })) }
    };
    return { state: { ...s, batch }, request };
  }
  function reconcile(s, raw) {
    if (!s.batch || s.batch.signature !== signature(s)) throw Error('目前没有有效的导出批次；稿件或意见变更后请重新导出。');
    if (!isText(raw, 600000)) throw Error('回复内容过长。');
    let data;
    try { data = JSON.parse(raw); } catch { throw Error('回复必须是 JSON，不要带 Markdown 代码围栏。'); }
    if (!data || data.schema !== 'goose-revisions-reply/v1' || data.batchId !== s.batch.id) throw Error('批次编号不匹配。');
    if (!isText(data.revisedText) || !data.revisedText.trim()) throw Error('请提供完整修改稿。');
    if (!Array.isArray(data.replies) || data.replies.length !== s.comments.length) throw Error('回复必须覆盖本批全部意见。');
    const replies = new Map();
    const ids = new Set(s.comments.map(c => c.id));
    for (const row of data.replies) {
      if (!row || !ids.has(row.id) || replies.has(row.id) || !isText(row.text, 4000) || !row.text.trim()) throw Error('意见 ID 重复、未知或回复为空。');
      replies.set(row.id, row.text.trim());
    }
    if (s.comments.some(c => c.thread.length >= 100)) throw Error('部分意见已达到 100 条回复上限。');
    return { ...s, before: s.after, after: data.revisedText, batch: null,
      comments: s.comments.map(c => ({ ...c, thread: [...c.thread, { by: 'AI', text: replies.get(c.id) }] })) };
  }
  function addDiary(s, txt, now = new Date(), makeID = id) {
    if (!isText(txt, 8000) || !txt.trim()) throw Error('请输入记录（最多 8000 字）。');
    if (s.diary.length >= 5000) throw Error('记录已达 5000 条；请先导出保存。');
    return { ...s, diary: [...s.diary, { id: makeID(), time: now.toISOString(), text: txt.trim() }] };
  }
  const diaryMarkdown = (s, day) => s.diary.filter(d => isDay(d, day)).map(d =>
    new Date(d.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '；' + d.text).join('\n\n');
  const inputStyle = { width: '100%', minHeight: 82, font: 'inherit', resize: 'vertical', boxSizing: 'border-box' };
  const draftStyle = { ...inputStyle, minHeight: 230 };
  const button = (label, action, disabled = false) => h('button', { type: 'button', onClick: action, disabled }, label);
  const area = (label, value, action, extras = {}) => h('label', null, label,
    h('textarea', { value, onChange: action, style: inputStyle, ...extras }));
  const rowStyle = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0' };
  const preStyle = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
  function saveText(name, payload) {
    const url = URL.createObjectURL(new Blob([payload], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function View() {
    const [initial] = React.useState(() => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { data: fresh(), error: '' };
        const s = JSON.parse(raw);
        if (!valid(s)) throw Error('invalid');
        return { data: s, error: '' };
      } catch { return { data: fresh(), error: '原有数据读取失败；当前禁用保存，避免覆盖。' }; }
    });
    const [s, setS] = React.useState(initial.data);
    const [mode, setMode] = React.useState('revision');
    const [msg, setMsg] = React.useState(initial.error);
    const [quote, setQuote] = React.useState('');
    const [note, setNote] = React.useState('');
    const [rawReply, setRawReply] = React.useState('');
    const [candidate, setCandidate] = React.useState(null);
    const [replyId, setReplyId] = React.useState('');
    const [follow, setFollow] = React.useState('');
    const [record, setRecord] = React.useState('');
    const [day, setDay] = React.useState(() => localDay(new Date()));
    const editor = React.useRef(null);
    function act(fn) {
      try { return fn(); } catch (err) { setMsg(err instanceof Error ? err.message : '操作失败。'); }
    }
    function put(next, message) {
      if (initial.error) throw Error(initial.error);
      // A second open panel can share the origin. Refuse to overwrite it.
      const stored = localStorage.getItem(key);
      if (stored && JSON.stringify(s) !== JSON.stringify(JSON.parse(stored))) throw Error('另一窗口已更新数据；请重新打开本面板再试。');
      localStorage.setItem(key, JSON.stringify(next));
      setS(next); setMsg(message ?? '已存到当前浏览器。');
    }
    function loadDraft(txt) {
      if (!isText(txt) || !txt.trim()) throw Error('请选择不超过 25 万字符的非空纯文本。');
      const confirmReplace = s.comments.length || s.before !== s.after || s.batch;
      if (confirmReplace && !window.confirm('开始新审阅会清空本轮意见和对照；弹幕记录保留。继续？')) return;
      put({ ...s, before: txt, after: txt, comments: [], batch: null });
      setQuote(''); setNote(''); setRawReply(''); setCandidate(null);
    }
    function readDraft(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!/\.(md|txt)$/i.test(file.name) || file.size > 1000000) { setMsg('请选择 .md 或 .txt（不超过 1 MB）。'); return; }
      void file.text().then(t => act(() => loadDraft(t)), () => setMsg('无法读取文件。'));
    }
    function exportBatch() {
      const { state, request } = prepareBatch(s);
      put(state, '已导出。JSON 包含当前稿和全部意见，不含弹幕；确认后可手动交给 AI。');
      saveText('goose-review-' + request.batchId + '.json', JSON.stringify(request, null, 2));
    }
    function addEntry() {
      act(() => {
        const now = new Date();
        put(addDiary(s, record, now), '已记录。');
        setRecord(''); setDay(localDay(now));
      });
    }
    return h('section', { 'aria-label': 'Goose Research', style: { padding: 16, maxWidth: 1200, margin: 'auto' } },
      h('div', { style: rowStyle }, button('大鹅改稿', () => { setMode('revision'); setMsg(''); }, mode === 'revision'),
        button('弹幕记录', () => { setMode('diary'); setMsg(''); }, mode === 'diary')),
      h('p', { role: 'status' }, msg || '内容只保存在当前 DSH 窗口所属的浏览器存储，不会自动发给模型。'),
      mode === 'revision' ? h(React.Fragment, null,
        h('div', { style: rowStyle }, h('label', null, '打开本地稿件（.md / .txt） ', h('input', { type: 'file', accept: '.md,.txt', onChange: readDraft })),
          button('载入虚构示例', () => act(() => loadDraft(sample)))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 } },
          area('上一版', s.before, undefined, { readOnly: true, style: draftStyle }),
          area('当前稿（可直接粘贴）', s.after, e => act(() => {
            if (!isText(e.target.value)) throw Error('稿件超过 25 万字符。');
            put({ ...s, after: e.target.value, batch: null }); setCandidate(null);
          }), { ref: editor, style: draftStyle })),
        button('引用选中文本', () => act(() => {
          const t = editor.current;
          const q = s.after.slice(t?.selectionStart, t?.selectionEnd);
          if (!q.trim()) throw Error('请先在当前稿中选中文字。');
          setQuote(q);
        })),
        h('blockquote', { style: preStyle }, quote),
        area('写意见', note, e => setNote(e.target.value), { maxLength: 4000 }),
        button('添加意见', () => act(() => {
          put(addComment(s, quote, note)); setQuote(''); setNote(''); setCandidate(null);
        })),
        h('ol', null, s.comments.map(c => h('li', { key: c.id },
          h('blockquote', { style: preStyle }, c.quote), h('p', { style: preStyle }, c.note),
          h('ul', null, c.thread.map((r, i) => h('li', { key: i, style: preStyle }, r.by + '：' + r.text))),
          button('继续追问', () => { setReplyId(c.id); setFollow(''); }),
          replyId === c.id ? h(React.Fragment, null, area('追问', follow, e => setFollow(e.target.value), { maxLength: 4000 }),
            button('保存追问', () => act(() => {
              if (!follow.trim() || c.thread.length >= 100) throw Error('追问为空或该条意见达到回复上限。');
              put({ ...s, batch: null, comments: s.comments.map(x => x.id === c.id ? { ...x, thread: [...x.thread, { by: '人', text: follow.trim() }] } : x) });
              setReplyId(''); setFollow(''); setCandidate(null);
            }))) : null))),
        h('div', { style: rowStyle }, button('导出当前稿和意见', () => act(exportBatch), !s.comments.length)),
        area('粘贴 AI 回复 JSON（先校验，再应用）', rawReply, e => { setRawReply(e.target.value); setCandidate(null); }, { maxLength: 600000 }),
        button('校验回复', () => act(() => { setCandidate(reconcile(s, rawReply)); setMsg('已校验批次和每条 ID；尚未修改稿件。'); })),
        candidate ? h(React.Fragment, null,
          h('details', null, h('summary', null, '预览修改稿'), h('pre', { style: preStyle }, candidate.after)),
          button('应用新稿和逐条回复', () => act(() => {
            // Reconcile again against the latest state before replacing the draft.
            put(reconcile(s, rawReply), '修改稿和逐条回复已应用。'); setRawReply(''); setCandidate(null);
          }))) : null
      ) : h(React.Fragment, null,
        area('写一条（Ctrl / Cmd + Enter 保存）', record, e => setRecord(e.target.value), { maxLength: 8000, onKeyDown: e => {
          if (!e.nativeEvent?.isComposing && (e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); addEntry(); }
        } }),
        h('div', { style: rowStyle }, button('保存记录', addEntry),
          h('label', null, '按天回看 ', h('input', { type: 'date', value: day, onChange: e => setDay(e.target.value) })),
          button('导出当天 Markdown', () => act(() => saveText('goose-pause-' + day + '.md', diaryMarkdown(s, day))), !s.diary.some(x => isDay(x, day)))),
        h('ul', null, s.diary.filter(x => isDay(x, day)).slice().reverse().map(x => h('li', { key: x.id, style: preStyle },
          new Date(x.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '；' + x.text)))));
  }
  function apply(ctx) {
    ctx.slots.inject('conversation.view', () => ctx.slots.register({
      name: 'conversation.view', id: 'dsh-goose-research', order: 24, label: () => 'Goose Research',
    }, () => h(View)));
  }
  return { inject: ['slots'], apply };
} });
