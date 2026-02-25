import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type MemoryCategory = 'conventions' | 'patterns' | 'decisions' | 'mistakes' | 'bugs';
export type ConventionSubcategory = 'naming' | 'structure' | 'error-handling' | 'other';
export type BugSubcategory = 'ui' | 'data' | 'api' | 'perf' | 'crash' | 'logic' | 'other';
export type BugStatus = 'open' | 'resolved' | 'wontfix';
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  subcategory?: ConventionSubcategory | BugSubcategory;
  title: string;
  content: string;
  evidence?: string[];
  addedAt: string;
  // Bug tracking fields (bugs 카테고리 전용, backward compatible)
  status?: BugStatus;
  severity?: BugSeverity;
  rootCause?: string;
  resolution?: string;
  linkedIssue?: string;
  affectedFiles?: string[];
}

export interface TeamMemoryStore {
  version: string;
  entries: MemoryEntry[];
}

const STORE_PATH = (projectRoot: string) =>
  join(projectRoot, '.harness', 'team-memory.json');

const RULE_PATHS: Record<MemoryCategory, string> = {
  conventions: '.claude/rules/conventions.md',
  patterns:    '.claude/rules/patterns.md',
  decisions:   '.claude/rules/decisions.md',
  mistakes:    '.claude/rules/mistakes.md',
  bugs:        '.claude/rules/bugs.md',
};

const MARKERS: Record<string, string> = {
  'conventions:naming':        '<!-- harness:conventions:naming -->',
  'conventions:structure':     '<!-- harness:conventions:structure -->',
  'conventions:error-handling':'<!-- harness:conventions:error-handling -->',
  'conventions:other':         '<!-- harness:conventions:other -->',
  'patterns':                  '<!-- harness:patterns:list -->',
  'decisions':                 '<!-- harness:decisions:list -->',
  'mistakes':                  '<!-- harness:mistakes:list -->',
  'bugs':                      '<!-- harness:bugs:list -->',
};

function markerKey(entry: MemoryEntry): string {
  if (entry.category === 'conventions' && entry.subcategory) {
    return `conventions:${entry.subcategory}`;
  }
  return entry.category;
}

export function loadStore(projectRoot: string): TeamMemoryStore {
  const path = STORE_PATH(projectRoot);
  if (!existsSync(path)) {
    return { version: '1.0.0', entries: [] };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as TeamMemoryStore;
  } catch {
    return { version: '1.0.0', entries: [] };
  }
}

function saveStore(projectRoot: string, store: TeamMemoryStore): void {
  const path = STORE_PATH(projectRoot);
  mkdirSync(join(projectRoot, '.harness'), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2) + '\n');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function addEntry(
  projectRoot: string,
  params: {
    category: MemoryCategory;
    subcategory?: ConventionSubcategory | BugSubcategory;
    title: string;
    content: string;
    evidence?: string[];
    status?: BugStatus;
    severity?: BugSeverity;
    rootCause?: string;
    resolution?: string;
    linkedIssue?: string;
    affectedFiles?: string[];
  },
): MemoryEntry {
  const store = loadStore(projectRoot);
  const entry: MemoryEntry = {
    id: generateId(),
    category: params.category,
    subcategory: params.subcategory,
    title: params.title,
    content: params.content,
    evidence: params.evidence,
    addedAt: new Date().toISOString(),
    ...(params.status && { status: params.status }),
    ...(params.severity && { severity: params.severity }),
    ...(params.rootCause && { rootCause: params.rootCause }),
    ...(params.resolution && { resolution: params.resolution }),
    ...(params.linkedIssue && { linkedIssue: params.linkedIssue }),
    ...(params.affectedFiles && { affectedFiles: params.affectedFiles }),
  };
  store.entries.push(entry);
  saveStore(projectRoot, store);
  syncRuleFile(projectRoot, entry.category, store);
  syncMemoryMd(projectRoot, store);
  return entry;
}

export function listEntries(
  projectRoot: string,
  category: MemoryCategory | 'all',
  filters?: { status?: BugStatus; severity?: BugSeverity },
): MemoryEntry[] {
  const store = loadStore(projectRoot);
  let entries = category === 'all' ? store.entries : store.entries.filter(e => e.category === category);
  if (filters?.status) {
    entries = entries.filter(e => e.status === filters.status);
  }
  if (filters?.severity) {
    entries = entries.filter(e => e.severity === filters.severity);
  }
  return entries;
}

/**
 * 규칙 마크다운 파일의 마커 위치에 항목을 삽입합니다.
 * 파일이 없으면 조용히 무시합니다.
 */
function syncRuleFile(
  projectRoot: string,
  category: MemoryCategory,
  store: TeamMemoryStore,
): void {
  const relPath = RULE_PATHS[category];
  const filePath = join(projectRoot, relPath);
  if (!existsSync(filePath)) return;

  let content = readFileSync(filePath, 'utf-8');

  // 해당 카테고리의 항목을 마커별로 그룹화
  const byMarker: Record<string, MemoryEntry[]> = {};
  for (const entry of store.entries.filter(e => e.category === category)) {
    const key = markerKey(entry);
    if (!byMarker[key]) byMarker[key] = [];
    byMarker[key].push(entry);
  }

  // 각 마커를 항목 목록으로 교체
  for (const [key, marker] of Object.entries(MARKERS)) {
    if (!key.startsWith(category === 'conventions' ? 'conventions' : category)) continue;
    const entries = byMarker[key] ?? [];
    const rendered = entries.length === 0
      ? marker
      : entries.map(e => renderEntry(e)).join('\n\n') + '\n\n' + marker;
    content = content.replace(marker, rendered);
  }

  writeFileSync(filePath, content);
}

/**
 * .agent/memory.md 파일에 팀 메모리를 동기화합니다.
 * <!-- team-memory:{category}:start --> ~ <!-- team-memory:{category}:end --> 마커 사이를 교체합니다.
 */
export function syncMemoryMd(projectRoot: string, store: TeamMemoryStore): void {
  const memoryPath = join(projectRoot, '.agent', 'memory.md');
  if (!existsSync(memoryPath)) return;

  let content = readFileSync(memoryPath, 'utf-8');

  const categories: MemoryCategory[] = ['conventions', 'patterns', 'decisions', 'mistakes', 'bugs'];

  for (const category of categories) {
    const startMarker = `<!-- team-memory:${category}:start -->`;
    const endMarker = `<!-- team-memory:${category}:end -->`;

    const startIdx = content.indexOf(startMarker);
    const endIdx = content.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1) continue;

    const entries = store.entries.filter(e => e.category === category);
    let rendered: string;
    if (entries.length === 0) {
      rendered = `${startMarker}\n_(등록된 ${categoryLabel(category)} 없음)_\n${endMarker}`;
    } else {
      const items = entries.map(e => renderEntry(e)).join('\n\n');
      rendered = `${startMarker}\n${items}\n${endMarker}`;
    }

    content = content.substring(0, startIdx) + rendered + content.substring(endIdx + endMarker.length);
  }

  // 마지막 동기화 시각 업데이트
  content = content.replace(
    /> 마지막 동기화: .*/,
    `> 마지막 동기화: ${new Date().toISOString().slice(0, 19)}`,
  );

  writeFileSync(memoryPath, content);
}

function categoryLabel(category: MemoryCategory): string {
  const labels: Record<MemoryCategory, string> = {
    conventions: '컨벤션',
    patterns: '패턴',
    decisions: '결정',
    mistakes: '실수',
    bugs: '버그',
  };
  return labels[category];
}

function renderEntry(entry: MemoryEntry): string {
  const lines: string[] = [`### ${entry.title}`, '', entry.content];
  // Bug tracking metadata
  if (entry.category === 'bugs') {
    const meta: string[] = [];
    if (entry.severity) meta.push(`심각도: ${entry.severity}`);
    if (entry.status) meta.push(`상태: ${entry.status}`);
    if (entry.linkedIssue) meta.push(`이슈: ${entry.linkedIssue}`);
    if (meta.length > 0) lines.push('', `> ${meta.join(' | ')}`);
    if (entry.rootCause) lines.push('', `**원인**: ${entry.rootCause}`);
    if (entry.resolution) lines.push('', `**해결**: ${entry.resolution}`);
    if (entry.affectedFiles && entry.affectedFiles.length > 0) {
      lines.push('', `_영향 파일: ${entry.affectedFiles.join(', ')}_`);
    }
  }
  if (entry.evidence && entry.evidence.length > 0) {
    lines.push('', `_근거: ${entry.evidence.join(', ')}_`);
  }
  lines.push('', `_추가: ${entry.addedAt.slice(0, 10)}_`);
  return lines.join('\n');
}
