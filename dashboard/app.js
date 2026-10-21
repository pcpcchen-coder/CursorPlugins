/* Static, read-only observability dashboard. Render dynamic text with textContent. */
const $ = (id) => document.getElementById(id);
const state = { index: null, rows: [], selected: null, activeRepo: 'all', mode: 'live' };
const label = { running:'RUNNING', passed:'PASSED', failed:'FAILED', blocked:'BLOCKED', cancelled:'CANCELLED', pending:'PENDING', skipped:'SKIPPED' };
const fmt = iso => iso && Number.isFinite(Date.parse(iso)) ? new Intl.DateTimeFormat('zh-TW',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)) : '—';
const ageMins = iso => iso ? (Date.now() - new Date(iso).getTime())/60000 : Infinity;
const stale = run => run.status === 'running' && ageMins(run.updated_at) > 30;
const showStatus = (s) => (label[s] || 'UNKNOWN');
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className=className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function append(parent,...children) { for(const child of children) parent.append(child); return parent; }
function chip(status) { return el('span',`status ${status || 'neutral'}`,showStatus(status)); }
function percent(run) { return run.total_steps ? Math.round(100*run.passed_steps/run.total_steps) : 0; }
function progress(run) {
  const container = el('div','progress');
  const bar = el('div','progress-bar');
  bar.style.width=`${percent(run)}%`;
  container.append(bar);
  return container;
}
function ensureSummary(run) { return { ...run, passed_steps:run.steps?.filter(s=>s.status==='passed').length || 0, total_steps:run.steps?.length || 0 }; }
function allProjects() {
  const projects = new Map((state.index?.projects || []).map(p => [p.repo,{...p}]));
  for(const run of state.rows) if(!projects.has(run.repo)) projects.set(run.repo,{repo:run.repo,name:run.repo.split('/')[1]});
  return [...projects.values()].sort((a,b)=>a.repo.localeCompare(b.repo));
}
function renderStats() {
  const rows = state.rows;
  $('repoCount').textContent=allProjects().length;
  $('runningCount').textContent=rows.filter(r=>r.status==='running').length;
  $('passedCount').textContent=rows.filter(r=>r.status==='passed').length;
  $('failedCount').textContent=rows.filter(r=>r.status==='failed'||r.status==='blocked').length;
  $('runningHint').textContent=rows.some(stale)?'Some runs have stale heartbeats':'Reported active';
  $('lastUpdated').textContent=fmt(rows[0]?.updated_at || state.index?.generated_at);
  $('dataSource').textContent=state.mode==='demo'?'DEMO DATA':'LIVE DATA';
  $('dataSource').className=`source-label${state.mode==='demo'?' demo':''}`;
}
function renderCoverage() {
  const all = allProjects();
  const area=$('coverage'); area.replaceChildren();
  const monitored=all.filter(p=>state.rows.some(r=>r.repo===p.repo)).length;
  const installed=all.filter(p=>p.observer_status==='installed-local-only' && !state.rows.some(r=>r.repo===p.repo)).length;
  $('coverageCount').textContent=`${monitored}/${all.length} reporting · ${installed} installed, awaiting runs`;
  for (const p of all) {
    const recent = state.rows.find(r=>r.repo===p.repo);
    const node=el('div','coverage-item');
    const logo=el('span','coverage-icon',p.name?.[0]?.toUpperCase()||'◈');
    const body=el('div','coverage-body');
    const localOnly=p.observer_status==='installed-local-only';
    const coverageText=recent ? `${recent.status.toUpperCase()} · ${fmt(recent.updated_at)}` : localOnly ? 'Recorder installed · awaiting first authorized pstack run' : 'Not instrumented · 尚未接入';
    append(body,el('strong','',p.name || p.repo),el('small','',coverageText));
    if (!recent && localOnly && /^https:\/\/github\.com\//.test(p.observer_ci_url || '')) {
      const evidence=el('a','','↗ CI smoke evidence (not pstack task)');
      evidence.href=p.observer_ci_url; evidence.target='_blank'; evidence.rel='noopener noreferrer'; body.append(evidence);
    }
    append(node,logo,body,recent ? chip(recent.status) : localOnly ? el('span','status pending','INSTALLED') : chip('pending'));
    area.append(node);
  }
  const nav=$('repoNav');nav.replaceChildren();
  const createNav=(name,repo,connected=false)=>{
    const b=el('button',state.activeRepo===repo?'active':'');b.type='button';
    append(b,el('span',`repo-marker${connected?' connected':''}`),el('span','repo-label',name));
    b.addEventListener('click',()=>{state.activeRepo=repo;renderCoverage();renderRuns();});
    nav.append(b);
  };
  createNav('All repositories','all',true);
  for(const p of all) createNav(p.name||p.repo,p.repo,state.rows.some(r=>r.repo===p.repo));
}
function filtered() {
  const search=$('searchInput').value.trim().toLowerCase();
  const status=$('statusFilter').value;
  return state.rows.filter(r => (state.activeRepo==='all'||r.repo===state.activeRepo) && (status==='all'||r.status===status) && (!search || [r.repo,r.title,r.playbook,r.run_id].some(x=>String(x||'').toLowerCase().includes(search))));
}
function renderRuns() {
  const rows=filtered(), container=$('runList'); container.replaceChildren();
  $('runCount').textContent=`${rows.length} runs`;
  if (!rows.length) {
    const empty=el('div','empty-state');
    append(empty,el('div','empty-icon','◎'),el('h3','',state.mode==='demo'?'No matching runs':'No observed runs yet'),el('p','',state.mode==='demo'?'Try changing the filters.':'目前沒有收到 pstack 回報。可先檢視範例資料，或依文件接入第一個 Repository。'));
    if(state.mode!=='demo') {const demo=el('button','button ghost','Explore example data →');demo.type='button';demo.addEventListener('click',loadDemo);empty.append(demo);}
    container.append(empty);
    state.selected=null; renderDetails(null); return;
  }
  if (!rows.some(r=>r.run_id===state.selected?.run_id && r.repo===state.selected?.repo)) state.selected=rows[0];
  for(const run of rows) {
    const selected=state.selected?.run_id===run.run_id && state.selected?.repo===run.repo;
    const button=el('button',`run-card${selected?' active':''}`); button.type='button';
    const head=el('div','run-head');append(head,el('strong','',run.title||run.run_id),chip(run.status));
    const meta=el('div','run-meta',`${run.repo}   ·   ${run.playbook||'unspecified'}   ·   ${fmt(run.updated_at)}`);
    const pRow=el('div','progress-row');append(pRow,progress(run),el('span','pct',`${percent(run)}%`));
    append(button,head,meta,pRow);
    if (state.mode!=='demo' && stale(run)) button.append(el('div','notice','⚠ No update for >30 min; state may be stale'));
    button.addEventListener('click',()=>{state.selected=run;renderRuns();});
    container.append(button);
  }
  renderDetails(state.selected);
}
function detailField(parent,key,value,url) {
  const span=el('span','');
  if(url && /^https:\/\//.test(url)) {
    const a=el('a','',value);a.href=url;a.target='_blank';a.rel='noopener noreferrer';span.append(`${key} `,a);
  } else span.textContent=`${key} ${value||'—'}`;
  parent.append(span);
}
async function renderDetails(summary) {
  const panel=$('detail');panel.replaceChildren();
  $('detailStatus').replaceWith(Object.assign(chip(summary?.status||'neutral'),{id:'detailStatus'}));
  if (!summary){
    const placeholder=el('div','empty-state');append(placeholder,el('div','empty-icon','⌁'),el('h3','','Select a run'),el('p','','點選左側 Run 可查看執行細節。'));
    panel.append(placeholder);return;
  }
  const key=`${summary.repo}/${summary.run_id}`;
  const heading=el('div','detail-header');
  const meta=el('div','detail-meta');
  detailField(meta,'Repository:',summary.repo,`https://github.com/${summary.repo}`);
  detailField(meta,'Playbook:',summary.playbook||'unspecified');
  detailField(meta,'Updated:',fmt(summary.updated_at));
  if(summary.branch)detailField(meta,'Branch:',summary.branch);
  if(summary.commit_sha)detailField(meta,'Commit:',summary.commit_sha.slice(0,10),`https://github.com/${summary.repo}/commit/${summary.commit_sha}`);
  append(heading,el('h3','detail-title',summary.title||summary.run_id),meta);
  const meter=el('div','detail-meter');
  const top=el('div','meter-top');append(top,el('span','','Workflow completion'),el('strong','',`${summary.passed_steps}/${summary.total_steps} steps · ${percent(summary)}%`));
  append(meter,top,progress(summary));
  append(panel,heading,meter);
  if (state.mode!=='demo' && stale(summary)) panel.append(el('div','notice','此 Run 超過 30 分鐘沒有新快照，可能中斷；不代表已停止。'));
  const title=el('h4','subheading','STEP EXECUTION TIMELINE');panel.append(title);
  const stages=el('div','step-list');panel.append(stages);
  try {
    const response=await fetch(encodeURI(summary.path),{cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const run=await response.json();
    if(state.selected?.repo!==summary.repo||state.selected?.run_id!==summary.run_id||state.mode==='demo'&&key!==`${state.selected.repo}/${state.selected.run_id}`)return;
    if(run.repo!==summary.repo||run.run_id!==summary.run_id)throw new Error('Run identity mismatch');
    for(const step of run.steps||[]) {
      const item=el('div',`step ${step.status||'pending'}`);
      const head=el('div','step-header'); append(head,el('span','step-title',step.title||step.id),chip(step.status));item.append(head);
      item.append(el('div','step-date',`${fmt(step.started_at)}  →  ${fmt(step.ended_at)}`));
      if (step.note) item.append(el('p','step-note',step.note));
      for(const evidence of step.evidence||[]) {
        if(!/^https:\/\//.test(evidence.url||''))continue;
        const a=el('a','evidence',`↗ ${evidence.label||'Evidence'}`);a.href=evidence.url;a.target='_blank';a.rel='noopener noreferrer';item.append(a);
      }
      if(['passed','failed','blocked'].includes(step.status) && !(step.evidence||[]).length) item.append(el('p','evidence-help','No evidence URL provided · 尚無附加證據'));
      stages.append(item);
    }
    const timeline=el('details','record-timeline'); const summaryNode=el('summary','',`Raw event history (${run.events?.length||0})`);timeline.append(summaryNode);
    const history=el('ol','events');
    for(const event of run.events||[])history.append(el('li','',`${fmt(event.at)} · ${event.type} · ${event.step_id||'run'} · ${event.status} ${event.note||''}`));
    timeline.append(history);panel.append(timeline);
    panel.append(el('div','notice','狀態與證據由來源 Agent 回報；連結存在不代表已獨立驗證。'));
  } catch(error) { stages.append(el('p','notice',`Cannot load run detail: ${error.message}`)); }
}
async function loadData(demo=false) {
  $('loadError').textContent='';
  try {
    const url=demo?'./data/demo-index.json':'./data/index.json';
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const index=await res.json();
    if(index.schema_version!==1||!Array.isArray(index.runs)||!Array.isArray(index.projects)) throw new Error('Unsupported index schema');
    state.index=index;state.rows=index.runs;state.mode=demo?'demo':'live';state.selected=null;state.activeRepo='all';
    $('searchInput').value='';$('statusFilter').value='all';
    renderStats();renderCoverage();renderRuns();
  } catch(err) { $('loadError').textContent=`Load failed: ${err.message}`; }
}
async function loadDemo() { await loadData(true); }
$('reloadBtn').addEventListener('click',()=>loadData(false));
$('searchInput').addEventListener('input',renderRuns);
$('statusFilter').addEventListener('change',renderRuns);
loadData();
