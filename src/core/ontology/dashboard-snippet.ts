import type {
  StructureLayer,
  SemanticsLayer,
  DomainLayer,
} from '../../types/ontology.js';

// ────────────────────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR');
}

// ────────────────────────────────────────────────────────────────────────────
// 대시보드용 온톨로지 데이터
// ────────────────────────────────────────────────────────────────────────────

export interface OntologyDashboardData {
  enabled: boolean;
  layers: string[];
  lastBuilt: string | null;
  structure?: StructureLayer;
  semantics?: SemanticsLayer;
  domain?: DomainLayer;
}

// ────────────────────────────────────────────────────────────────────────────
// HTML 탭 콘텐츠 렌더러
// ────────────────────────────────────────────────────────────────────────────

/**
 * 대시보드 Ontology 탭용 HTML snippet을 생성합니다.
 * dashboard-renderer.ts의 CSS 클래스(card, card-grid, chart-box 등)를 그대로 사용합니다.
 */
export function renderOntologyDashboardHtml(data: OntologyDashboardData): string {
  if (!data.enabled) {
    return '<div class="empty-state">온톨로지가 비활성화되어 있습니다.<br>harness_init에서 <code>enableOntology=true</code>로 활성화하세요.</div>';
  }

  const parts: string[] = [];

  parts.push('<div class="section-header">Ontology</div>');

  // ── KPI 카드 ──
  const totalFiles = data.structure?.stats.totalFiles ?? 0;
  const totalSymbols = data.semantics?.symbols.totalCount ?? 0;
  const exportedSymbols = data.semantics?.symbols.exportedCount ?? 0;
  const internalDeps = data.semantics?.dependencies.internal.length ?? 0;
  const externalDeps = data.semantics?.dependencies.external.length ?? 0;
  const mxTotal = data.semantics?.annotationSummary?.total ?? 0;

  parts.push(`<div class="card-grid">
  <div class="card"><div class="kpi-value">${fmtNum(totalFiles)}</div><div class="kpi-label">파일 수</div></div>
  <div class="card"><div class="kpi-value">${fmtNum(totalSymbols)}</div><div class="kpi-label">심볼 수</div></div>
  <div class="card"><div class="kpi-value">${fmtNum(exportedSymbols)}</div><div class="kpi-label">내보낸 심볼</div></div>
  <div class="card"><div class="kpi-value">${fmtNum(internalDeps)}</div><div class="kpi-label">내부 의존성</div></div>
  <div class="card"><div class="kpi-value">${fmtNum(externalDeps)}</div><div class="kpi-label">외부 패키지</div></div>
  <div class="card"><div class="kpi-value">${fmtNum(mxTotal)}</div><div class="kpi-label">@MX 어노테이션</div></div>
</div>`);

  // ── 레이어 상태 배지 ──
  parts.push('<div class="section-sub">레이어 상태</div>');
  parts.push('<div style="display:flex;gap:12px;margin-bottom:24px;align-items:center">');
  for (const layer of ['structure', 'semantics', 'domain'] as const) {
    const active = data.layers.includes(layer);
    const badge = active ? 'badge-ok' : 'badge-off';
    const label = layer.charAt(0).toUpperCase() + layer.slice(1);
    parts.push(`<span class="badge ${badge}" style="padding:6px 14px;font-size:.85rem">${label}</span>`);
  }
  if (data.lastBuilt) {
    parts.push(`<span style="font-size:.75rem;color:var(--text-muted);margin-left:auto">마지막 빌드: ${esc(data.lastBuilt.slice(0, 16).replace('T', ' '))}</span>`);
  }
  parts.push('</div>');

  // ── 언어/확장자 차트 ──
  if (data.structure) {
    const langEntries = Object.entries(data.structure.stats.byLanguage).sort(([, a], [, b]) => b - a);
    const extEntries = Object.entries(data.structure.stats.byExtension).sort(([, a], [, b]) => b - a).slice(0, 10);

    if (langEntries.length > 0 || extEntries.length > 0) {
      parts.push('<div class="chart-grid">');
      if (langEntries.length > 0) {
        parts.push('<div class="chart-box"><h3>언어별 파일 분포</h3><canvas id="ontologyLangChart"></canvas></div>');
      }
      if (extEntries.length > 0) {
        parts.push('<div class="chart-box"><h3>확장자별 파일 수</h3><canvas id="ontologyExtChart"></canvas></div>');
      }
      parts.push('</div>');
    }
  }

  // ── 의존성 그래프 (Mermaid) ──
  if (data.semantics && data.semantics.dependencies.internal.length > 0) {
    parts.push('<div class="section-sub">의존성 그래프</div>');
    parts.push('<div class="chart-box" style="overflow-x:auto">');

    const deps = data.semantics.dependencies.internal;
    const displayDeps = deps.length > 40 ? deps.slice(0, 40) : deps;

    const nodeSet = new Set<string>();
    const mermaidLines: string[] = ['graph LR'];

    for (const rel of displayDeps) {
      const srcId = rel.source.replace(/[^a-zA-Z0-9_]/g, '_');
      const tgtId = rel.target.replace(/[^a-zA-Z0-9_]/g, '_');
      const srcLabel = rel.source.split('/').pop() ?? rel.source;
      const tgtLabel = rel.target.split('/').pop() ?? rel.target;
      if (!nodeSet.has(srcId)) {
        mermaidLines.push(`  ${srcId}["${srcLabel}"]`);
        nodeSet.add(srcId);
      }
      if (!nodeSet.has(tgtId)) {
        mermaidLines.push(`  ${tgtId}["${tgtLabel}"]`);
        nodeSet.add(tgtId);
      }
      mermaidLines.push(`  ${srcId} --> ${tgtId}`);
    }

    // Mermaid 텍스트는 escape하지 않음 — Mermaid 파서가 직접 해석
    parts.push(`<pre class="mermaid">\n${mermaidLines.join('\n')}\n</pre>`);

    if (deps.length > 40) {
      parts.push(`<p style="font-size:.75rem;color:var(--text-muted);margin-top:8px">총 ${fmtNum(deps.length)}개 중 40개 표시</p>`);
    }
    parts.push('</div>');
  }

  // ── @MX 어노테이션 요약 ──
  if (data.semantics?.annotationSummary && data.semantics.annotationSummary.total > 0) {
    const summary = data.semantics.annotationSummary;
    parts.push('<div class="section-sub">@MX 어노테이션</div>');

    // 태그 배지
    parts.push('<div style="display:flex;gap:12px;margin-bottom:16px">');
    const tagOrder = ['ANCHOR', 'WARN', 'NOTE', 'TODO'] as const;
    for (const tag of tagOrder) {
      const count = summary.byTag[tag] ?? 0;
      if (count > 0) {
        const badge = tag === 'WARN' ? 'badge-warn' : tag === 'ANCHOR' ? 'badge-ok' : 'badge-off';
        parts.push(`<span class="badge ${badge}" style="padding:4px 12px">@MX:${tag} ${count}</span>`);
      }
    }
    parts.push('</div>');

    // ANCHOR 테이블
    if (summary.topAnchors.length > 0) {
      parts.push('<table class="data-table"><thead><tr><th>ANCHOR 심볼</th><th>파일</th><th>fan_in</th></tr></thead><tbody>');
      for (const anchor of summary.topAnchors) {
        parts.push(`<tr><td><code>${esc(anchor.symbol)}</code></td><td>${esc(anchor.file)}</td><td>${anchor.fanIn}</td></tr>`);
      }
      parts.push('</tbody></table>');
    }

    // WARN 테이블
    if (summary.warnings.length > 0) {
      parts.push('<table class="data-table" style="margin-top:16px"><thead><tr><th>WARN 심볼</th><th>파일</th><th>사유</th></tr></thead><tbody>');
      for (const warn of summary.warnings) {
        parts.push(`<tr><td><code>${esc(warn.symbol)}</code></td><td>${esc(warn.file)}</td><td>${esc(warn.reason)}</td></tr>`);
      }
      parts.push('</tbody></table>');
    }
  }

  // ── 외부 패키지 테이블 ──
  if (data.semantics && data.semantics.dependencies.external.length > 0) {
    parts.push('<div class="section-sub">외부 패키지 (Top 20)</div>');
    parts.push('<table class="data-table"><thead><tr><th>패키지</th><th>버전</th><th>사용 파일 수</th></tr></thead><tbody>');
    for (const dep of data.semantics.dependencies.external.slice(0, 20)) {
      parts.push(`<tr><td><code>${esc(dep.name)}</code></td><td>${esc(dep.version)}</td><td>${dep.usedBy.length}</td></tr>`);
    }
    parts.push('</tbody></table>');
  }

  // ── 도메인 지식 ──
  if (data.domain) {
    parts.push('<div class="section-sub">도메인 지식</div>');

    // 프로젝트 요약
    if (data.domain.projectSummary) {
      parts.push(`<div class="card" style="margin-bottom:16px"><p style="font-size:.85rem;color:var(--text-secondary)">${esc(data.domain.projectSummary)}</p></div>`);
    }

    // 아키텍처
    parts.push(`<div class="card" style="margin-bottom:16px"><h3 style="font-size:.85rem;font-weight:600;color:var(--text-secondary);margin-bottom:8px">아키텍처: ${esc(data.domain.architecture.style)}</h3>`);
    if (data.domain.architecture.layers.length > 0) {
      parts.push('<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">');
      for (const l of data.domain.architecture.layers) {
        parts.push(`<span class="badge badge-off">${esc(l)}</span>`);
      }
      parts.push('</div>');
    }
    if (data.domain.architecture.entryPoints.length > 0) {
      parts.push('<div style="font-size:.8rem;color:var(--text-muted)">진입점: ');
      parts.push(data.domain.architecture.entryPoints.map(ep => `<code>${esc(ep)}</code>`).join(', '));
      parts.push('</div>');
    }
    parts.push('</div>');

    // 패턴 카드
    if (data.domain.patterns.length > 0) {
      parts.push('<div class="module-grid">');
      for (const p of data.domain.patterns.slice(0, 8)) {
        const desc = p.description.length > 100 ? p.description.slice(0, 100) + '...' : p.description;
        parts.push(`<div class="module-card installed"><div class="module-name">${esc(p.name)}</div><div style="font-size:.8rem;color:var(--text-secondary);margin-top:4px">${esc(desc)}</div><div class="module-meta"><span>${p.files.length} 파일</span></div></div>`);
      }
      parts.push('</div>');
    }

    // 컨벤션 테이블
    if (data.domain.conventions.length > 0) {
      parts.push('<table class="data-table" style="margin-top:16px"><thead><tr><th>카테고리</th><th>규칙</th><th>근거</th></tr></thead><tbody>');
      for (const conv of data.domain.conventions) {
        parts.push(`<tr><td><span class="tag-badge">${esc(conv.category)}</span></td><td>${esc(conv.rule)}</td><td style="font-size:.75rem;color:var(--text-muted)">${esc(conv.evidence.join(', '))}</td></tr>`);
      }
      parts.push('</tbody></table>');
    }
  }

  return parts.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Chart.js 스크립트 (온톨로지 탭용)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 온톨로지 탭의 Chart.js 초기화 스크립트를 반환합니다.
 * dashboard-renderer.ts의 renderChartScript() 내부에서 합쳐서 사용합니다.
 */
export function renderOntologyChartScript(data: OntologyDashboardData): string {
  if (!data.enabled || !data.structure) return '';

  const P = "['#0070f3','#0cce6b','#ee0000','#f5a623','#7928ca','#ff0080','#00d4aa','#3291ff','#ff6b6b','#ffd93d']";

  const langEntries = Object.entries(data.structure.stats.byLanguage).sort(([, a], [, b]) => b - a);
  const langLabels = JSON.stringify(langEntries.map(([k]) => k));
  const langValues = JSON.stringify(langEntries.map(([, v]) => v));

  const extEntries = Object.entries(data.structure.stats.byExtension).sort(([, a], [, b]) => b - a).slice(0, 10);
  const extLabels = JSON.stringify(extEntries.map(([k]) => k));
  const extValues = JSON.stringify(extEntries.map(([, v]) => v));

  return `(function(){
if(typeof Chart==='undefined')return;
var P=${P};
function sc(id,cfg){var el=document.getElementById(id);if(!el)return null;return new Chart(el,cfg);}
var lL=${langLabels},lV=${langValues};
if(lL.length>0)sc('ontologyLangChart',{type:'doughnut',data:{labels:lL,datasets:[{data:lV,backgroundColor:P,borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'right',labels:{boxWidth:10,padding:8,font:{size:11}}}}}});
var eL=${extLabels},eV=${extValues};
if(eL.length>0)sc('ontologyExtChart',{type:'bar',data:{labels:eL,datasets:[{label:'파일 수',data:eV,backgroundColor:'#0070f3'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});
})();`;
}
