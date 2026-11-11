#!/usr/bin/env python3
"""Build the self-contained teaching page from this skill's local sources.
No network, dependencies, installation, or publication. Run from any directory.
The small Markdown renderer supports only the constructs used in these sources.
"""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT.parent / 'three-provinces-six-ministries.html'

def inline(text):
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<span class="source-ref">\1</span>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'`([^`]+)`', r'<code>\1</code>', text)

def markdown(text):
    lines = re.sub(r'^---\n.*?\n---\n', '', text, flags=re.S).splitlines()
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        if not line.strip(): i += 1; continue
        if line.startswith('|'):
            rows=[]
            while i < len(lines) and lines[i].startswith('|'):
                cells=[x.strip() for x in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', x) for x in cells): rows.append(cells)
                i += 1
            out.append('<div class="table-wrap"><table>')
            for n,row in enumerate(rows):
                tag='th' if n == 0 else 'td'
                out.append('<tr>'+''.join(f'<{tag}>{inline(c)}</{tag}>' for c in row)+'</tr>')
            out.append('</table></div>'); continue
        m=re.match(r'^(#{1,6}) (.*)', line)
        if m:
            level=min(6,len(m[1])+1)
            out.append(f'<h{level}>{inline(m[2])}</h{level}>'); i += 1; continue
        if line.startswith('>'):
            block=[]
            while i < len(lines) and lines[i].startswith('>'):
                block.append(lines[i][1:].lstrip()); i += 1
            out.append('<blockquote>'+markdown('\n'.join(block))+'</blockquote>'); continue
        m=re.match(r'^(?:- |\d+\. )(.*)',line)
        if m:
            ordered=not line.startswith('- ');tag='ol' if ordered else 'ul';out.append(f'<{tag}>')
            pattern=r'^\d+\. (.*)' if ordered else r'^- (.*)'
            while i < len(lines) and (m:=re.match(pattern,lines[i])):
                out.append('<li>'+inline(m[1])+'</li>');i += 1
            out.append(f'</{tag}>');continue
        para=[line];i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(?:#|>|\||- |\d+\. )',lines[i]):
            para.append(lines[i]);i += 1
        out.append('<p>'+inline(' '.join(para))+'</p>')
    return '\n'.join(out)

STYLE = '''
:root{color-scheme:light;--ink:#203d34;--muted:#586c63;--paper:#f8f5ec;--line:#d5ded3;--accent:#27654a;--soft:#edf2e8;--warm:#fcf0d6}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans CJK SC",sans-serif;font-size:17px;line-height:1.8}main{max-width:1120px;margin:auto;padding:34px 30px 65px}a{color:var(--accent);text-underline-offset:4px}h1{font-size:clamp(29px,4.4vw,48px);line-height:1.3;letter-spacing:-.03em;margin:17px 0}h2{font-size:27px;line-height:1.4;margin:0 0 15px}h3{font-size:20px;line-height:1.5;margin:28px 0 10px}h4,h5{font-size:18px;margin:24px 0 8px}p{margin:10px 0}.eyebrow{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}.lead{font-size:21px;max-width:840px}.notice{background:var(--warm);border-left:4px solid #be8a34;padding:12px 18px;margin:24px 0;font-size:15px}.section{margin-top:35px}.flow{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card,.panel{background:#fffdf7;border:1px solid var(--line);border-radius:16px;padding:22px}.step-number{font-size:13px;letter-spacing:.08em;color:var(--muted)}.card h3{margin:5px 0}.card p{font-size:16px}.return{color:#815722;font-size:15px;margin:9px 0}.executors{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}.executors .card{background:var(--soft)}.tag{display:inline-block;border:1px solid #b9cbbc;border-radius:100px;padding:1px 10px;font-size:13px;margin-right:6px}.ministry-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.mini{border-left:3px solid #9db8a3;padding:10px 14px;background:#fffdf7}.mini b{display:block}.mini span{font-size:15px}.hanlin{background:var(--soft);padding:14px 18px;border-radius:10px;margin-top:12px;font-size:16px}.case-nav{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.case-nav button,.small-button{cursor:pointer;border:1px solid #9db5a4;background:transparent;border-radius:9px;padding:10px 15px;color:var(--ink);font:inherit;font-size:15px}.case-nav button[aria-pressed=true]{background:var(--ink);color:white}.case-nav button:focus-visible,.small-button:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid #ce9a39;outline-offset:4px}.case[hidden]{display:none}.case-title{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.case-title h2{margin:0}.request{background:var(--soft);padding:15px 18px;border-radius:10px;margin:20px 0}.dialogue{padding-left:0;list-style:none}.dialogue>li{padding:15px 0;border-bottom:1px solid var(--line)}.dialogue>li:last-child{border-bottom:none}.speaker{display:block;font-weight:700}.reply{margin:5px 0}.review{background:#fff4df;border-left:4px solid #bc8633;padding:14px 18px;margin:18px 0}.dispatch{background:#e8f0e7;border-left:4px solid #427653;padding:14px 18px;margin:18px 0}.table-wrap{overflow:auto;max-width:100%;margin:18px 0}table{width:100%;border-collapse:collapse;font-size:15px}th,td{border-bottom:1px solid var(--line);padding:9px 11px;text-align:left;white-space:nowrap}th{background:var(--soft)}details{margin:18px 0;border:1px solid var(--line);border-radius:10px;padding:0 18px;background:#fffdf7}summary{padding:14px 0;cursor:pointer;font-weight:600}details article{padding:0 2px 16px}blockquote{border-left:3px solid #a4bfa9;margin:14px 0;padding:1px 16px;background:#f2f5ec}blockquote p{margin:10px 0}code{overflow-wrap:anywhere;font-size:.9em}.muted{color:var(--muted);font-size:15px}.boundary{font-size:15px;border-top:1px solid var(--line);margin-top:36px;padding-top:20px}.check{padding-left:24px}.source-ref{text-decoration:underline;text-decoration-style:dotted}.reading{max-width:850px}.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:700px){main{padding:23px 18px 45px}.flow,.ministry-grid{grid-template-columns:1fr}.executors{grid-template-columns:1fr}.card,.panel{padding:18px}.lead{font-size:18px}h2{font-size:23px}.case-nav button{flex:1 1 140px}.table-wrap{margin-right:0}.notice{font-size:14px}}@media print{.case-nav,.toolbar{display:none}.case[hidden]{display:block}.case{break-before:page}details{display:block}details>article{display:block!important}body{background:white;font-size:12pt}.card,.panel{break-inside:avoid}}
'''
INTRO = '''
<header><a href="../index.html">← GooseResearch</a><p class="eyebrow">Experimental workflow · 独立虚构演示</p><h1>三省六部 一次完整交接</h1><p class="lead">先看各个角色负责什么，再用一个虚构研究例子看它们怎样合作。</p><div class="notice"><strong>这是教学 demo，不是真实执行。</strong> 所有观测、回复和回执都为本例虚构。切换场景只改变展示，不发送提示词、不调用 agent，也不上传数据。</div></header>
<section class="section" aria-labelledby="hierarchy"><h2 id="hierarchy">三省与执行角色</h2><div class="flow"><div class="card"><span class="step-number">01 · 中书省</span><h3>起草</h3><p>召集相关六部代表，整理意见，写出分工和完整提示词。</p></div><div class="card"><span class="step-number">02 · 门下省</span><h3>审核，可打回</h3><p>审核中书交来的草稿。发现缺项就退回，并说明要改哪里。</p></div><div class="card"><span class="step-number">03 · 尚书省</span><h3>决定派给谁</h3><p>按通过的方案和用户授权，把任务交给对应的 agent。用户只要草稿时，不发送。</p></div></div><p><strong>交用户完整草稿 → 门下复核 → 尚书依授权派发。</strong></p><p class="return">↶ 门下发现问题 → 退回中书修订 → 再审核。不是发给执行者后才补审。</p><div class="executors"><div class="card"><span class="tag">尚书省下</span><h3>将军 · Main</h3><p><strong>能分析，也能画图。</strong> 直接管理获准使用的工作站等计算平台。负责数据、方法、计算和分析图。</p></div><div class="card"><span class="tag">尚书省下</span><h3>宰相 · Dots</h3><p><strong>画总结图、改已有图、统筹决策。</strong> 有轻量计算资源，但不做数据分析，也不绕过三省自行向将军派任务。</p></div></div><p class="muted">保留“宰相”这个名称，但不是三省之上的总指挥。角色是通用设定，Main / Dots 只是本例映射。</p></section>
<section class="section" aria-labelledby="roles"><h2 id="roles">六部的分工</h2><div class="ministry-grid"><div class="mini"><b>兵部 · 下一步做什么</b><span>安排下一步，分清哪些能同时做、哪些要等前一步。</span></div><div class="mini"><b>户部 · 资源够不够</b><span>核查预算、计算资源、排队时间和交接成本。</span></div><div class="mini"><b>工部 · 能不能做对</b><span>检查输入与做法，查错误，明确怎样才算完成。</span></div><div class="mini"><b>吏部 · 谁来负责</b><span>明确六部和执行 agent 各负责什么，避免漏项和重复。</span></div><div class="mini"><b>礼部 · 讲清楚没有</b><span>把意见说清楚，删掉空话和夸大表述；负责工作沟通。</span></div><div class="mini"><b>刑部 · 说的是实情吗</b><span>核实说法与实际工作是否一致，记录并纠正错误；不设处罚权。</span></div></div><div class="hanlin"><strong>翰林院 · 是否符合指定作者的写作习惯？</strong><br>只对照明确给定的习惯或可读范例，不凭“大佬风格”猜测。不属于六部，也不增加审批权。礼部看好不好懂，翰林院看是否符合指定参照。</div><details><summary>执行链之外：后宫，只在用户认可后提供支持</summary><p>懂非暴力沟通与认知行为疗法（CBT）相关方法的支持 agent。用户明显情绪波动时，只提议是否需要帮助；认可后才分析，不认可或撤回就停止。不诊断、不代替治疗。</p><p>当前版本不参与三省六部执行，不指挥研究工作。给导师写邮件等工作沟通需要的非暴力沟通归礼部，不归后宫。</p></details><details><summary>大内总管：生活习惯与起居照料</summary><p>根据已有证据温和提醒休息、运动和生活习惯，不指责、不诊断。没有记录不等于没做，不自动扩大监测。</p></details><details><summary>御史：工作习惯与提示词阅读核对</summary><p>有具体误解时，把提示词原文、理解差异和可能影响说清楚，温和提醒核对。未回复不等于未读，不同意见不等于不认真；不指责，也不替用户改决定。</p></details></section>
<section class="section" aria-labelledby="example"><h2 id="example">例子：两座观测站的“外星脉冲”</h2><p>仪器记录到脉冲，不等于发现外星人。我们只问：两站每 10 分钟分别记录多少？</p><div class="case-nav" aria-label="选择教学场景"><button type="button" data-case="one" aria-controls="case-one" aria-pressed="true">① 已有数值，直接画图</button><button type="button" data-case="two" aria-controls="case-two" aria-pressed="false">② 换算法，交给将军</button><button type="button" data-case="loop" aria-controls="case-loop" aria-pressed="false">③ 意见有分歧，怎样再审</button></div><p id="scene-status" class="sr-only" aria-live="polite">当前：已有数值，直接画图</p>
'''
CASE_ONE = '''
<div class="case panel" id="case-one"><div class="case-title"><span class="tag">不用新分析</span><h2>宰相自己就能做</h2></div><div class="request"><strong>用户：</strong>“用已验的汇总画图并解释。不要增加分析，也别联系将军。”<br>晨星：每 10 分钟 7.5 个脉冲；暮星：6.0 个。</div><ol class="dialogue"><li><span class="speaker">中书 · 兵部先列计划</span><p class="reply">“先画图、核单位，再交付。逐夜差异留作以后，不塞进这次。”</p></li><li><span class="speaker">中书 · 户部、工部先发表意见</span><p class="reply"><b>户：</b>“已有数值够用，不增加计算或费用。”<br><b>工：</b>“直接用 7.5 和 6.0。标清每 10 分钟，不凭空加误差条。”</p></li><li><span class="speaker">中书 · 吏部分工</span><p class="reply">“Dots 画图并交付，Main 本轮无任务。工部核图数，兵部看后续，其他部门各核自己的范围，不重复派活。”</p></li><li><span class="speaker">中书 · 礼部概括，翰林院按需核文风</span><p class="reply"><b>礼：</b>“宰相可直接画。这只是记录率，不能证明有外星人。”去掉“揭示宇宙信号新范式”这种空话。<br><b>翰林院：</b>“本例作者要求短句、先结论、保留单位。上面的说法符合这三点。”</p></li><li><span class="speaker">中书 · 给用户完整说明 v1</span><p class="reply">“Dots：用已验汇总画晨星 7.5、暮星 6.0 的对比图，单位为每 10 分钟脉冲数。不改算法、不读原始数据、不联系 Main、不增加费用。不加无依据误差条。核标签、数值和单位，交图及来源版本；只描述记录率，不推断外星生命。”</p></li></ol><div class="review"><b>门下 · 工部和兵部复核 v1</b><p>工：“输入、单位和检查标准清楚。”<br>兵：“没有挤入额外分析，也不打断将军现有工作。”</p></div><div class="dispatch"><b>尚书 · 只派给宰相</b><p>“审核通过，只分派 Dots，不给 Main 新任务。”</p></div><p><b>刑部提醒：</b>汇总已验，不等于新图已验。真实交付前仍要核图数；本页只示范回复，不冒称已经画完。</p></div>
'''
CASE_TWO = '''
<div class="case panel" id="case-two" hidden><div class="case-title"><span class="tag">需要新分析</span><h2>小表也不能让宰相接管分析</h2></div><div class="request"><strong>用户：</strong>“改成每晚各占一半，算平均记录率和最小、最大值。先给完整提示词，别替我发。”</div><p>旧算法把所有分钟合并；新算法先分别算每晚，再让两晚等权。它们回答不同问题，不是谁算错。</p><p class="notice"><strong>教学预览：下面是模拟执行后的结果。</strong> 为便于理解先展示答案，不表示将军已经收到任务或真的完成了分析。</p><div class="table-wrap"><table><tr><th>站点</th><th>夜一</th><th>夜二</th><th>新均值</th><th>两晚范围</th></tr><tr><td>晨星</td><td>12</td><td>6</td><td>9</td><td>6–12</td></tr><tr><td>暮星</td><td>9</td><td>5</td><td>7</td><td>5–9</td></tr></table></div><p class="muted">虚构教学数值，单位都是每 10 分钟。完整材料中还有一条重复记录和一条校准记录，需要按既定规则排除。范围不是置信区间。</p><ol class="dialogue"><li><span class="speaker">中书 · 兵部计划</span><p class="reply">“将军核原始记录，算新结果并画分析图。宰相可先搭总结图布局，等结果交付后再填值。”</p></li><li><span class="speaker">中书 · 户部、工部意见</span><p class="reply"><b>户：</b>“小表用现有工具足够，不另购服务，也不省掉核查。”<br><b>工：</b>“每晚脉冲数 ÷ 分钟数 × 10，再按夜等权。输出逐夜值、均值、范围和有效夜数。”</p></li><li><span class="speaker">中书 · 吏部分工</span><p class="reply">“Main 管数据、统计和分析图；Dots 用已验结果做总结图。不能双方各算一套。”</p></li><li><span class="speaker">中书 · 礼部概括</span><p class="reply">“这次不是换颜色，是换算法。交将军分析；宰相继续做不依赖数值的布局。”</p></li><li><span class="speaker">中书 · 提示词 v2 交用户，未发送</span><p class="reply">完整 v2 见下方原稿。它写了公式和输出，但漏了去重规则。</p></li></ol><div class="review"><b>门下 · 工兵发现缺项，打回中书</b><p>工：“暮星夜二有相同会话副本。若按行直接平均，这晚会算两遍。”<br>兵：“先修稿，布局可继续。稿子没发，不存在撤回执行。”<br>刑：“错的是 v2 少写规则，不是旧结果或将军已经算错。”</p></div><p><b>中书 · 完整修订 v3：</b>补齐同键副本去重、校准排除、保留与排除行记录、正时长核对。不是让用户手动拼补丁。完整 v2、v3、两份接收者提示词均在下方原稿。</p><div class="review"><b>门下 · 复核准确的 v3</b><p>工：“规则、单位和复算输出齐备。”<br>兵：“分析与总结图依赖明确；状态仍是未发送。”</p></div><div class="dispatch"><b>尚书 · 明确接收者，但不代发</b><p>“Main 收分析稿，Dots 收总结图稿。用户只要提示词，因此两份都留给用户查看，不实际发送。”</p></div><p><b>若以后获准执行：</b>将军交数据、分析图与核查；宰相复用结果更新总结图；工部核图数，刑部核纠错是否真闭合。本页完整回执仅为模拟。</p></div>
'''
CASE_LOOP = '''
<div class="case panel" id="case-loop" hidden><div class="case-title"><span class="tag">先讨论，不重算</span><h2>有新条件，户部和工部再审一次</h2></div><div class="request"><strong>用户：</strong>“有些夜晚仪器可能不稳定。要不要只比两站都正常的夜晚？先讨论，不改结果。”</div><ol class="dialogue"><li><span class="speaker">户部 + 工部</span><p class="reply">户：“先看有没有现成质控资料，不申请大批计算。”<br>工：“先说清‘正常’的定义。不能因为信号小，就认定仪器坏了。”</p></li><li><span class="speaker">吏部</span><p class="reply">“将军若有资料，负责说明覆盖。宰相保留原图，整理待决定事项。当前仅讨论，不派发。”</p></li><li><span class="speaker">礼部 + 完整候选提示词</span><p class="reply">“这是要换比较的夜晚，不是改图颜色。先给资料核查稿，不授权重算。”完整 v4 见下方。</p></li><li><span class="speaker">门下 · 工部和兵部复核</span><p class="reply">“稿子只核资料，不凭空定阈值，也不覆盖原结果。”有具体问题就退回中书；没有新信息，不无限开会。</p></li></ol><div class="dispatch"><b>尚书 · 等具体决定</b><p>只有用户授权资料核查后，才安排对应工作。独立的原图交付不必跟着停。</p></div></div></section>
'''
FOOT = '''
<section class="section reading"><h2>读完，应该能回答这五问</h2><ol class="check"><li>谁起草、谁审核、谁决定派发？</li><li>只改已有结果的图，找谁？换统计口径，找谁？</li><li>礼部和翰林院，分别检查什么？</li><li>v2 漏去重时，真的发给将军了吗？</li><li>这些脉冲数能证明外星人存在吗？</li></ol><details><summary>查看简短答案</summary><p>中书起草、门下审核、尚书派发；已有结果改图可由宰相做，新统计交将军；礼部看清楚好懂，翰林院核指定作者习惯；v2 没有发送；脉冲数不能证明外星生命。</p></details></section>
<section class="section" id="full-example"><h2>完整稿与规范</h2><p class="muted">上面是便于理解的缩略演示。下面保留每部具体回复、完整提示词、退回修订和模拟回执。</p><div class="toolbar"><button class="small-button" id="expand-all" type="button">展开全部原稿</button><button class="small-button" id="collapse-all" type="button">收起原稿</button></div>
'''
SCRIPT = '''
const selectors = [...document.querySelectorAll('[data-case]')];
selectors.forEach(button => button.addEventListener('click', () => {
  selectors.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelectorAll('.case').forEach(panel => { panel.hidden = panel.id !== 'case-' + button.dataset.case; });
  document.getElementById('scene-status').textContent = '当前：' + button.textContent;
}));
document.getElementById('expand-all').addEventListener('click', () => document.querySelectorAll('details.source').forEach(item => { item.open = true; }));
document.getElementById('collapse-all').addEventListener('click', () => document.querySelectorAll('details.source').forEach(item => { item.open = false; }));
'''

def build():
    skill = (ROOT/'SKILL.md').read_text()
    reference = (ROOT/'references/fictional-handoff.md').read_text()
    sections = re.split(r'(?m)^## ',reference)
    original = []
    for idx,section in enumerate(sections):
        if idx == 0: title,body='材料与虚构边界',section
        else: title,body=section.split('\n',1)
        original.append('<details class="source"><summary>'+html.escape(title)+'</summary><article>'+markdown(body)+'</article></details>')
    page='<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="用独立虚构的外星脉冲研究，演示三省六部与翰林院怎样起草、审核和派发多 agent 任务。"><title>三省六部 · 外星脉冲研究 demo | GooseResearch</title><style>'+STYLE+'</style></head><body><main>'+INTRO+CASE_ONE+CASE_TWO+CASE_LOOP+FOOT+''.join(original)+'<details class="source"><summary>通用角色与完整 Skill 规范</summary><article>'+markdown(skill)+'</article></details></section><footer class="boundary"><p><strong>验证边界：</strong>这是实验性协作规范与虚构教学示例，不宣称提高效率已获证明。单个助手呈现六种视角，不等于六个独立 agent 审核。文风检查也不能鉴定作者是否为 AI。</p><p>本页无服务连接、数据上传或真实派发功能。独立 HTML 可本地打开；是否已发布应以实际入口为准。</p><p><a href="three-provinces-six-ministries/skill.html">Skill 原文（网页版）</a> · <a href="#full-example">完整虚构例子</a> · <a href="discuss-distill-review.html">原通用讨论审核 demo</a></p></footer></main><script>'+SCRIPT+'</script></body></html>\n'
    reader = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
              '<meta name="viewport" content="width=device-width,initial-scale=1">'
              '<title>三省六部 Skill 原文 | GooseResearch</title><style>'+STYLE+
              'pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}article{max-width:850px}'
              '</style></head><body><main><a href="../three-provinces-six-ministries.html">← 返回三省六部 demo</a>'
              '<h1>三省六部 Skill 原文</h1><p>下方为当前 SKILL.md 的阅读版；展开末尾可查看完整 Markdown 原文。</p>'
              '<article>'+markdown(skill)+'</article>'
              '<details id="raw-source"><summary>查看完整 Markdown 原文</summary><pre>'+html.escape(skill)+
              '</pre></details><p><a href="https://github.com/SamZebrado/GooseResearch/blob/main/skills/three-provinces-six-ministries/SKILL.md">在 GitHub 查看源文件</a></p>'
              '</main></body></html>')
    (ROOT/'skill.html').write_text(reader)
    TARGET.write_text(page)
    print(f'Built {TARGET.name}: {len(page.encode())} bytes')

if __name__ == '__main__': build()
