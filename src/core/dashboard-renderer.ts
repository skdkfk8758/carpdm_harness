import type { DashboardData, EventEntry } from '../types/dashboard.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pct(rate: number): string { return (rate * 100).toFixed(1) + '%'; }
function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }

function renderStyles(): string {
  return `
:root{--bg-primary:#0a0a0a;--bg-secondary:#111111;--bg-tertiary:#1a1a1a;--border:#262626;--text-primary:#ededed;--text-secondary:#a1a1a1;--text-muted:#666666;--accent:#0070f3;--accent-light:#3291ff;--success:#0cce6b;--warning:#f5a623;--danger:#ee0000;--radius:8px;--radius-sm:4px}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;background:var(--bg-primary);color:var(--text-primary);line-height:1.6;-webkit-font-smoothing:antialiased}
.header{background:var(--bg-secondary);border-bottom:1px solid var(--border);padding:0 24px;display:flex;align-items:center;gap:24px;position:sticky;top:0;z-index:100;height:56px}
.logo{font-size:1rem;font-weight:700;color:var(--text-primary);white-space:nowrap;letter-spacing:-0.02em}
.tab-bar{display:flex;gap:0;height:100%;align-items:stretch}
.tab-btn{background:none;border:none;border-bottom:2px solid transparent;color:var(--text-muted);cursor:pointer;font-size:0.85rem;font-weight:500;padding:0 16px;transition:color .15s,border-color .15s;display:flex;align-items:center}
.tab-btn:hover{color:var(--text-secondary)}.tab-btn.active{color:var(--text-primary);border-bottom-color:var(--accent)}
.header-meta{margin-left:auto;display:flex;gap:16px;font-size:.75rem;color:var(--text-muted);white-space:nowrap}
main{max-width:1440px;margin:0 auto;padding:24px}
.tab-content{display:none}.tab-content.active{display:block}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.card{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius);padding:20px}
.kpi-value{font-size:2rem;font-weight:700;line-height:1.2}
.kpi-label{font-size:.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px}
.badge{display:inline-flex;align-items:center;font-size:.7rem;font-weight:600;padding:2px 8px;border-radius:12px;white-space:nowrap}
.badge-pass,.badge-ok{background:rgba(12,206,107,.12);color:var(--success)}
.badge-warn{background:rgba(245,166,35,.12);color:var(--warning)}
.badge-block,.badge-danger{background:rgba(238,0,0,.12);color:var(--danger)}
.badge-off{background:rgba(102,102,102,.12);color:var(--text-muted)}
.health-section{display:flex;gap:24px;align-items:flex-start;margin-bottom:24px}
.health-gauge{width:160px;height:160px;flex-shrink:0}
.alert-feed{max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius)}
.alert-item{padding:10px 14px;border-bottom:1px solid var(--border);font-size:.82rem;display:flex;align-items:center;gap:10px}
.alert-item:last-child{border-bottom:none}
.alert-item.alert-block{border-left:3px solid var(--danger)}.alert-item.alert-warn{border-left:3px solid var(--warning)}
.alert-time{color:var(--text-muted);font-size:.75rem;white-space:nowrap}
.alert-detail{color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sessions-layout{display:grid;grid-template-columns:260px 1fr;gap:0;min-height:600px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.session-sidebar{background:var(--bg-secondary);border-right:1px solid var(--border);overflow-y:auto;max-height:700px}
.session-item{padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s}
.session-item:hover{background:var(--bg-tertiary)}
.session-item.active{background:var(--bg-tertiary);border-left:3px solid var(--accent)}
.session-item .sid{font-size:.8rem;font-weight:600;color:var(--text-primary);font-family:monospace}
.session-item .smeta{font-size:.7rem;color:var(--text-muted);margin-top:2px;display:flex;gap:8px}
.session-main{padding:16px;overflow:auto}
.filter-bar{display:flex;flex-wrap:wrap;gap:8px;padding:12px 0;align-items:center}
.filter-group{display:flex;gap:4px;align-items:center}
.filter-group-label{font-size:.7rem;color:var(--text-muted);text-transform:uppercase;margin-right:4px}
.filter-chip{padding:3px 10px;border-radius:14px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-secondary);cursor:pointer;font-size:.75rem;transition:border-color .15s,color .15s;user-select:none}
.filter-chip:hover{border-color:var(--text-muted)}
.filter-chip.active{border-color:var(--accent);color:var(--accent);background:rgba(0,112,243,.08)}
.search-input{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:5px 12px;color:var(--text-primary);font-size:.82rem;width:200px;outline:none}
.search-input:focus{border-color:var(--accent)}
.filter-separator{width:1px;height:20px;background:var(--border);margin:0 4px}
.data-table{width:100%;border-collapse:collapse;font-size:.82rem}
.data-table th{background:var(--bg-secondary);color:var(--text-muted);font-weight:600;text-align:left;padding:8px 12px;border-bottom:1px solid var(--border);font-size:.75rem;text-transform:uppercase;letter-spacing:.03em;position:sticky;top:0;z-index:1}
.data-table th.sortable{cursor:pointer;user-select:none}
.data-table th.sortable::after{content:" \\2195";opacity:.3}
.data-table th.sort-asc::after{content:" \\2191";opacity:1}
.data-table th.sort-desc::after{content:" \\2193";opacity:1}
.data-table td{padding:6px 12px;border-bottom:1px solid var(--border);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.data-table tbody tr{cursor:pointer;transition:background .1s}
.data-table tbody tr:hover{background:var(--bg-tertiary)}
.table-scroll{overflow-x:auto;max-height:560px;overflow-y:auto}
.detail-row{display:none}
.event-row.expanded + .detail-row{display:table-row}
.detail-row td{background:var(--bg-secondary);padding:14px 16px;cursor:default}
.detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:.8rem}
.detail-grid strong{color:var(--text-muted);font-size:.7rem;text-transform:uppercase;display:block;margin-bottom:2px}
.module-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-bottom:24px}
.module-card{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.module-card.installed{border-left:3px solid var(--success)}
.module-card.not-installed{opacity:.5}
.module-name{font-weight:600;font-size:.9rem;margin-bottom:4px}
.module-meta{font-size:.75rem;color:var(--text-muted);display:flex;gap:12px}
.integrity-bar-wrap{display:flex;align-items:center;gap:16px;margin-bottom:24px}
.integrity-bar{flex:1;height:8px;border-radius:4px;background:var(--bg-tertiary);overflow:hidden;display:flex}
.integrity-bar .seg-ok{background:var(--success)}.integrity-bar .seg-mod{background:var(--warning)}.integrity-bar .seg-miss{background:var(--danger)}
.integrity-labels{display:flex;gap:16px;font-size:.8rem}
.integrity-labels span{display:flex;align-items:center;gap:4px}
.integrity-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.chart-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:20px}
.chart-box{background:var(--bg-tertiary);border-radius:var(--radius);padding:16px;border:1px solid var(--border)}
.chart-box h3{color:var(--text-secondary);font-size:.85rem;font-weight:600;margin-bottom:12px}
.session-bars{margin-top:20px}
.session-bar-item{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:.75rem}
.session-bar-label{width:120px;text-align:right;color:var(--text-muted);font-family:monospace;overflow:hidden;text-overflow:ellipsis}
.session-bar-track{flex:1;height:20px;background:var(--bg-secondary);border-radius:3px;position:relative;overflow:hidden}
.session-bar-fill{height:100%;background:var(--accent);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:.65rem;color:#fff;min-width:24px}
.tag-badge{display:inline-block;font-size:.65rem;padding:1px 6px;border-radius:8px;background:rgba(0,112,243,.1);color:var(--accent-light);margin-right:3px}
.section-header{font-size:1.1rem;font-weight:700;margin-bottom:20px;color:var(--text-primary)}
.section-sub{font-size:.9rem;font-weight:600;color:var(--text-secondary);margin:20px 0 12px}
.empty-state{text-align:center;padding:40px;color:var(--text-muted);font-size:.9rem}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}::-webkit-scrollbar-thumb:hover{background:var(--text-muted)}
`;
}

function renderOverviewTab(data: DashboardData): string {
  const { stats, integrity, ontologyStatus, sessions, allSessions, currentSession } = data;
  let score = 100;
  score -= stats.blockRate > 0.1 ? 30 : Math.round(stats.blockRate * 300);
  score -= stats.warnRate > 0.2 ? 15 : Math.round(stats.warnRate * 75);
  score -= integrity.missing * 5;
  score -= integrity.modified * 2;
  if (!ontologyStatus || !ontologyStatus.enabled) score -= 10;
  score = clamp(score, 0, 100);
  const scoreColor = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  const circ = 2 * Math.PI * 62;
  const offset = circ - (score / 100) * circ;

  const alertSource: EventEntry[] = currentSession ?? Object.values(allSessions)[0] ?? [];
  const alerts = alertSource.filter(e => e.result === 'BLOCK' || e.result === 'WARN').slice(-20).reverse();
  const alertHtml = alerts.length > 0
    ? alerts.map(e => `<div class="alert-item alert-${e.result === 'BLOCK' ? 'block' : 'warn'}"><span class="alert-time">${esc(e.ts.slice(11,19))}</span><span class="badge badge-${e.result === 'BLOCK' ? 'block' : 'warn'}">${esc(e.result)}</span><span style="color:var(--text-secondary);font-size:.75rem">${esc(e.hook)}</span><span class="alert-detail">${e.detail ? esc(e.detail.slice(0, 80)) : '-'}</span></div>`).join('')
    : '<div class="empty-state">최근 BLOCK/WARN 이벤트 없음</div>';

  return `<div class="section-header">Overview</div>
<div class="health-section">
  <svg class="health-gauge" viewBox="0 0 160 160">
    <circle cx="80" cy="80" r="62" fill="none" stroke="var(--border)" stroke-width="10"/>
    <circle cx="80" cy="80" r="62" fill="none" stroke="${scoreColor}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 80 80)" style="transition:stroke-dashoffset .6s ease"/>
    <text x="80" y="72" text-anchor="middle" fill="${scoreColor}" font-size="36" font-weight="700">${score}</text>
    <text x="80" y="96" text-anchor="middle" fill="var(--text-muted)" font-size="11">Health Score</text>
  </svg>
  <div style="flex:1"><div class="card-grid">
    <div class="card"><div class="kpi-value">${stats.totalEvents.toLocaleString()}</div><div class="kpi-label">총 이벤트</div></div>
    <div class="card"><div class="kpi-value">${sessions.length}</div><div class="kpi-label">세션 수</div></div>
    <div class="card"><div class="kpi-value" style="color:${stats.blockRate > 0.1 ? 'var(--danger)' : 'var(--success)'}">${pct(stats.blockRate)}</div><div class="kpi-label">Block 비율</div></div>
    <div class="card"><div class="kpi-value" style="color:${stats.warnRate > 0.2 ? 'var(--warning)' : 'var(--success)'}">${pct(stats.warnRate)}</div><div class="kpi-label">Warn 비율</div></div>
    <div class="card"><div class="kpi-value"><span class="badge badge-ok">${integrity.original}</span> <span class="badge badge-warn">${integrity.modified}</span> <span class="badge badge-danger">${integrity.missing}</span></div><div class="kpi-label">파일 무결성</div></div>
    <div class="card"><div class="kpi-value">${stats.avgDurationMs ? stats.avgDurationMs + '<small style="font-size:.5em;color:var(--text-muted)">ms</small>' : '-'}</div><div class="kpi-label">평균 실행 시간</div></div>
  </div></div>
</div>
<div class="section-sub">최근 알림</div><div class="alert-feed">${alertHtml}</div>
<div style="margin-top:24px"><div class="chart-box" style="max-width:360px"><h3>결과 분포</h3><canvas id="overviewResultChart" height="200"></canvas></div></div>`;
}

function renderTimelineTab(data: DashboardData): string {
  const { sessions } = data;
  const maxEv = Math.max(...sessions.map(s => s.eventCount), 1);
  const bars = sessions.slice(0, 20).map(s => {
    const w = Math.max((s.eventCount / maxEv) * 100, 2);
    return `<div class="session-bar-item"><span class="session-bar-label" title="${esc(s.sessionId)}">${esc(s.sessionId.slice(0, 12))}</span><div class="session-bar-track"><div class="session-bar-fill" style="width:${w.toFixed(1)}%">${s.eventCount}</div></div><span style="font-size:.7rem;color:var(--text-muted)">${esc(s.startedAt.slice(0, 10))}</span></div>`;
  }).join('');
  return `<div class="section-header">Timeline</div><div class="chart-box"><h3>시간대별 이벤트 추이</h3><canvas id="timelineChart" height="300"></canvas></div><div class="section-sub">세션 활동 (최근 20개)</div><div class="session-bars">${bars || '<div class="empty-state">세션 데이터 없음</div>'}</div>`;
}

function renderSessionsTab(data: DashboardData): string {
  const { sessions, stats } = data;
  const sidebar = sessions.slice(0, 10).map((s, i) => {
    const bc = s.resultCounts['BLOCK'] ?? 0, wc = s.resultCounts['WARN'] ?? 0;
    return `<div class="session-item${i === 0 ? ' active' : ''}" data-id="${esc(s.sessionId)}"><div class="sid">${esc(s.sessionId.slice(0, 16))}</div><div class="smeta"><span>${s.eventCount}건</span><span>${esc(s.startedAt.slice(0, 10))}</span></div><div class="smeta">${bc > 0 ? `<span class="badge badge-block">${bc} B</span>` : ''}${wc > 0 ? `<span class="badge badge-warn">${wc} W</span>` : ''}${bc === 0 && wc === 0 ? '<span class="badge badge-ok">CLEAN</span>' : ''}</div></div>`;
  }).join('');
  const mkChips = (type: string, keys: string[]) => keys.slice(0, 8).map(k => `<span class="filter-chip" data-filter-type="${type}" data-filter-value="${esc(k)}">${esc(k)}</span>`).join('');
  const aC = mkChips('agent', Object.keys(stats.byAgent).sort());
  const mC = mkChips('mode', Object.keys(stats.byMode).sort());
  const tC = mkChips('tag', Object.keys(stats.byTag).sort());
  return `<div class="section-header">Sessions</div><div class="sessions-layout"><div class="session-sidebar">${sidebar || '<div class="empty-state">세션 없음</div>'}</div><div class="session-main"><div class="filter-bar"><div class="filter-group"><span class="filter-group-label">결과</span>${['PASS','WARN','BLOCK'].map(r => `<span class="filter-chip" data-filter-type="result" data-filter-value="${r}">${r}</span>`).join('')}</div><div class="filter-separator"></div>${aC ? `<div class="filter-group"><span class="filter-group-label">에이전트</span>${aC}</div><div class="filter-separator"></div>` : ''}${mC ? `<div class="filter-group"><span class="filter-group-label">모드</span>${mC}</div><div class="filter-separator"></div>` : ''}${tC ? `<div class="filter-group"><span class="filter-group-label">태그</span>${tC}</div><div class="filter-separator"></div>` : ''}<input type="text" id="sessionSearch" class="search-input" placeholder="검색 (훅, 도구, 상세)"></div><div class="table-scroll"><table class="data-table" id="sessionTable"><thead><tr><th class="sortable" data-sort="ts">시간</th><th>이벤트</th><th>훅</th><th class="sortable" data-sort="result">결과</th><th>도구</th><th>상세</th><th>에이전트</th><th class="sortable" data-sort="durationMs">시간(ms)</th></tr></thead><tbody id="sessionTableBody"></tbody></table></div></div></div>`;
}

function renderModulesTab(data: DashboardData): string {
  const { modules, integrity, hookMap, stats } = data;
  const cards = modules.map(m => `<div class="module-card ${m.installed ? 'installed' : 'not-installed'}"><div class="module-name">${esc(m.name)} ${m.installed ? '<span class="badge badge-ok">설치됨</span>' : '<span class="badge badge-off">미설치</span>'}</div><div class="module-meta"><span>파일 ${m.fileCount}</span><span>훅 ${m.hookCount}</span></div></div>`).join('');
  const tot = integrity.original + integrity.modified + integrity.missing || 1;
  const hookRows = hookMap.map(e => `<tr><td>${esc(e.event)}</td><td>${e.hooks.map(h => `<span class="badge badge-off" style="margin-right:4px">${esc(h)} (${stats.byHook[h] ?? 0})</span>`).join('')}</td></tr>`).join('');
  return `<div class="section-header">Modules</div><div class="module-grid">${cards}</div><div class="section-sub">파일 무결성</div><div class="integrity-bar-wrap"><div class="integrity-bar"><div class="seg-ok" style="width:${(integrity.original/tot*100).toFixed(1)}%"></div><div class="seg-mod" style="width:${(integrity.modified/tot*100).toFixed(1)}%"></div><div class="seg-miss" style="width:${(integrity.missing/tot*100).toFixed(1)}%"></div></div><div class="integrity-labels"><span><span class="integrity-dot" style="background:var(--success)"></span> 정상 ${integrity.original}</span><span><span class="integrity-dot" style="background:var(--warning)"></span> 변경 ${integrity.modified}</span><span><span class="integrity-dot" style="background:var(--danger)"></span> 누락 ${integrity.missing}</span></div></div><div class="section-sub">훅-이벤트 매핑</div><table class="data-table"><thead><tr><th>이벤트 타입</th><th>훅 (이벤트 수)</th></tr></thead><tbody>${hookRows || '<tr><td colspan="2" class="empty-state">매핑 데이터 없음</td></tr>'}</tbody></table>`;
}

function renderAnalyticsTab(data: DashboardData): string {
  const { stats } = data;
  const nd = '<p style="color:var(--text-muted);font-size:.82rem;padding:20px 0;text-align:center">데이터 없음</p>';
  const hRows = (stats.fileHotspots.length > 0 ? stats.fileHotspots : stats.topFiles.map(f => ({ file: f.file, changes: f.count, linesAdded: 0, linesRemoved: 0 }))).map(f => `<tr><td title="${esc(f.file)}">${esc(f.file.length > 40 ? '...' + f.file.slice(-37) : f.file)}</td><td>${f.changes}</td><td style="color:var(--success)">+${f.linesAdded}</td><td style="color:var(--danger)">-${f.linesRemoved}</td></tr>`).join('');
  const tRows = (stats.taskEventMap ?? []).map(t => `<tr><td>${esc(t.taskId)}</td><td>${t.eventCount}</td><td>${t.results['PASS'] ?? 0}</td><td>${t.results['WARN'] ?? 0}</td><td>${t.results['BLOCK'] ?? 0}</td></tr>`).join('');
  const hasAgent = Object.keys(stats.byAgent).length + Object.keys(stats.bySkill).length + Object.keys(stats.byMode).length > 0;
  return `<div class="section-header">Analytics</div><div class="chart-grid"><div class="chart-box"><h3>결과 분포</h3>${Object.keys(stats.byResult).length > 0 ? '<canvas id="analyticsResultChart"></canvas>' : nd}</div><div class="chart-box"><h3>훅별 이벤트 수 (Top 10)</h3>${Object.keys(stats.byHook).length > 0 ? '<canvas id="analyticsHookChart"></canvas>' : nd}</div><div class="chart-box"><h3>에이전트 / 스킬 / 모드</h3>${hasAgent ? '<canvas id="analyticsAgentChart"></canvas>' : nd}</div><div class="chart-box"><h3>위임 패턴 (Top 10)</h3>${(stats.delegationPatterns?.length ?? 0) > 0 ? '<canvas id="analyticsDelegationChart"></canvas>' : nd}</div><div class="chart-box"><h3>태그 분포</h3>${Object.keys(stats.byTag).length > 0 ? '<canvas id="analyticsTagChart"></canvas>' : nd}</div><div class="chart-box"><h3>훅별 평균 실행 시간 (ms)</h3>${Object.keys(stats.durationByHook).length > 0 ? '<canvas id="analyticsDurationChart"></canvas>' : nd}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px"><div><div class="section-sub">파일 핫스팟 (Top 15)</div><table class="data-table"><thead><tr><th>파일</th><th>변경</th><th>+라인</th><th>-라인</th></tr></thead><tbody>${hRows || '<tr><td colspan="4" class="empty-state">데이터 없음</td></tr>'}</tbody></table></div><div><div class="section-sub">태스크별 이벤트 (Top 20)</div><table class="data-table"><thead><tr><th>태스크 ID</th><th>이벤트</th><th>PASS</th><th>WARN</th><th>BLOCK</th></tr></thead><tbody>${tRows || '<tr><td colspan="5" class="empty-state">데이터 없음</td></tr>'}</tbody></table></div></div>`;
}

function renderInteractionScript(data: DashboardData): string {
  const sj = JSON.stringify(data.allSessions);
  return `<script>
(function(){
var S=${sj};
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var tabs=document.querySelectorAll('.tab-btn'),cts=document.querySelectorAll('.tab-content');
function sw(id){tabs.forEach(function(t){t.classList.toggle('active',t.dataset.tab===id);});cts.forEach(function(c){c.classList.toggle('active',c.id==='tab-'+id);});history.replaceState(null,'','#'+id);setTimeout(function(){window.dispatchEvent(new Event('resize'));},100);}
tabs.forEach(function(t){t.addEventListener('click',function(){sw(t.dataset.tab);});});
var ih=location.hash.slice(1)||'overview';if(!document.getElementById('tab-'+ih))ih='overview';sw(ih);
window.addEventListener('hashchange',function(){var h=location.hash.slice(1);if(h)sw(h);});
var si=document.querySelectorAll('.session-item'),tb=document.getElementById('sessionTableBody');
if(!tb)return;
var cid=si.length>0?si[0].dataset.id:'',ce=S[cid]||[],fl={result:[],agent:[],mode:[],tag:[],search:''},sc='ts',sd='asc';
function re(){
var f=ce.filter(function(e){
if(fl.result.length&&fl.result.indexOf(e.result)===-1)return false;
if(fl.agent.length&&(!e.agent||fl.agent.indexOf(e.agent)===-1))return false;
if(fl.mode.length&&(!e.mode||fl.mode.indexOf(e.mode)===-1))return false;
if(fl.tag.length){if(!e.tags)return false;var m=false;for(var i=0;i<fl.tag.length;i++){if(e.tags.indexOf(fl.tag[i])!==-1){m=true;break;}}if(!m)return false;}
if(fl.search){var s=fl.search.toLowerCase();return(e.hook||'').toLowerCase().indexOf(s)!==-1||(e.tool||'').toLowerCase().indexOf(s)!==-1||(e.detail||'').toLowerCase().indexOf(s)!==-1;}
return true;});
f.sort(function(a,b){var va,vb;if(sc==='ts'){va=a.ts;vb=b.ts;}else if(sc==='result'){va=a.result;vb=b.result;}else if(sc==='durationMs'){va=a.durationMs||0;vb=b.durationMs||0;}else{va=a[sc]||'';vb=b[sc]||'';}var c=va<vb?-1:va>vb?1:0;return sd==='asc'?c:-c;});
var h='';if(!f.length){h='<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">이벤트 없음</td></tr>';}
else{for(var i=0;i<f.length;i++){var e=f[i];var bc=e.result==='BLOCK'?'badge-block':e.result==='WARN'?'badge-warn':'badge-pass';var ln=e.linesChanged?'+'+e.linesChanged.added+'/-'+e.linesChanged.removed:'-';var dl=e.delegationChain?e.delegationChain.join('\\u2192'):'-';var tg=e.tags?e.tags.map(function(t){return'<span class="tag-badge">'+esc(t)+'</span>';}).join(''):'-';var fi=e.filesAffected?e.filesAffected.map(function(x){return esc(x);}).join(', '):'-';
h+='<tr class="event-row"><td>'+esc(e.ts.slice(11,19))+'</td><td>'+esc(e.event)+'</td><td>'+esc(e.hook)+'</td><td><span class="badge '+bc+'">'+esc(e.result)+'</span></td><td>'+(e.tool?esc(e.tool):'-')+'</td><td title="'+(e.detail?esc(e.detail):'')+'">'+(e.detail?esc(e.detail.slice(0,50))+(e.detail.length>50?'...':''):'-')+'</td><td>'+(e.agent?esc(e.agent):'-')+'</td><td>'+(e.durationMs!==undefined?e.durationMs+'ms':'-')+'</td></tr><tr class="detail-row"><td colspan="8"><div class="detail-grid"><div><strong>모드</strong><br>'+(e.mode||'-')+'</div><div><strong>변경</strong><br>'+ln+'</div><div><strong>위임</strong><br>'+dl+'</div><div><strong>태스크</strong><br>'+(e.taskId||'-')+'</div><div><strong>태그</strong><br>'+tg+'</div><div><strong>파일</strong><br>'+fi+'</div></div></td></tr>';}}
tb.innerHTML=h;tb.querySelectorAll('.event-row').forEach(function(r){r.addEventListener('click',function(){r.classList.toggle('expanded');});});}
si.forEach(function(it){it.addEventListener('click',function(){si.forEach(function(x){x.classList.remove('active');});it.classList.add('active');cid=it.dataset.id;ce=S[cid]||[];re();});});
document.querySelectorAll('.filter-chip').forEach(function(ch){ch.addEventListener('click',function(){ch.classList.toggle('active');var tp=ch.dataset.filterType,vl=ch.dataset.filterValue;if(ch.classList.contains('active')){if(fl[tp].indexOf(vl)===-1)fl[tp].push(vl);}else{fl[tp]=fl[tp].filter(function(v){return v!==vl;});}re();});});
var inp=document.getElementById('sessionSearch');if(inp)inp.addEventListener('input',function(ev){fl.search=ev.target.value;re();});
document.querySelectorAll('.sortable').forEach(function(th){th.addEventListener('click',function(){var col=th.dataset.sort;if(sc===col)sd=sd==='asc'?'desc':'asc';else{sc=col;sd='asc';}document.querySelectorAll('.sortable').forEach(function(t){t.classList.remove('sort-asc','sort-desc');});th.classList.add('sort-'+sd);re();});});
re();})();
<\/script>`;
}

function renderChartScript(data: DashboardData): string {
  const { stats } = data;
  const P = "['#0070f3','#0cce6b','#ee0000','#f5a623','#7928ca','#ff0080','#00d4aa','#3291ff','#ff6b6b','#ffd93d']";
  const tl = stats.timeline;
  const tlL = JSON.stringify(tl.map(t => t.hour)), tlC = JSON.stringify(tl.map(t => t.count)), tlB = JSON.stringify(tl.map(t => t.blocks)), tlW = JSON.stringify(tl.map(t => t.warns));
  const rL = JSON.stringify(Object.keys(stats.byResult)), rV = JSON.stringify(Object.values(stats.byResult));
  const hE = Object.entries(stats.byHook).sort(([,a],[,b]) => b-a).slice(0,10);
  const hL = JSON.stringify(hE.map(([k])=>k)), hV = JSON.stringify(hE.map(([,v])=>v));
  const aE = Object.entries(stats.byAgent).sort(([,a],[,b]) => b-a).slice(0,10);
  const sE = Object.entries(stats.bySkill).sort(([,a],[,b]) => b-a).slice(0,10);
  const mE = Object.entries(stats.byMode).sort(([,a],[,b]) => b-a).slice(0,10);
  const aL = JSON.stringify(aE.map(([k])=>k)), aV = JSON.stringify(aE.map(([,v])=>v));
  const sL = JSON.stringify(sE.map(([k])=>k)), sV = JSON.stringify(sE.map(([,v])=>v));
  const mL = JSON.stringify(mE.map(([k])=>k)), mV = JSON.stringify(mE.map(([,v])=>v));
  const dE = (stats.delegationPatterns??[]).slice(0,10);
  const dL = JSON.stringify(dE.map(d=>d.chain)), dV = JSON.stringify(dE.map(d=>d.count));
  const tE = Object.entries(stats.byTag).sort(([,a],[,b]) => b-a).slice(0,10);
  const tgL = JSON.stringify(tE.map(([k])=>k)), tgV = JSON.stringify(tE.map(([,v])=>v));
  const duE = Object.entries(stats.durationByHook).sort(([,a],[,b]) => b.avg-a.avg).slice(0,10);
  const duL = JSON.stringify(duE.map(([k])=>k)), duA = JSON.stringify(duE.map(([,v])=>v.avg));

  return `<script>
(function(){
if(typeof Chart==='undefined')return;Chart.defaults.color='#a1a1a1';Chart.defaults.borderColor='#262626';
var P=${P};function sc(id,cfg){var el=document.getElementById(id);if(!el)return null;return new Chart(el,cfg);}
var rL=${rL},rV=${rV};
if(rL.length>0){sc('overviewResultChart',{type:'doughnut',data:{labels:rL,datasets:[{data:rV,backgroundColor:P,borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'right',labels:{boxWidth:10,padding:8,font:{size:11}}}}}});}
var tL=${tlL},tC=${tlC},tB=${tlB},tW=${tlW};
if(tL.length>0){sc('timelineChart',{type:'line',data:{labels:tL,datasets:[{label:'전체',data:tC,borderColor:'#0070f3',backgroundColor:'rgba(0,112,243,.08)',fill:true,tension:.3,pointRadius:1},{label:'BLOCK',data:tB,borderColor:'#ee0000',backgroundColor:'rgba(238,0,0,.08)',fill:true,tension:.3,pointRadius:1},{label:'WARN',data:tW,borderColor:'#f5a623',backgroundColor:'rgba(245,166,35,.08)',fill:true,tension:.3,pointRadius:1}]},options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:11}}}},scales:{x:{ticks:{maxTicksLimit:12,font:{size:10}}},y:{beginAtZero:true}}}});}
if(rL.length>0) sc('analyticsResultChart',{type:'doughnut',data:{labels:rL,datasets:[{data:rV,backgroundColor:P,borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'right',labels:{boxWidth:10,padding:8,font:{size:11}}}}}});
var hL=${hL},hV=${hV};
if(hL.length>0) sc('analyticsHookChart',{type:'bar',data:{labels:hL,datasets:[{label:'이벤트 수',data:hV,backgroundColor:'#0070f3'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});
var aL=${aL},aV=${aV},sL=${sL},sV=${sV},mL=${mL},mV=${mV};
var allL=aL.map(function(l){return'Agent: '+l;}).concat(sL.map(function(l){return'Skill: '+l;})).concat(mL.map(function(l){return'Mode: '+l;}));
if(allL.length>0){var pad=function(a,b,c){return Array(b).fill(null).concat(a).concat(Array(c).fill(null));};sc('analyticsAgentChart',{type:'bar',data:{labels:allL,datasets:[{label:'에이전트',data:pad(aV,0,sL.length+mL.length),backgroundColor:'#0070f3'},{label:'스킬',data:pad(sV,aL.length,mL.length),backgroundColor:'#7928ca'},{label:'모드',data:pad(mV,aL.length+sL.length,0),backgroundColor:'#00d4aa'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:11}}}},scales:{x:{stacked:false,beginAtZero:true}}}});}
var dL=${dL},dV=${dV};
if(dL.length>0) sc('analyticsDelegationChart',{type:'bar',data:{labels:dL,datasets:[{label:'빈도',data:dV,backgroundColor:'#7928ca'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});
var tgL=${tgL},tgV=${tgV};
if(tgL.length>0) sc('analyticsTagChart',{type:'doughnut',data:{labels:tgL,datasets:[{data:tgV,backgroundColor:P,borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'right',labels:{boxWidth:10,padding:8,font:{size:11}}}}}});
var duL=${duL},duA=${duA};
if(duL.length>0) sc('analyticsDurationChart',{type:'bar',data:{labels:duL,datasets:[{label:'평균 ms',data:duA,backgroundColor:'#f5a623'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{callback:function(v){return v+'ms';}}}}}});
})();
<\/script>`;
}

export function renderDashboard(data: DashboardData): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>harness Dashboard \\u2014 ${esc(data.projectName)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"><\/script>
  <style>${renderStyles()}</style>
</head>
<body>
  <header class="header">
    <span class="logo">&#x2B21; harness</span>
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="overview">Overview</button>
      <button class="tab-btn" data-tab="timeline">Timeline</button>
      <button class="tab-btn" data-tab="sessions">Sessions</button>
      <button class="tab-btn" data-tab="modules">Modules</button>
      <button class="tab-btn" data-tab="analytics">Analytics</button>
    </div>
    <div class="header-meta">
      <span>${esc(data.projectName)}</span>
      <span>${esc(data.generatedAt.slice(0, 16).replace('T', ' '))}</span>
    </div>
  </header>
  <main>
    <div id="tab-overview" class="tab-content active">${renderOverviewTab(data)}</div>
    <div id="tab-timeline" class="tab-content">${renderTimelineTab(data)}</div>
    <div id="tab-sessions" class="tab-content">${renderSessionsTab(data)}</div>
    <div id="tab-modules" class="tab-content">${renderModulesTab(data)}</div>
    <div id="tab-analytics" class="tab-content">${renderAnalyticsTab(data)}</div>
  </main>
  ${renderInteractionScript(data)}
  ${renderChartScript(data)}
</body>
</html>`;
}
