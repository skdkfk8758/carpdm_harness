/**
 * Knowledge Vault — 로컬 지식 베이스 (.knowledge/)
 *
 * 프로젝트의 설계 문서, 스펙, 결정 이력을 브랜치/도메인 기준으로 관리.
 * Obsidian vault로 열 수 있으나, Obsidian 없이도 마크다운 폴더로 동작.
 */

import { existsSync, readdirSync, renameSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ensureDir, safeWriteFile, readFileContent } from './file-ops.js';
import {
  knowledgeDir,
  knowledgeBranchesDir,
  knowledgeBranchDir,
  knowledgeArchiveDir,
  knowledgeDomainsDir,
  knowledgeOntologyDir,
  knowledgeTemplatesDir,
  knowledgeIndexPath,
  sanitizeBranchName,
} from './omc-compat.js';
import type { KnowledgeConfig } from '../types/config.js';
import type { TeamMemoryStore, MemoryEntry } from './team-memory.js';

// ============================================================
// Vault 초기화
// ============================================================

/** vault 디렉토리 구조 생성 (harness_init 시 호출) */
export function initKnowledgeVault(projectRoot: string, config: KnowledgeConfig): void {
  if (!config.enabled) return;

  const dirs = [
    knowledgeDir(projectRoot),
    knowledgeBranchesDir(projectRoot),
    knowledgeArchiveDir(projectRoot),
    knowledgeDomainsDir(projectRoot),
    knowledgeOntologyDir(projectRoot),
    knowledgeTemplatesDir(projectRoot),
  ];

  for (const dir of dirs) {
    ensureDir(dir);
  }

  // 템플릿 파일 복사
  const templateSrcDir = getKnowledgeTemplatesSourceDir();
  if (templateSrcDir && existsSync(templateSrcDir)) {
    const templateFiles = readdirSync(templateSrcDir).filter(f => f.endsWith('.md'));
    for (const file of templateFiles) {
      const dest = join(knowledgeTemplatesDir(projectRoot), file);
      if (!existsSync(dest)) {
        const content = readFileSync(join(templateSrcDir, file), 'utf-8');
        safeWriteFile(dest, content);
      }
    }
  }

  // 초기 인덱스 생성
  updateKnowledgeIndex(projectRoot);
}

// ============================================================
// 브랜치 문서 관리
// ============================================================

/** 브랜치 작업 폴더 생성 (work-start 시 호출) */
export function createBranchKnowledge(projectRoot: string, branchName: string): void {
  const branchDir = knowledgeBranchDir(projectRoot, branchName);
  if (existsSync(branchDir)) return;

  ensureDir(branchDir);

  const sanitized = sanitizeBranchName(branchName);
  const now = new Date().toISOString().slice(0, 10);

  const files: Record<string, string> = {
    'spec.md': [
      '---',
      `branch: ${branchName}`,
      `created: ${now}`,
      'type: spec',
      '---',
      '',
      `# ${sanitized} — 스펙`,
      '',
      '## 목표',
      '',
      '',
      '## 요구사항',
      '',
      '',
      '## 제약사항',
      '',
      '',
    ].join('\n'),
    'design.md': [
      '---',
      `branch: ${branchName}`,
      `created: ${now}`,
      'type: design',
      '---',
      '',
      `# ${sanitized} — 설계`,
      '',
      '## 아키텍처 결정',
      '',
      '',
      '## 주요 컴포넌트',
      '',
      '',
      '## 데이터 흐름',
      '',
      '',
    ].join('\n'),
    'decisions.md': [
      '---',
      `branch: ${branchName}`,
      `created: ${now}`,
      'type: decisions',
      '---',
      '',
      `# ${sanitized} — 결정 기록`,
      '',
      '<!-- 각 결정은 ## Decision: 제목 형식으로 추가 -->',
      '',
    ].join('\n'),
    'notes.md': [
      '---',
      `branch: ${branchName}`,
      `created: ${now}`,
      'type: notes',
      '---',
      '',
      `# ${sanitized} — 메모`,
      '',
    ].join('\n'),
  };

  for (const [filename, content] of Object.entries(files)) {
    safeWriteFile(join(branchDir, filename), content);
  }

  updateKnowledgeIndex(projectRoot);
}

/** 브랜치 작업 폴더 아카이브 (work-finish 시 호출) */
export function archiveBranchKnowledge(projectRoot: string, branchName: string): void {
  const branchDir = knowledgeBranchDir(projectRoot, branchName);
  if (!existsSync(branchDir)) return;

  const archiveDir = knowledgeArchiveDir(projectRoot);
  ensureDir(archiveDir);

  const dest = join(archiveDir, sanitizeBranchName(branchName));
  if (existsSync(dest)) return; // 이미 아카이브됨

  renameSync(branchDir, dest);
  updateKnowledgeIndex(projectRoot);
}

/** 브랜치 vault 문서 요약 읽기 (prompt-enricher 시 호출) */
export function readBranchContext(projectRoot: string, branchName: string): string | null {
  const branchDir = knowledgeBranchDir(projectRoot, branchName);
  if (!existsSync(branchDir)) return null;

  const lines: string[] = [`[Knowledge Context]`, `Branch: ${branchName}`];
  const MAX_LINES_PER_FILE = 15;
  const targetFiles = ['design.md', 'decisions.md', 'spec.md'];

  for (const filename of targetFiles) {
    const filePath = join(branchDir, filename);
    const content = readFileContent(filePath);
    if (!content) continue;

    // 프론트매터 제거 후 비어있지 않은 본문만 추출
    const body = stripFrontmatter(content).trim();
    if (!body || body.split('\n').length <= 2) continue;

    const truncated = body.split('\n').slice(0, MAX_LINES_PER_FILE).join('\n');
    lines.push('', `--- ${filename} ---`, truncated);
  }

  // 유의미한 컨텐츠가 없으면 null
  if (lines.length <= 2) return null;

  return lines.join('\n');
}

// ============================================================
// 인덱스 관리
// ============================================================

/** vault 전체 인덱스 재생성 */
export function updateKnowledgeIndex(projectRoot: string): void {
  const indexPath = knowledgeIndexPath(projectRoot);
  const lines: string[] = [
    '---',
    'type: index',
    `updated: ${new Date().toISOString().slice(0, 19)}`,
    '---',
    '',
    '# Knowledge Vault',
    '',
  ];

  // 활성 브랜치 목록
  const branchesDir = knowledgeBranchesDir(projectRoot);
  const activeBranches = listSubdirs(branchesDir).filter(d => d !== '_archive');
  lines.push('## 활성 브랜치', '');
  if (activeBranches.length === 0) {
    lines.push('_(없음)_', '');
  } else {
    for (const b of activeBranches) {
      lines.push(`- [[branches/${b}/design|${b}]]`);
    }
    lines.push('');
  }

  // 아카이브 브랜치
  const archiveDir = knowledgeArchiveDir(projectRoot);
  const archivedBranches = listSubdirs(archiveDir);
  lines.push('## 아카이브', '');
  if (archivedBranches.length === 0) {
    lines.push('_(없음)_', '');
  } else {
    for (const b of archivedBranches.slice(-10)) { // 최근 10개만
      lines.push(`- [[branches/_archive/${b}/design|${b}]]`);
    }
    if (archivedBranches.length > 10) {
      lines.push(`- _...외 ${archivedBranches.length - 10}개_`);
    }
    lines.push('');
  }

  // 도메인 목록
  const domainsDir = knowledgeDomainsDir(projectRoot);
  const domains = listSubdirs(domainsDir);
  lines.push('## 도메인', '');
  if (domains.length === 0) {
    lines.push('_(없음)_', '');
  } else {
    for (const d of domains) {
      lines.push(`- [[domains/${d}/overview|${d}]]`);
    }
    lines.push('');
  }

  // 온톨로지
  const ontologyDir = knowledgeOntologyDir(projectRoot);
  if (existsSync(ontologyDir)) {
    lines.push('## 온톨로지', '');
    lines.push('- [[ontology/structure|Structure]]');
    lines.push('- [[ontology/semantics|Semantics]]');
    lines.push('- [[ontology/domain|Domain]]');
    lines.push('');
  }

  safeWriteFile(indexPath, lines.join('\n'));
}

// ============================================================
// 온톨로지 Vault 동기화
// ============================================================

/** .agent/ontology/ → .knowledge/ontology/ 복사 (프론트매터 추가) */
export function syncOntologyToVault(projectRoot: string): void {
  const sourceDir = join(projectRoot, '.agent', 'ontology');
  const destDir = knowledgeOntologyDir(projectRoot);
  if (!existsSync(sourceDir) || !existsSync(knowledgeDir(projectRoot))) return;

  ensureDir(destDir);
  const now = new Date().toISOString();

  const layerMap: Record<string, string> = {
    'ONTOLOGY-STRUCTURE.md': 'structure.md',
    'ONTOLOGY-SEMANTICS.md': 'semantics.md',
    'ONTOLOGY-DOMAIN.md': 'domain.md',
  };

  for (const [src, dest] of Object.entries(layerMap)) {
    const srcPath = join(sourceDir, src);
    const content = readFileContent(srcPath);
    if (!content) continue;

    const frontmatter = [
      '---',
      'type: ontology',
      `layer: ${dest.replace('.md', '')}`,
      `synced: ${now}`,
      `source: .agent/ontology/${src}`,
      '---',
      '',
    ].join('\n');

    safeWriteFile(join(destDir, dest), frontmatter + content);
  }
}

/** .agent/ontology/ → docs/ontology/ 팀 공유 스냅샷 (git-tracked) */
export function publishOntologyDocs(projectRoot: string): void {
  const sourceDir = join(projectRoot, '.agent', 'ontology');
  const destDir = join(projectRoot, 'docs', 'ontology');
  if (!existsSync(sourceDir)) return;

  ensureDir(destDir);

  const files = ['ONTOLOGY-STRUCTURE.md', 'ONTOLOGY-SEMANTICS.md', 'ONTOLOGY-DOMAIN.md', 'ONTOLOGY-INDEX.md'];
  for (const file of files) {
    const srcPath = join(sourceDir, file);
    const content = readFileContent(srcPath);
    if (!content) continue;
    safeWriteFile(join(destDir, file), content);
  }
}

// ============================================================
// Auto-Memory 동기화
// ============================================================

/** team-memory → auto-memory MEMORY.md 컴팩트 동기화 */
export function syncAutoMemory(projectRoot: string, store: TeamMemoryStore): void {
  const memoryDir = resolveAutoMemoryDir(projectRoot);
  if (!memoryDir) return;

  const memoryPath = join(memoryDir, 'MEMORY.md');
  const existing = readFileContent(memoryPath);
  if (!existing) return; // auto-memory가 없으면 생성하지 않음 (Claude Code 관리)

  const startMarker = '<!-- harness:team-knowledge:start -->';
  const endMarker = '<!-- harness:team-knowledge:end -->';

  const summary = renderAutoMemorySummary(store);
  const section = `${startMarker}\n${summary}\n${endMarker}`;

  let updated: string;
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    // 기존 섹션 교체
    updated = existing.substring(0, startIdx) + section + existing.substring(endIdx + endMarker.length);
  } else {
    // 끝에 섹션 추가
    updated = existing.trimEnd() + '\n\n' + section + '\n';
  }

  safeWriteFile(memoryPath, updated);
}

// ============================================================
// 내부 유틸리티
// ============================================================

function getKnowledgeTemplatesSourceDir(): string | null {
  // 플러그인 패키지 내 templates/knowledge/ 탐색
  const candidates = [
    join(__dirname, '..', '..', 'templates', 'knowledge'),
    join(__dirname, '..', 'templates', 'knowledge'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function listSubdirs(dirPath: string): string[] {
  if (!existsSync(dirPath)) return [];
  try {
    return readdirSync(dirPath)
      .filter(name => !name.startsWith('.'))
      .filter(name => {
        try {
          return statSync(join(dirPath, name)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) return content;
  return content.substring(endIdx + 3);
}

function resolveAutoMemoryDir(projectRoot: string): string | null {
  // ~/.claude/projects/{encoded-path}/memory/
  const encoded = projectRoot.replace(/\//g, '-');
  const dir = join(homedir(), '.claude', 'projects', encoded, 'memory');
  if (existsSync(dir)) return dir;
  return null;
}

function renderAutoMemorySummary(store: TeamMemoryStore): string {
  const lines: string[] = ['## 팀 지식 요약 (자동 동기화)', ''];
  const MAX_ENTRIES = 15;

  const categories: Array<{ key: string; label: string }> = [
    { key: 'conventions', label: '컨벤션' },
    { key: 'patterns', label: '패턴' },
    { key: 'decisions', label: '결정' },
    { key: 'mistakes', label: '교훈' },
  ];

  for (const { key, label } of categories) {
    const entries = store.entries
      .filter((e: MemoryEntry) => e.category === key)
      .slice(-MAX_ENTRIES);
    if (entries.length === 0) continue;

    lines.push(`### ${label}`);
    for (const entry of entries) {
      lines.push(`- **${entry.title}**: ${entry.content.split('\n')[0]}`);
    }
    lines.push('');
  }

  // 열린 버그
  const openBugs = store.entries.filter(
    (e: MemoryEntry) => e.category === 'bugs' && e.status === 'open',
  );
  if (openBugs.length > 0) {
    lines.push('### 열린 버그');
    for (const bug of openBugs.slice(-5)) {
      lines.push(`- [${bug.severity ?? 'medium'}] ${bug.title}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
