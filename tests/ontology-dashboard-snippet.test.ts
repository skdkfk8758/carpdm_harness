import { describe, it, expect } from 'vitest';
import {
  renderOntologyDashboardHtml,
  renderOntologyChartScript,
  type OntologyDashboardData,
} from '../src/core/ontology/dashboard-snippet.js';

// ── 테스트용 fixture ──

function makeStructureLayer() {
  return {
    rootDir: '/test-project',
    tree: { name: 'root', path: '/', type: 'directory' as const, children: [] },
    modules: [
      { source: 'src/a.ts', target: 'src/b.ts', type: 'import' as const },
    ],
    stats: {
      totalFiles: 42,
      totalDirs: 8,
      byLanguage: { typescript: 30, javascript: 10, json: 2 },
      byExtension: { '.ts': 30, '.js': 10, '.json': 2 },
    },
  };
}

function makeSemanticsLayer() {
  return {
    files: [],
    symbols: { byName: {}, exportedCount: 25, totalCount: 80 },
    dependencies: {
      internal: [
        { source: 'src/core/config.ts', target: 'src/types/config.ts', type: 'import' as const },
        { source: 'src/tools/init.ts', target: 'src/core/config.ts', type: 'import' as const },
      ],
      external: [
        { name: 'zod', version: '^3.22.0', usedBy: ['src/tools/init.ts', 'src/tools/sync.ts'] },
        { name: 'vitest', version: '^1.0.0', usedBy: ['tests/test.ts'] },
      ],
    },
    annotationSummary: {
      total: 5,
      byTag: { ANCHOR: 2, WARN: 1, NOTE: 1, TODO: 1 },
      topAnchors: [
        { symbol: 'HarnessConfig', file: 'src/types/config.ts', fanIn: 15 },
      ],
      warnings: [
        { symbol: 'legacyFn', file: 'src/utils/old.ts', reason: 'deprecated' },
      ],
    },
  };
}

function makeDomainLayer() {
  return {
    projectSummary: 'AI 협업 워크플로우 MCP 서버 플러그인',
    architecture: {
      style: 'layered',
      layers: ['tools', 'core', 'types'],
      keyDecisions: ['ESM only'],
      entryPoints: ['src/server.ts'],
    },
    patterns: [
      { name: 'Tool Registration', description: 'MCP 도구 등록 패턴', files: ['src/tools/init.ts'], example: 'registerTool(server)' },
    ],
    conventions: [
      { category: 'naming' as const, rule: 'camelCase 함수명', evidence: ['src/core/*.ts'] },
    ],
    glossary: [
      { term: 'harness', definition: '워크플로우 프레임워크', context: '프로젝트 전반' },
    ],
  };
}

function makeFullData(): OntologyDashboardData {
  return {
    enabled: true,
    layers: ['structure', 'semantics', 'domain'],
    lastBuilt: '2026-02-25T10:00:00Z',
    structure: makeStructureLayer(),
    semantics: makeSemanticsLayer(),
    domain: makeDomainLayer(),
  };
}

// ── 테스트 ──

describe('renderOntologyDashboardHtml', () => {
  it('비활성화 시 안내 메시지를 반환한다', () => {
    const html = renderOntologyDashboardHtml({
      enabled: false,
      layers: [],
      lastBuilt: null,
    });
    expect(html).toContain('온톨로지가 비활성화');
    expect(html).toContain('enableOntology=true');
  });

  it('전체 데이터가 있으면 모든 섹션을 포함한다', () => {
    const html = renderOntologyDashboardHtml(makeFullData());

    // KPI 카드
    expect(html).toContain('42');       // 파일 수
    expect(html).toContain('80');       // 심볼 수
    expect(html).toContain('25');       // 내보낸 심볼

    // 레이어 배지
    expect(html).toContain('Structure');
    expect(html).toContain('Semantics');
    expect(html).toContain('Domain');

    // Chart.js canvas
    expect(html).toContain('ontologyLangChart');
    expect(html).toContain('ontologyExtChart');

    // Mermaid 의존성 그래프
    expect(html).toContain('class="mermaid"');
    expect(html).toContain('graph LR');

    // @MX 어노테이션
    expect(html).toContain('@MX:ANCHOR');
    expect(html).toContain('HarnessConfig');
    expect(html).toContain('legacyFn');

    // 외부 패키지
    expect(html).toContain('zod');
    expect(html).toContain('vitest');

    // 도메인
    expect(html).toContain('AI 협업 워크플로우');
    expect(html).toContain('layered');
    expect(html).toContain('Tool Registration');
    expect(html).toContain('camelCase');
  });

  it('structure만 있으면 의존성/도메인 섹션 없이 렌더링한다', () => {
    const html = renderOntologyDashboardHtml({
      enabled: true,
      layers: ['structure'],
      lastBuilt: '2026-02-25T10:00:00Z',
      structure: makeStructureLayer(),
    });

    expect(html).toContain('42');                // 파일 수
    expect(html).toContain('ontologyLangChart');  // 차트
    expect(html).not.toContain('class="mermaid"'); // Mermaid 없음
    expect(html).not.toContain('도메인 지식');      // 도메인 없음
  });

  it('@MX 어노테이션이 없으면 해당 섹션을 건너뛴다', () => {
    const data = makeFullData();
    data.semantics!.annotationSummary = undefined;
    const html = renderOntologyDashboardHtml(data);

    expect(html).not.toContain('@MX:ANCHOR');
    expect(html).toContain('의존성 그래프'); // 다른 섹션은 정상
  });

  it('마지막 빌드 시간을 표시한다', () => {
    const html = renderOntologyDashboardHtml(makeFullData());
    expect(html).toContain('2026-02-25');
  });

  it('XSS 방지를 위해 HTML을 이스케이프한다', () => {
    const data = makeFullData();
    data.domain!.projectSummary = '<script>alert("xss")</script>';
    const html = renderOntologyDashboardHtml(data);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderOntologyChartScript', () => {
  it('비활성화 시 빈 문자열을 반환한다', () => {
    const script = renderOntologyChartScript({
      enabled: false,
      layers: [],
      lastBuilt: null,
    });
    expect(script).toBe('');
  });

  it('structure 없으면 빈 문자열을 반환한다', () => {
    const script = renderOntologyChartScript({
      enabled: true,
      layers: ['structure'],
      lastBuilt: null,
    });
    expect(script).toBe('');
  });

  it('유효한 Chart.js 초기화 스크립트를 반환한다', () => {
    const script = renderOntologyChartScript(makeFullData());

    expect(script).toContain('ontologyLangChart');
    expect(script).toContain('ontologyExtChart');
    expect(script).toContain('typescript');
    expect(script).toContain('doughnut');
    expect(script).toContain('Chart');
  });
});
