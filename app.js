// ===== 胡卜萝 独立站 =====

// 后端 API 地址（浏览器直接调云托管，需要后端开启 CORS）
const API_BASE = 'https://xiaoyao-backend-266325-8-1439742797.sh.run.tcloudbase.com';

const CONSULTS_KEY = 'hubluo_consults_v1';
const NOTES_KEY = 'hubluo_notes_v1';
const USER_ID_KEY = 'hubluo_user_id';
const USER_NAME_KEY = 'hubluo_user_name';

// 初始化用户唯一标识
function getUserId() {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = 'hbl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

function getUserName() {
  return localStorage.getItem(USER_NAME_KEY) || '';
}

function setUserName(name) {
  localStorage.setItem(USER_NAME_KEY, name);
}

function getUserContext() {
  const consults = getConsults();
  const topics = consults.map(c => {
    if (/财|金|涨|跌|投资|生意/.test(c.question)) return 'wealth';
    if (/感情|喜欢|复合|婚|恋|男女/.test(c.question)) return 'love';
    if (/工作|面试|考|事业|升职/.test(c.question)) return 'career';
    if (/病|健康|身体/.test(c.question)) return 'health';
    if (/丢|找|钥匙|手机|钱包/.test(c.question)) return 'lost';
    return 'other';
  });
  const topicCount = {};
  topics.forEach(t => { topicCount[t] = (topicCount[t] || 0) + 1; });
  const topTopic = Object.entries(topicCount).sort((a,b) => b[1]-a[1])[0];
  return {
    total_consults: consults.length,
    common_topics: topTopic ? topTopic[0] : '',
  };
}

const SAMPLES = {
  wealth: ['今日金价涨跌', '本月财运如何', '这笔投资能赚钱吗'],
  love: ['他现在对我是什么态度', '我们能复合吗', '我的正缘什么时候出现'],
  career: ['这次面试能通过吗', '该不该跳槽', '考研能上岸吗'],
  life: ['丢失的钥匙能找到吗', '这次考试能过关吗', '适合去新城市发展吗'],
};

const LINE_OPTS = [
  {v:7,l:'少阳',m:'',c:'yang'},
  {v:8,l:'少阴',m:'',c:'yin'},
  {v:9,l:'老阳',m:'O',c:'yang'},
  {v:6,l:'老阴',m:'X',c:'yin'},
];
const MANUAL_DISPLAY = [
  {pos:6,l:'上爻'},
  {pos:5,l:'五爻'},
  {pos:4,l:'四爻'},
  {pos:3,l:'三爻'},
  {pos:2,l:'二爻'},
  {pos:1,l:'初爻'},
];

let curCast=null, curReport=null, curMethod='auto';
let manualVals=[7,7,7,7,7,7];
let openManualPos=0;
let subTab='history', curCat='wealth';
let fbVal='', consultTime=0;

document.addEventListener('DOMContentLoaded', init);

function init() {
  initNicknameModal();
  initNav();
  initSamples();
  initManual();
  initConsult();
  initReading();
  initRecords();
  initProfile();
  initDonation();
  checkHealth();
}

/* ===== 昵称弹窗 ===== */
function initNicknameModal() {
  const modal = document.getElementById('nicknameModal');
  const input = document.getElementById('nicknameInput');
  const confirmBtn = document.getElementById('nicknameConfirm');
  const skipBtn = document.getElementById('nicknameSkip');

  // 已有昵称 → 不弹
  if (getUserName()) {
    modal.style.display = 'none';
    updateProfileUI();
    return;
  }

  // 确认
  confirmBtn.addEventListener('click', () => {
    const name = input.value.trim().slice(0, 12);
    if (name) {
      setUserName(name);
      modal.style.display = 'none';
      updateProfileUI();
    } else {
      input.focus();
      input.style.borderColor = 'var(--red)';
      setTimeout(() => { input.style.borderColor = ''; }, 1000);
    }
  });

  // 回车确认
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmBtn.click();
  });

  // 跳过
  skipBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

/* ===== Navigation ===== */
function initNav() {
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    document.getElementById('tab-'+b.dataset.tab).classList.add('active');
    if (b.dataset.tab==='records') renderHistory();
  }));
}

/* ===== Samples ===== */
function initSamples() {
  renderSamples('wealth');
  document.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    renderSamples(b.dataset.cat);
  }));
}

function renderSamples(cat) {
  curCat = cat;
  const el = document.getElementById('samples');
  el.innerHTML = (SAMPLES[cat]||[]).map(s =>
    `<button class="sample-btn" data-q="${esc(s)}"><span>${esc(s)}</span><span class="arrow">→</span></button>`
  ).join('');
  el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    document.getElementById('questionInput').value = b.dataset.q;
    countChars();
  }));
}

/* ===== Manual ===== */
function initManual() {
  document.querySelectorAll('[data-method]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.method-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    curMethod = b.dataset.method;
    openManualPos = 0;
    document.getElementById('manualPanel').hidden = curMethod!=='manual';
    renderManual();
  }));
  renderManual();
}

function renderManual() {
  const el = document.getElementById('manualLines');
  el.innerHTML = MANUAL_DISPLAY.map(row => {
    const v = manualVals[row.pos - 1] || 7;
    const cur = LINE_OPTS.find(o => o.v === v) || LINE_OPTS[0];
    const opts = LINE_OPTS.map(o =>
      `<button class="manual-dropdown-item ${o.v===v?'selected':''}" data-pos="${row.pos}" data-v="${o.v}">
        <span class="yao-icon ${o.c}"><span></span><span></span></span>
        <span class="manual-option-name">${o.l}</span>
        <span class="manual-option-mark">${o.m}</span>
      </button>`
    ).join('');
    return `<div class="manual-row">
      <span class="manual-label">${row.l}</span>
      <div class="manual-select-wrap">
        <button class="manual-select ${openManualPos===row.pos?'open':''}" data-pos="${row.pos}">
          <span class="yao-icon ${cur.c}"><span></span><span></span></span>
          <span class="manual-option-name">${cur.l}</span>
          <span class="manual-option-mark">${cur.m}</span>
          <span class="manual-arrow">⌄</span>
        </button>
        ${openManualPos===row.pos ? `<div class="manual-dropdown">${opts}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('.manual-select').forEach(b => b.addEventListener('click', () => {
    const pos = +b.dataset.pos;
    openManualPos = openManualPos === pos ? 0 : pos;
    renderManual();
  }));
  el.querySelectorAll('.manual-dropdown-item').forEach(b => b.addEventListener('click', () => {
    manualVals[+b.dataset.pos - 1] = +b.dataset.v;
    openManualPos = 0;
    renderManual();
  }));
}

/* ===== Consult ===== */
function initConsult() {
  document.getElementById('consultBtn').addEventListener('click', doConsult);
  document.getElementById('questionInput').addEventListener('input', countChars);
}

function countChars() {
  document.getElementById('charCount').textContent = document.getElementById('questionInput').value.length;
}

async function doConsult(choice) {
  const q = document.getElementById('questionInput').value.trim();
  if (!q) { setStatus('请先写下你想问的事情'); return; }

  const btn = document.getElementById('consultBtn');
  btn.disabled = true;
  document.getElementById('consultText').hidden = true;
  document.getElementById('consultLoading').hidden = false;
  setStatus('⋯ 正在起卦直断');

  // 澄清问题属于同一次起卦，必须沿用首次提交时间。
  if (!choice || !consultTime) consultTime = Date.now();

  const p = { question:q, clientNow:consultTime, method:curMethod, recentHistory:recentConsults() };
  if (choice) p.clarificationChoice = choice;
  if (curMethod==='manual') p.lines = manualVals;
  p.user_id = getUserId();
  p.user_name = getUserName();
  p.user_context = getUserContext();

  try {
    const d = await apiRequest('/api/consult', p);

    if (d.status==='clarification_required' && d.clarification) {
      showClarify(d.clarification);
      return;
    }

    // 每日次数限制
    if (d.status === 'limit_reached') {
      const bonus = d.bonus || 0;
      if (bonus > 0) {
        setStatus(`今日免费卦已用完，但你有 ${bonus} 卦 bonus 额度可用，点打赏按钮领取`);
      } else {
        setStatus(`今日免费 3 卦已用完，明天再来或打赏支持胡卜萝`);
      }
      document.getElementById('donationHint').hidden = false;
      return;
    }

    if (!d.cast || !d.report) { setStatus('生成失败，请重试'); return; }

    hideClarify();
    curCast = d.cast; curReport = d.report; fbVal='';
    saveConsult(d);
    renderReading(d);
    switchTab('reading');
    // 显示剩余次数
    if (d.daily_remaining !== undefined) {
      document.getElementById('dailyCount').textContent = `今日余 ${d.daily_remaining} 卦`;
    }
    setStatus('');
  } catch(e) {
    setStatus('连接失败：'+e.message);
  } finally {
    btn.disabled=false;
    document.getElementById('consultText').hidden=false;
    document.getElementById('consultLoading').hidden=true;
  }
}

function showClarify(c) {
  document.getElementById('clarificationCard').hidden = false;
  document.getElementById('clarificationQuestion').textContent = c.question;
  const el = document.getElementById('clarificationOptions');
  el.innerHTML = c.options.map(o =>
    `<button class="btn-secondary" data-c="${o.value}">${esc(o.label)}</button>`
  ).join('');
  el.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => doConsult(b.dataset.c)));
}

function hideClarify() { document.getElementById('clarificationCard').hidden = true; }
function switchTab(t) { document.querySelector(`[data-tab="${t}"]`).click(); }
function setStatus(m) { document.getElementById('homeStatus').textContent = m; }

/* ===== Reading ===== */
function initReading() {
  document.getElementById('copyBtn').addEventListener('click', copyReading);
  document.getElementById('shareBtn').addEventListener('click', shareReading);
  initFeedback();
}

function renderReading(d) {
  const {cast,report} = d;

  document.getElementById('readingEmpty').hidden = true;
  document.getElementById('readingContent').hidden = false;

  // Info
  const ctx = cast.context;
  const mtd = curMethod==='manual'?'手动排盘':'自动起卦';
  let jq='';
  try { const j=ctx.jieQi||{}; if(j.prevJie&&j.nextJie) jq=`${j.prevJie.name}后，${j.nextJie.name}前`; else if(j.prevQi&&j.nextQi) jq=`${j.prevQi.name}后，${j.nextQi.name}前`; } catch(e){}

  document.getElementById('infoGrid').innerHTML = `
    <div class="info-row"><span class="info-label">事项</span><span class="info-value">${esc(cast.question)}</span></div>
    <div class="info-row"><span class="info-label">日期</span><span class="info-value">${esc(ctx.datetime)}</span></div>
    <div class="info-row"><span class="info-label">方式</span><span class="info-value">${esc(mtd)}</span></div>
    ${jq?`<div class="info-row"><span class="info-label">节气</span><span class="info-value">${esc(jq)}</span></div>`:''}
    <div class="info-row"><span class="info-label">干支</span><span class="info-value">${esc(ctx.year)}年 <span class="text-red">${esc(ctx.month)}</span>月 <span class="text-red">${esc(ctx.day)}</span>日 ${esc(ctx.hour)}时</span></div>
    <div class="info-row"><span class="info-label">空亡</span><span class="info-value">${esc(ctx.dayXun||'')}旬 · ${esc(ctx.voidText||'')}空</span></div>
  `;

  // Header
  document.getElementById('hexHeader').innerHTML =
    `<span>${esc(cast.original.name)}</span><span class="arrow">→</span><span>${esc(cast.changed.name)}</span>`;

  // Board
  const lines = [...cast.lines].reverse();
  document.getElementById('hexBoard').innerHTML = lines.map(l => {
    const h = (l.hiddenGods||[]).map(g => `${g.relative||''}${g.branch||''}${g.element||''}`).join(' ');
    return `<div class="hex-row">
      <div class="hl-left">
        <span class="spirit">${esc(sS(l.spirit||''))}</span>
        <span class="rel-text">${esc(sR(l.relative||''))}${esc(l.branch||'')}${esc(l.element||'')}</span>
        ${l.role?`<span class="role-tag">${esc(l.role)}</span>`:''}
        ${h?`<span class="hidden-badge">伏${esc(h)}</span>`:''}
      </div>
      <div class="yao-wrap"><div class="yao-line ${l.line==='yang'?'yang':'yin'}"><span></span><span></span></div></div>
      <div class="change-cell">${l.moving?`<span class="change-badge">${l.changedLine==='yang'?'X→':'O→'}</span>`:''}</div>
      <div class="yao-wrap"><div class="yao-line ${l.changedLine==='yang'?'yang':'yin'}"><span></span><span></span></div></div>
      <div class="hl-right"><span class="rel-text">${esc(sR(l.changedRelative||''))}${esc(l.changedBranch||'')}${esc(l.changedElement||'')}</span><span class="strength-tag">${esc(l.changedStrength?(l.changedStrength.level||'')+(l.changedStrength.void?' 空':''):'')}</span></div>
    </div>`;
  }).join('');

  // Reading
  document.getElementById('readingBody').textContent = report.directReading || report.summary || '';
}

function sS(s) { return {青龙:'龙',朱雀:'雀',勾陈:'勾',螣蛇:'蛇',腾蛇:'蛇',白虎:'虎',玄武:'玄'}[s]||s.charAt(0); }
function sR(r) { return {父母:'父',兄弟:'兄',子孙:'孙',妻财:'财',官鬼:'官'}[r]||r.charAt(0); }

/* ===== Copy / Share ===== */
function copyReading() {
  if(!curCast||!curReport)return;
  navigator.clipboard.writeText(buildText()).then(()=>setStatus('已复制')).catch(()=>setStatus('复制失败'));
}

async function shareReading() {
  if(!curCast||!curReport)return;
  const t=buildText();
  if(navigator.share) try{await navigator.share({title:'胡卜萝直断',text:t});return}catch(e){}
  copyReading();
}

function buildText() {
  const lines=(curCast.lines||[]).slice().reverse().map(l =>
    `${sS(l.spirit||'')} ${sR(l.relative||'')}${l.branch||''}${l.element||''}` +
    (l.moving?` 动化${sR(l.changedRelative||'')}${l.changedBranch||''}${l.changedElement||''}`:'')
  );
  return [`事项：${curCast.question}`,
    `时间：${curCast.context.datetime}`,
    `干支：${curCast.context.year}年 ${curCast.context.month}月 ${curCast.context.day}日 ${curCast.context.hour}时`,
    `旬空：${curCast.context.dayXun||''}旬，${curCast.context.voidText||''}空`,
    `卦象：${curCast.original.name} → ${curCast.changed.name}`,
    '',
    ...lines,'',curReport.directReading||curReport.summary||''].join('\n');
}

/* ===== Feedback ===== */
function initFeedback() {
  document.querySelectorAll('.fb-opt').forEach(b=>b.addEventListener('click',()=>{
    fbVal=b.dataset.val;
    document.querySelectorAll('.fb-opt').forEach(x=>x.classList.toggle('on',x.dataset.val===fbVal));
    document.getElementById('feedbackExtend').hidden=false;
  }));
  document.getElementById('feedbackSubmit').addEventListener('click',submitFb);
}

async function submitFb() {
  if(!fbVal||!curCast||!curReport)return;
  try{
    const d=await apiRequest('/api/feedback',{readingId:curReport.readingId||'',value:fbVal,question:curCast.question||'',directReading:curReport.directReading||'',summary:curReport.summary||'',note:document.getElementById('feedbackNote').value.trim(),cast:curCast});
    document.getElementById('feedbackMsg').textContent=d.ok?'✓ 感谢反馈':'保存失败';
  }catch(e){
    document.getElementById('feedbackMsg').textContent='保存失败：'+e.message;
  }
}

/* ===== History ===== */
function saveConsult(d) {
  const r=getConsults(), id=String(consultTime||Date.now());
  const item={id,question:d.cast.question,time:d.cast.context?d.cast.context.datetime:'',hex:`${d.cast.original.name}→${d.cast.changed.name}`,summary:d.report.summary||'',cast:d.cast,report:d.report,method:curMethod,createdAt:consultTime||Date.now()};
  localStorage.setItem(CONSULTS_KEY,JSON.stringify([item,...r.filter(x=>x.id!==id)].slice(0,30)));
}

function getConsults() { try{return JSON.parse(localStorage.getItem(CONSULTS_KEY)||'[]')}catch{return[]} }
function recentConsults() {
  const c=Date.now()-30*24*3600*1000;
  return getConsults().filter(r=>r.createdAt>=c).slice(0,8).map(r=>({id:r.id,question:r.question,summary:r.summary,time:r.time,hex:r.hex}));
}

function renderHistory() {
  const rs=getConsults();
  const el=document.getElementById('historyList');
  const em=document.getElementById('histEmpty');
  if(!rs.length){el.innerHTML='';em.hidden=false;return;}
  em.hidden=true;
  el.innerHTML=rs.map(r=>`<div class="history-item">
    <div class="hist-q">${esc(r.question)}</div>
    <div class="hist-meta">${esc(r.time)} · ${esc(r.hex)}</div>
    <div class="hist-summary">${esc(r.summary)}</div>
    <div class="hist-actions"><button class="btn-sm" data-id="${esc(r.id)}">打开</button><button class="btn-sm hdel" data-id="${esc(r.id)}">删除</button></div>
  </div>`).join('');
  el.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',function(e){
    e.stopPropagation();const id=this.dataset.id;
    if(this.classList.contains('hdel')){
      localStorage.setItem(CONSULTS_KEY,JSON.stringify(getConsults().filter(r=>r.id!==id)));
      renderHistory();return;
    }
    const r=getConsults().find(x=>x.id===id);
    if(!r)return;
    curCast=r.cast;curReport=r.report;curMethod=r.method||'auto';renderReading({cast:r.cast,report:r.report});switchTab('reading');
  }));

}

function initRecords() {
  document.querySelectorAll('[data-sub]').forEach(b=>b.addEventListener('click',function(){
    document.querySelectorAll('.sub-nav-item').forEach(x=>x.classList.remove('active'));
    this.classList.add('active');subTab=this.dataset.sub;
    document.getElementById('sub-history').hidden=subTab!=='history';
    document.getElementById('sub-notes').hidden=subTab!=='notes';
    if(subTab==='notes') renderNotes();
  }));
  document.getElementById('saveNoteBtn').addEventListener('click',saveNote);
}

/* ===== Notes ===== */

function saveNote() {
  const c=document.getElementById('noteInput').value.trim();
  if(!c||!curCast||!curReport)return;
  const notes=getNotes();
  const item={id:String(Date.now()),question:curCast.question,hex:`${curCast.original.name}→${curCast.changed.name}`,content:c,createdAt:new Date().toLocaleDateString('zh-CN')+' '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})};
  localStorage.setItem(NOTES_KEY,JSON.stringify([item,...notes].slice(0,50)));
  document.getElementById('noteInput').value='';
  renderNotes();
}

function getNotes() { try{return JSON.parse(localStorage.getItem(NOTES_KEY)||'[]')}catch{return[]} }

function renderNotes() {
  const ns=getNotes();
  const el=document.getElementById('notesList');
  const em=document.getElementById('notesEmpty');
  if(!ns.length){el.innerHTML='';em.hidden=false;return;}
  em.hidden=true;
  el.innerHTML=ns.map(n=>`<div class="note-item">
    <div class="note-head"><span class="note-q">${esc(n.question)}</span><span class="note-time">${esc(n.createdAt)}</span></div>
    <div class="note-hex">${esc(n.hex)}</div>
    <div class="note-body">${esc(n.content)}</div>
    <button class="btn-sm ndel" data-id="${esc(n.id)}">删除</button>
  </div>`).join('');
  el.querySelectorAll('.ndel').forEach(b=>b.addEventListener('click',function(){
    localStorage.setItem(NOTES_KEY,JSON.stringify(getNotes().filter(x=>x.id!==this.dataset.id)));
    renderNotes();
  }));
}

/* ===== Profile / 用户信息 ===== */
function initProfile() {
  // 昵称编辑
  const nicknameDisplay = document.getElementById('nicknameDisplay');
  const editBtn = document.getElementById('editNicknameBtn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const current = getUserName();
      const newName = prompt('设置/修改你的昵称（胡卜萝会记住你）', current);
      if (newName && newName.trim()) {
        setUserName(newName.trim().slice(0, 20));
        updateProfileUI();
      }
    });
  }
  // 支持按钮
  const supportBtn = document.getElementById('supportBtn');
  if (supportBtn) {
    supportBtn.addEventListener('click', () => {
      document.getElementById('donationHint').hidden = false;
      document.getElementById('donationHint').scrollIntoView({ behavior: 'smooth' });
      switchTab('home');
    });
  }
  // 数据清除
  document.getElementById('clearDataBtn').addEventListener('click',()=>{
    if(confirm('清除所有本地数据？不可恢复。')){localStorage.removeItem(CONSULTS_KEY);localStorage.removeItem(NOTES_KEY);renderHistory();renderNotes();}
  });
  updateProfileUI();
}

/* ===== 打赏 ===== */
function initDonation() {
  document.querySelectorAll('.donation-amt').forEach(btn => {
    btn.addEventListener('click', () => {
      const amt = btn.dataset.amt;
      if (amt === '0') {
        setStatus('感谢支持！扫码输入任意金额即可');
      } else {
        setStatus(`感谢！扫码支付 ¥${amt} 支持胡卜萝`);
      }
    });
  });
  // 尚未接入支付回调，不能让浏览器自行发放额度。
  document.getElementById('redeemBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('redeemStatus');
    statusEl.textContent = '支付自动核验尚未接入，请联系胡卜萝领取额度';
  });
}

function updateProfileUI() {
  const name = getUserName();
  const ctx = getUserContext();
  const display = document.getElementById('nicknameDisplay');
  if (display) {
    display.textContent = name || '点击设置昵称';
    display.style.color = name ? 'var(--ink)' : 'var(--ink-muted)';
  }
  const stats = document.getElementById('userStats');
  if (stats) {
    const topicLabel = {wealth:'财运',love:'感情',career:'事业',health:'健康',lost:'寻物',other:'综合'};
    stats.textContent = ctx.total_consults > 0
      ? `已断 ${ctx.total_consults} 卦 · 常问 ${topicLabel[ctx.common_topics] || '综合'}`
      : '欢迎使用胡卜萝';
  }
}

/* ===== Health ===== */
async function checkHealth() {
  const status=document.getElementById('cloudStatus');
  try{
    const d=await apiRequest('/api/health');
    status.textContent=d.ok?`已连接 · ${d.chunks}条知识库`:'服务异常';
    status.classList.toggle('green',Boolean(d.ok));
  }catch(e){
    status.textContent='暂时不可用';
    status.classList.remove('green');
  }
}

/* ===== Utility ===== */
async function apiRequest(path, payload) {
  const options = payload === undefined
    ? {}
    : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)};
  const response = await fetch(API_BASE + path, options);
  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error(`服务返回异常（HTTP ${response.status}）`);
  }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
