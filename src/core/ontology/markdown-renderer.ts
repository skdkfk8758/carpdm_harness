import type {
  OntologyData,
  StructureLayer,
  SemanticsLayer,
  DomainLayer,
  DirectoryNode,
  OntologyMetadata,
  OntologyIndexData,
} from '../../types/ontology.js';

// ────────────────────────────────────────────────────────────────────────────
// 내부 유틸
// ────────────────────────────────────────────────────────────────────────────

/** 메타데이터 헤더 생성 */
function renderMetaHeader(metadata: OntologyMetadata): string {
  return `> Generated: ${metadata.generatedAt} | carpdm-harness v${metadata.harnessVersion}\n`;
}

/** 디렉토리 트리를 들여쓰기 텍스트로 렌더링 */
function renderDirectoryTree(node: DirectoryNode, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  const suffix = node.type === 'directory' ? '/' : '';
  let result = `${indent}${node.name}${suffix}\n`;

  for (const child of node.children ?? []) {
    result += renderDirectoryTree(child, depth + 1);
  }

  return result;
}

/** 숫자를 천 단위 구분자로 포맷 */
function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR');
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 1: Structure Markdown
// ────────────────────────────────────────────────────────────────────────────

/** ONTOLOGY-STRUCTURE.md 렌더링 */
export function renderStructureMarkdown(
  layer: StructureLayer,
  metadata: OntologyMetadata,
): string {
  const lines: string[] = [];

  lines.push('# ONTOLOGY-STRUCTURE');
  lines.push('');
  lines.push(renderMetaHeader(metadata));
  lines.push('');

  // Overview 통계
  lines.push('## Overview');
  lines.push('');
  lines.push(`| 항목 | 값 |`);
  lines.push(`|------|-----|`);
  lines.push(`| 루트 디렉토리 | \`${layer.rootDir}\` |`);
  lines.push(`| 전체 파일 수 | ${fmtNum(layer.stats.totalFiles)} |`);
  lines.push(`| 전체 디렉토리 수 | ${fmtNum(layer.stats.totalDirs)} |`);
  lines.push(`| 모듈 관계 수 | ${fmtNum(layer.modules.length)} |`);
  lines.push('');

  // 언어별 통계
  lines.push('## Statistics');
  lines.push('');
  lines.push('### 언어별 파일 수');
  lines.push('');
  lines.push('| 언어 | 파일 수 |');
  lines.push('|------|---------|');
  for (const [lang, count] of Object.entries(layer.stats.byLanguage).sort(([, a], [, b]) => b - a)) {
    lines.push(`| ${lang} | ${fmtNum(count)} |`);
  }
  lines.push('');

  lines.push('### 확장자별 파일 수');
  lines.push('');
  lines.push('| 확장자 | 파일 수 |');
  lines.push('|--------|---------|');
  for (const [ext, count] of Object.entries(layer.stats.byExtension).sort(([, a], [, b]) => b - a)) {
    lines.push(`| \`${ext}\` | ${fmtNum(count)} |`);
  }
  lines.push('');

  // Directory Tree
  lines.push('## Directory Tree');
  lines.push('');
  lines.push('```');
  lines.push(renderDirectoryTree(layer.tree).trimEnd());
  lines.push('```');
  lines.push('');

  // Module Relations (상위 50개)
  lines.push('## Module Relations');
  lines.push('');
  const topModules = layer.modules.slice(0, 50);
  if (topModules.length === 0) {
    lines.push('_(모듈 관계 없음)_');
  } else {
    lines.push('| Source | Target | Type |');
    lines.push('|--------|--------|------|');
    for (const rel of topModules) {
      lines.push(`| \`${rel.source}\` | \`${rel.target}\` | ${rel.type} |`);
    }
    if (layer.modules.length > 50) {
      lines.push(`\n_...총 ${fmtNum(layer.modules.length)}개 중 50개 표시_`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 2: Semantics Markdown
// ────────────────────────────────────────────────────────────────────────────

/** ONTOLOGY-SEMANTICS.md 렌더링 */
export function renderSemanticsMarkdown(
  layer: SemanticsLayer,
  metadata: OntologyMetadata,
): string {
  const lines: string[] = [];

  lines.push('# ONTOLOGY-SEMANTICS');
  lines.push('');
  lines.push(renderMetaHeader(metadata));
  lines.push('');

  // Overview
  lines.push('## Overview');
  lines.push('');
  lines.push(`| 항목 | 값 |`);
  lines.push(`|------|-----|`);
  lines.push(`| 분석된 파일 수 | ${fmtNum(layer.files.length)} |`);
  lines.push(`| 총 심볼 수 | ${fmtNum(layer.symbols.totalCount)} |`);
  lines.push(`| 내보낸 심볼 수 | ${fmtNum(layer.symbols.exportedCount)} |`);
  lines.push(`| 내부 의존성 수 | ${fmtNum(layer.dependencies.internal.length)} |`);
  lines.push(`| 외부 패키지 수 | ${fmtNum(layer.dependencies.external.length)} |`);
  lines.push('');

  // Symbol Index — 인터페이스
  const interfaceSymbols = Object.entries(layer.symbols.byName)
    .filter(([, entries]) => entries.some((e) => e.kind === 'interface'))
    .slice(0, 30);

  if (interfaceSymbols.length > 0) {
    lines.push('## Symbol Index — Interfaces');
    lines.push('');
    lines.push('| 이름 | 파일 | 줄 |');
    lines.push('|------|------|-----|');
    for (const [name, entries] of interfaceSymbols) {
      const e = entries[0];
      lines.push(`| \`${name}\` | \`${e.file}\` | ${e.line} |`);
    }
    lines.push('');
  }

  // Symbol Index — 함수
  const functionSymbols = Object.entries(layer.symbols.byName)
    .filter(([, entries]) => entries.some((e) => e.kind === 'function'))
    .slice(0, 30);

  if (functionSymbols.length > 0) {
    lines.push('## Symbol Index — Functions');
    lines.push('');
    lines.push('| 이름 | 파일 | 줄 |');
    lines.push('|------|------|-----|');
    for (const [name, entries] of functionSymbols) {
      const e = entries[0];
      lines.push(`| \`${name}\` | \`${e.file}\` | ${e.line} |`);
    }
    lines.push('');
  }

  // Symbol Index — 상수
  const constantSymbols = Object.entries(layer.symbols.byName)
    .filter(([, entries]) => entries.some((e) => e.kind === 'constant'))
    .slice(0, 20);

  if (constantSymbols.length > 0) {
    lines.push('## Symbol Index — Constants');
    lines.push('');
    lines.push('| 이름 | 파일 | 줄 |');
    lines.push('|------|------|-----|');
    for (const [name, entries] of constantSymbols) {
      const e = entries[0];
      lines.push(`| \`${name}\` | \`${e.file}\` | ${e.line} |`);
    }
    lines.push('');
  }

  // Dependency Graph (Mermaid)
  lines.push('## Dependency Graph');
  lines.push('');
  const internalDeps = layer.dependencies.internal;
  if (internalDeps.length === 0) {
    lines.push('_(내부 의존성 없음)_');
  } else {
    // 50개 초과 시 주요 모듈만
    const displayDeps = internalDeps.length > 50 ? internalDeps.slice(0, 50) : internalDeps;
    lines.push('```mermaid');
    lines.push('graph LR');
    const nodeSet = new Set<string>();
    for (const rel of displayDeps) {
      // 노드 ID에서 특수문자 제거
      const srcId = rel.source.replace(/[^a-zA-Z0-9_]/g, '_');
      const tgtId = rel.target.replace(/[^a-zA-Z0-9_]/g, '_');
      const srcLabel = rel.source.split('/').pop() ?? rel.source;
      const tgtLabel = rel.target.split('/').pop() ?? rel.target;
      if (!nodeSet.has(srcId)) {
        lines.push(`  ${srcId}["${srcLabel}"]`);
        nodeSet.add(srcId);
      }
      if (!nodeSet.has(tgtId)) {
        lines.push(`  ${tgtId}["${tgtLabel}"]`);
        nodeSet.add(tgtId);
      }
      lines.push(`  ${srcId} --> ${tgtId}`);
    }
    if (internalDeps.length > 50) {
      lines.push(`  %% ...총 ${fmtNum(internalDeps.length)}개 중 50개 표시`);
    }
    lines.push('```');
  }
  lines.push('');

  // Import Summary 테이블
  lines.push('## Import Summary');
  lines.push('');
  lines.push('| 패키지 | 버전 | 사용 파일 수 |');
  lines.push('|--------|------|-------------|');
  for (const dep of layer.dependencies.external.slice(0, 30)) {
    lines.push(`| \`${dep.name}\` | ${dep.version} | ${dep.usedBy.length} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 3: Domain Markdown
// ────────────────────────────────────────────────────────────────────────────

/** ONTOLOGY-DOMAIN.md 렌더링 */
export function renderDomainMarkdown(
  layer: DomainLayer,
  metadata: OntologyMetadata,
): string {
  const lines: string[] = [];

  lines.push('# ONTOLOGY-DOMAIN');
  lines.push('');
  lines.push(renderMetaHeader(metadata));
  lines.push('');

  // Project Summary
  lines.push('## Project Summary');
  lines.push('');
  lines.push(layer.projectSummary || '_(요약 없음)_');
  lines.push('');

  // Architecture
  lines.push('## Architecture');
  lines.push('');
  lines.push(`**스타일**: ${layer.architecture.style}`);
  lines.push('');

  if (layer.architecture.layers.length > 0) {
    lines.push('**계층 구조**:');
    for (const l of layer.architecture.layers) {
      lines.push(`- ${l}`);
    }
    lines.push('');
  }

  if (layer.architecture.keyDecisions.length > 0) {
    lines.push('**핵심 결정**:');
    for (const d of layer.architecture.keyDecisions) {
      lines.push(`- ${d}`);
    }
    lines.push('');
  }

  if (layer.architecture.entryPoints.length > 0) {
    lines.push('**진입점**:');
    for (const ep of layer.architecture.entryPoints) {
      lines.push(`- \`${ep}\``);
    }
    lines.push('');
  }

  // Detected Patterns
  lines.push('## Detected Patterns');
  lines.push('');
  if (layer.patterns.length === 0) {
    lines.push('_(감지된 패턴 없음)_');
  } else {
    for (const pattern of layer.patterns) {
      lines.push(`### ${pattern.name}`);
      lines.push('');
      lines.push(pattern.description);
      if (pattern.files.length > 0) {
        lines.push('');
        lines.push('**관련 파일**:');
        for (const f of pattern.files) {
          lines.push(`- \`${f}\``);
        }
      }
      if (pattern.example) {
        lines.push('');
        lines.push('**예시**:');
        lines.push('```');
        lines.push(pattern.example);
        lines.push('```');
      }
      lines.push('');
    }
  }

  // Coding Conventions 테이블
  lines.push('## Coding Conventions');
  lines.push('');
  if (layer.conventions.length === 0) {
    lines.push('_(컨벤션 없음)_');
  } else {
    lines.push('| 카테고리 | 규칙 | 근거 |');
    lines.push('|---------|------|------|');
    for (const conv of layer.conventions) {
      const evidence = conv.evidence.join(', ');
      lines.push(`| ${conv.category} | ${conv.rule} | ${evidence} |`);
    }
  }
  lines.push('');

  // Glossary 테이블
  lines.push('## Glossary');
  lines.push('');
  if (layer.glossary.length === 0) {
    lines.push('_(용어집 없음)_');
  } else {
    lines.push('| 용어 | 정의 | 맥락 |');
    lines.push('|------|------|------|');
    for (const entry of layer.glossary) {
      lines.push(`| **${entry.term}** | ${entry.definition} | ${entry.context} |`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// 공개 API — 전체 렌더링
// ────────────────────────────────────────────────────────────────────────────

/**
 * 전체 온톨로지 Markdown 렌더링
 * structure / semantics / domain 각 파일 내용을 반환합니다.
 */
export function renderOntologyMarkdown(data: OntologyData): {
  structure: string;
  semantics: string;
  domain: string;
} {
  const structure = data.structure
    ? renderStructureMarkdown(data.structure, data.metadata)
    : `# ONTOLOGY-STRUCTURE\n\n_(Layer 비활성화 또는 빌드 실패)_\n`;

  const semantics = data.semantics
    ? renderSemanticsMarkdown(data.semantics, data.metadata)
    : `# ONTOLOGY-SEMANTICS\n\n_(Layer 비활성화 또는 빌드 실패)_\n`;

  const domain = data.domain
    ? renderDomainMarkdown(data.domain, data.metadata)
    : `# ONTOLOGY-DOMAIN\n\n_(Layer 비활성화 또는 빌드 실패)_\n`;

  return { structure, semantics, domain };
}

// ────────────────────────────────────────────────────────────────────────────
// ONTOLOGY-INDEX.md 렌더링
// ────────────────────────────────────────────────────────────────────────────

/** ONTOLOGY-INDEX.md 렌더링 — .agent/ 전체 지식 인덱스 */
export function renderIndexMarkdown(data: OntologyIndexData): string {
  const lines: string[] = [];

  lines.push('# ONTOLOGY-INDEX');
  lines.push('');
  lines.push(`> Generated: ${data.generatedAt} | carpdm-harness v${data.harnessVersion}`);
  lines.push('');
  lines.push('`.agent/` 디렉토리의 전체 지식 인덱스입니다.');
  lines.push('');

  // Agent Files 섹션
  lines.push('## Agent Files (수동 편집)');
  lines.push('');
  lines.push('| 파일 | 상태 | 관리 | 설명 |');
  lines.push('|------|------|------|------|');
  for (const file of data.agentFiles) {
    const statusIcon = file.status === 'exists' ? '✅' : file.status === 'missing' ? '❌' : '🔄';
    lines.push(`| \`${file.path}\` | ${statusIcon} ${file.status} | ${file.managed} | ${file.description} |`);
  }
  lines.push('');

  // Ontology Files 섹션
  lines.push('## Ontology Files (자동 생성)');
  lines.push('');
  lines.push('| 파일 | 상태 | 관리 | 설명 |');
  lines.push('|------|------|------|------|');
  for (const file of data.ontologyFiles) {
    const statusIcon = file.status === 'exists' ? '✅' : file.status === 'missing' ? '❌' : '🔄';
    lines.push(`| \`${file.path}\` | ${statusIcon} ${file.status} | ${file.managed} | ${file.description} |`);
  }
  lines.push('');

  // Quick Reference
  lines.push('## Quick Reference');
  lines.push('');
  lines.push('| 용도 | 파일 |');
  lines.push('|------|------|');
  lines.push('| 작업 계획 수립 | `.agent/plan.md` |');
  lines.push('| TODO 추적 | `.agent/todo.md` |');
  lines.push('| 결정/맥락 기록 | `.agent/context.md` |');
  lines.push('| 팀 학습 내역 | `.agent/memory.md` |');
  lines.push('| 디렉토리 구조 | `.agent/ontology/ONTOLOGY-STRUCTURE.md` |');
  lines.push('| 코드 심볼 인덱스 | `.agent/ontology/ONTOLOGY-SEMANTICS.md` |');
  lines.push('| 도메인 지식 | `.agent/ontology/ONTOLOGY-DOMAIN.md` |');
  lines.push('');

  return lines.join('\n');
}
