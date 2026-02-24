import type { DashboardData, EventEntry } from '../types/dashboard.js';

// ────────────────────────────────────────────────────────────────────────────
// 내부 유틸
// ────────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pct(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

// ────────────────────────────────────────────────────────────────────────────
// Section 1: 상태 현황
// ────────────────────────────────────────────────────────────────────────────

function renderStatusSection(data: DashboardData): string {
  const { stats, integrity, ontologyStatus, sessions } = data;
  const latestSession = sessions[0];

  const blockBadge = stats.blockRate > 0.1
    ? `<span class="badge badge-danger">${pct(stats.blockRate)} BLOCK</span>`
    : `<span class="badge badge-ok">${pct(stats.blockRate)} BLOCK</span>`;

  const warnBadge = stats.warnRate > 0.2
    ? `<span class="badge badge-warn">${pct(stats.warnRate)} WARN</span>`
    : `<span class="badge badge-ok">${pct(stats.warnRate)} WARN</span>`;

  const ontologyBadge = ontologyStatus?.enabled
    ? `<span class="badge badge-ok">ON</span>`
    : `<span class="badge badge-off">OFF</span>`;

  return `
<section id="status" class="section">
  <h2>상태 현황</h2>
  <div class="card-grid">
    <div class="card">
      <div class="card-label">총 이벤트</div>
      <div class="card-value">${stats.totalEvents.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">세션 수</div>
      <div class="card-value">${sessions.length}</div>
    </div>
    <div class="card">
      <div class="card-label">Block / Warn 비율</div>
      <div class="card-value">${blockBadge} ${warnBadge}</div>
    </div>
    <div class="card">
      <div class="card-label">파일 무결성</div>
      <div class="card-value">
        <span class="badge badge-ok">${integrity.original} 정상</span>
        <span class="badge badge-warn">${integrity.modified} 변경</span>
        <span class="badge badge-danger">${integrity.missing} 누락</span>
      </div>
    </div>
    <div class="card">
      <div class="card-label">온톨로지</div>
      <div class="card-value">${ontologyBadge}
        ${ontologyStatus?.lastBuilt ? `<small>${esc(ontologyStatus.lastBuilt)}</small>` : ''}
      </div>
    </div>
    <div class="card">
      <div class="card-label">최근 세션</div>
      <div class="card-value">
        ${latestSession
          ? `<small>${esc(latestSession.sessionId.slice(0, 12))}...</small><br>${latestSession.eventCount}건`
          : '없음'}
      </div>
    </div>
  </div>
</section>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Section 2: 모듈 의존성 그래프 (Mermaid)
// ────────────────────────────────────────────────────────────────────────────

function renderModuleGraphSection(data: DashboardData): string {
  const { modules, moduleGraph } = data;

  const installedModules = modules.filter(m => m.installed);
  const displayEdges = moduleGraph.slice(0, 40);

  const mermaidLines: string[] = ['graph LR'];

  for (const m of installedModules) {
    const id = m.name.replace(/[^a-zA-Z0-9_]/g, '_');
    mermaidLines.push(`  ${id}["${esc(m.name)}<br/>(${m.hookCount} hooks)"]`);
  }

  for (const edge of displayEdges) {
    const srcId = edge.source.replace(/[^a-zA-Z0-9_]/g, '_');
    const tgtId = edge.target.replace(/[^a-zA-Z0-9_]/g, '_');
    mermaidLines.push(`  ${srcId} --> ${tgtId}`);
  }

  if (moduleGraph.length > 40) {
    mermaidLines.push(`  %% ...총 ${moduleGraph.length}개 중 40개 표시`);
  }

  const moduleRows = modules.map(m => `
    <tr>
      <td>${esc(m.name)}</td>
      <td>${m.installed ? '<span class="badge badge-ok">설치됨</span>' : '<span class="badge badge-off">미설치</span>'}</td>
      <td>${m.fileCount}</td>
      <td>${m.hookCount}</td>
    </tr>`).join('');

  return `
<section id="modules" class="section">
  <h2>모듈 의존성 그래프</h2>
  <div class="mermaid-wrapper">
    <pre class="mermaid">${mermaidLines.join('\n')}</pre>
  </div>
  <table class="data-table">
    <thead><tr><th>모듈</th><th>상태</th><th>파일</th><th>훅</th></tr></thead>
    <tbody>${moduleRows}</tbody>
  </table>
</section>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Section 3: 훅 이벤트 플로우 (Mermaid)
// ────────────────────────────────────────────────────────────────────────────

function renderHookFlowSection(data: DashboardData): string {
  const { hookMap, stats } = data;

  const mermaidLines: string[] = ['graph TD'];

  for (const entry of hookMap) {
    const eventId = entry.event.replace(/[^a-zA-Z0-9_]/g, '_');
    mermaidLines.push(`  ${eventId}(["${esc(entry.event)}"])`);
    for (const hook of entry.hooks) {
      const hookId = hook.replace(/[^a-zA-Z0-9_]/g, '_') + '_h';
      const count = stats.byHook[hook] ?? 0;
      mermaidLines.push(`  ${hookId}["${esc(hook)}<br/>${count}건"]`);
      mermaidLines.push(`  ${eventId} --> ${hookId}`);
    }
  }

  const hookRows = Object.entries(stats.byHook)
    .sort(([, a], [, b]) => b - a)
    .map(([hook, count]) =>
      `<tr><td>${esc(hook)}</td><td>${count}</td><td>-</td></tr>`
    ).join('');

  return `
<section id="hookflow" class="section">
  <h2>훅 이벤트 플로우</h2>
  <div class="mermaid-wrapper">
    <pre class="mermaid">${mermaidLines.join('\n')}</pre>
  </div>
  <table class="data-table">
    <thead><tr><th>훅</th><th>이벤트 수</th><th>Block 수</th></tr></thead>
    <tbody>${hookRows}</tbody>
  </table>
</section>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Section 4: 통계 대시보드 (Chart.js)
// ────────────────────────────────────────────────────────────────────────────

function renderStatsSection(data: DashboardData): string {
  const { stats } = data;

  const timelineLabels = JSON.stringify(stats.timeline.map(t => t.hour));
  const timelineCounts = JSON.stringify(stats.timeline.map(t => t.count));
  const timelineBlocks = JSON.stringify(stats.timeline.map(t => t.blocks));
  const timelineWarns  = JSON.stringify(stats.timeline.map(t => t.warns));

  const resultLabels = JSON.stringify(Object.keys(stats.byResult));
  const resultValues = JSON.stringify(Object.values(stats.byResult));

  const hookLabels = JSON.stringify(
    Object.entries(stats.byHook).sort(([,a],[,b]) => b-a).slice(0,10).map(([k]) => k)
  );
  const hookValues = JSON.stringify(
    Object.entries(stats.byHook).sort(([,a],[,b]) => b-a).slice(0,10).map(([,v]) => v)
  );

  const topFileRows = stats.topFiles.map(f =>
    `<tr><td title="${esc(f.file)}">${esc(f.file.length > 50 ? '...' + f.file.slice(-47) : f.file)}</td><td>${f.count}</td></tr>`
  ).join('');

  return `
<section id="stats" class="section">
  <h2>통계 대시보드</h2>
  <div class="chart-grid">
    <div class="chart-box">
      <h3>시간대별 이벤트</h3>
      <canvas id="timelineChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>결과 분포</h3>
      <canvas id="resultChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>훅별 이벤트 수 (Top 10)</h3>
      <canvas id="hookChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>자주 변경된 파일 (Top 10)</h3>
      <table class="data-table">
        <thead><tr><th>파일</th><th>횟수</th></tr></thead>
        <tbody>${topFileRows || '<tr><td colspan="2">데이터 없음</td></tr>'}</tbody>
      </table>
    </div>
  </div>
</section>
<script>
(function() {
  const timelineLabels = ${timelineLabels};
  const timelineCounts = ${timelineCounts};
  const timelineBlocks = ${timelineBlocks};
  const timelineWarns  = ${timelineWarns};
  const resultLabels   = ${resultLabels};
  const resultValues   = ${resultValues};
  const hookLabels     = ${hookLabels};
  const hookValues     = ${hookValues};

  if (timelineLabels.length > 0) {
    new Chart(document.getElementById('timelineChart'), {
      type: 'line',
      data: {
        labels: timelineLabels,
        datasets: [
          { label: '전체', data: timelineCounts, borderColor: '#4f8ef7', backgroundColor: 'rgba(79,142,247,0.1)', fill: true, tension: 0.3 },
          { label: 'BLOCK', data: timelineBlocks, borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', fill: true, tension: 0.3 },
          { label: 'WARN', data: timelineWarns, borderColor: '#f39c12', backgroundColor: 'rgba(243,156,18,0.1)', fill: true, tension: 0.3 },
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
  }

  if (resultLabels.length > 0) {
    new Chart(document.getElementById('resultChart'), {
      type: 'doughnut',
      data: {
        labels: resultLabels,
        datasets: [{ data: resultValues, backgroundColor: ['#2ecc71','#e74c3c','#f39c12','#4f8ef7','#9b59b6','#1abc9c'] }]
      },
      options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });
  }

  if (hookLabels.length > 0) {
    new Chart(document.getElementById('hookChart'), {
      type: 'bar',
      data: {
        labels: hookLabels,
        datasets: [{ label: '이벤트 수', data: hookValues, backgroundColor: '#4f8ef7' }]
      },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }
    });
  }
})();
</script>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Section 5: 세션 리플레이
// ────────────────────────────────────────────────────────────────────────────

function renderSessionReplaySection(data: DashboardData): string {
  const { sessions, currentSession } = data;

  const sessionOptions = sessions.map(s =>
    `<option value="${esc(s.sessionId)}">${esc(s.sessionId.slice(0, 16))}... (${s.eventCount}건, ${esc(s.startedAt.slice(0, 10))})</option>`
  ).join('');

  const currentEvents: EventEntry[] = currentSession ?? [];

  const eventRows = currentEvents.slice(-200).map(e => {
    const rowClass = e.result === 'BLOCK' ? 'result-block'
      : e.result === 'WARN' ? 'result-warn'
      : '';
    const badgeClass = e.result === 'BLOCK' ? 'badge-danger'
      : e.result === 'WARN' ? 'badge-warn'
      : 'badge-ok';
    return `<tr class="${rowClass}">
      <td>${esc(e.ts.slice(11, 19))}</td>
      <td>${esc(e.event)}</td>
      <td>${esc(e.hook)}</td>
      <td><span class="badge ${badgeClass}">${esc(e.result)}</span></td>
      <td>${e.tool ? esc(e.tool) : '-'}</td>
      <td title="${e.detail ? esc(e.detail) : ''}">${e.detail ? esc(e.detail.slice(0, 60)) + (e.detail.length > 60 ? '...' : '') : '-'}</td>
    </tr>`;
  }).join('');

  return `
<section id="replay" class="section">
  <h2>세션 리플레이</h2>
  <div class="replay-controls">
    <label for="sessionSelect">세션 선택:</label>
    <select id="sessionSelect">${sessionOptions || '<option>세션 없음</option>'}</select>
    <span class="replay-hint">최근 200건 표시</span>
  </div>
  <div class="table-scroll">
    <table class="data-table" id="replayTable">
      <thead><tr><th>시간</th><th>이벤트</th><th>훅</th><th>결과</th><th>도구</th><th>상세</th></tr></thead>
      <tbody id="replayBody">${eventRows || '<tr><td colspan="6">이벤트 없음</td></tr>'}</tbody>
    </table>
  </div>
</section>`;
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 렌더러
// ────────────────────────────────────────────────────────────────────────────

export function renderDashboard(data: DashboardData): string {
  const navItems = [
    ['#status', '상태 현황'],
    ['#modules', '모듈 그래프'],
    ['#hookflow', '훅 플로우'],
    ['#stats', '통계'],
    ['#replay', '세션 리플레이'],
  ].map(([href, label]) =>
    `<a href="${href}" class="nav-link">${label}</a>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>carpdm-harness Dashboard — ${esc(data.projectName)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.6; }
    header { background: #1a1d27; border-bottom: 1px solid #2d3748; padding: 1rem 2rem; display: flex; align-items: center; gap: 2rem; position: sticky; top: 0; z-index: 100; }
    header h1 { font-size: 1.25rem; font-weight: 700; color: #4f8ef7; }
    header .meta { font-size: 0.75rem; color: #718096; margin-left: auto; }
    nav { display: flex; gap: 0.5rem; }
    .nav-link { color: #a0aec0; text-decoration: none; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.875rem; transition: background 0.15s; }
    .nav-link:hover { background: #2d3748; color: #fff; }
    main { max-width: 1400px; margin: 0 auto; padding: 2rem; display: flex; flex-direction: column; gap: 2rem; }
    .section { background: #1a1d27; border: 1px solid #2d3748; border-radius: 8px; padding: 1.5rem; }
    .section h2 { font-size: 1.1rem; font-weight: 600; color: #4f8ef7; margin-bottom: 1.25rem; border-bottom: 1px solid #2d3748; padding-bottom: 0.5rem; }
    .section h3 { font-size: 0.95rem; font-weight: 600; color: #a0aec0; margin-bottom: 0.75rem; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .card { background: #0f1117; border: 1px solid #2d3748; border-radius: 6px; padding: 1rem; }
    .card-label { font-size: 0.75rem; color: #718096; margin-bottom: 0.5rem; }
    .card-value { font-size: 1.25rem; font-weight: 700; display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
    .badge { display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 12px; }
    .badge-ok { background: rgba(46,204,113,0.15); color: #2ecc71; }
    .badge-warn { background: rgba(243,156,18,0.15); color: #f39c12; }
    .badge-danger { background: rgba(231,76,60,0.15); color: #e74c3c; }
    .badge-off { background: rgba(113,128,150,0.15); color: #718096; }
    .mermaid-wrapper { background: #0f1117; border-radius: 6px; padding: 1rem; overflow-x: auto; margin-bottom: 1rem; min-height: 80px; }
    .chart-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 1.5rem; }
    .chart-box { background: #0f1117; border-radius: 6px; padding: 1rem; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .data-table th { background: #0f1117; color: #718096; font-weight: 600; text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #2d3748; }
    .data-table td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #1e2535; white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
    .data-table tr:hover td { background: rgba(79,142,247,0.05); }
    .result-block td { border-left: 3px solid #e74c3c; }
    .result-warn td { border-left: 3px solid #f39c12; }
    .replay-controls { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .replay-controls label { font-size: 0.875rem; color: #a0aec0; }
    .replay-controls select { background: #0f1117; border: 1px solid #2d3748; color: #e2e8f0; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
    .replay-hint { font-size: 0.75rem; color: #718096; }
    .table-scroll { overflow-x: auto; max-height: 500px; overflow-y: auto; }
    small { font-size: 0.7rem; color: #718096; display: block; }
  </style>
</head>
<body>
  <header>
    <h1>carpdm-harness Dashboard</h1>
    <nav>${navItems}</nav>
    <div class="meta">
      <div>${esc(data.projectName)}</div>
      <div>생성: ${esc(data.generatedAt)}</div>
    </div>
  </header>
  <main>
    ${renderStatusSection(data)}
    ${renderModuleGraphSection(data)}
    ${renderHookFlowSection(data)}
    ${renderStatsSection(data)}
    ${renderSessionReplaySection(data)}
  </main>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'loose' });
  <\/script>
</body>
</html>`;
}
