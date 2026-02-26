import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { logger } from '../../utils/logger.js';
import type {
  StructureLayer,
  DirectoryNode,
  FileInfo,
  ModuleRelation,
  StructureStats,
  OntologyLayerConfig,
  IncrementalChange,
} from '../../types/ontology.js';

/**
 * .gitignore에서 단순 디렉토리명 패턴을 추출한다.
 * - 주석(#), 빈 줄, negation(!), glob(*, ?, [), 경로 구분자(/) 포함 패턴은 스킵
 * - 트레일링 `/`는 제거 (디렉토리 표시)
 * - 외부 의존성 없이 단순 파싱
 */
export function loadGitignorePatterns(projectRoot: string): string[] {
  const gitignorePath = join(projectRoot, '.gitignore');
  if (!existsSync(gitignorePath)) {
    return [];
  }

  try {
    const content = readFileSync(gitignorePath, 'utf-8');
    const patterns: string[] = [];

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();

      // 빈 줄, 주석
      if (!line || line.startsWith('#')) continue;
      // negation 패턴
      if (line.startsWith('!')) continue;

      // 트레일링 슬래시 제거
      const cleaned = line.endsWith('/') ? line.slice(0, -1) : line;

      // 경로 구분자가 포함된 패턴 스킵 (예: src/dist, /root-only)
      if (cleaned.includes('/')) continue;
      // glob 문자 포함 패턴 스킵 (예: *.pyc, log?, [Bb]uild)
      if (/[*?[\]]/.test(cleaned)) continue;
      // 빈 문자열 방지
      if (!cleaned) continue;

      patterns.push(cleaned);
    }

    return patterns;
  } catch {
    return [];
  }
}

/**
 * 여러 패턴 소스를 합산하여 중복 제거된 배열 반환
 */
export function mergeExcludePatterns(...sources: string[][]): string[] {
  return [...new Set(sources.flat())];
}

// 확장자 → 언어 매핑 테이블
const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

// static import/re-export 추출 정규식
const STATIC_IMPORT_RE = /^import\s+.*?from\s+['"]([^'"]+)['"]/gm;
const REEXPORT_RE = /^export\s+.*?from\s+['"]([^'"]+)['"]/gm;
// dynamic import 추출 정규식
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** 언어 감지 */
function detectLanguage(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  return EXT_TO_LANG[ext] ?? null;
}

/** 파일 정보 수집 */
function getFileInfo(filePath: string): FileInfo {
  const ext = extname(filePath).toLowerCase();
  let sizeBytes = 0;
  let lineCount = 0;

  try {
    const stat = statSync(filePath);
    sizeBytes = stat.size;
    const content = readFileSync(filePath, 'utf-8');
    lineCount = content.split('\n').length;
  } catch {
    // 읽기 실패 시 기본값 유지
  }

  return {
    extension: ext,
    sizeBytes,
    lineCount,
    language: detectLanguage(filePath),
  };
}

/** 파일에서 모듈 관계 추출 */
function extractModuleRelations(
  filePath: string,
  content: string,
  projectRoot: string,
): ModuleRelation[] {
  const relations: ModuleRelation[] = [];
  const sourceRelative = relative(projectRoot, filePath);

  // static import
  let match: RegExpExecArray | null;
  const staticRe = new RegExp(STATIC_IMPORT_RE.source, 'gm');
  while ((match = staticRe.exec(content)) !== null) {
    relations.push({
      source: sourceRelative,
      target: match[1],
      type: 'import',
    });
  }

  // re-export
  const reexportRe = new RegExp(REEXPORT_RE.source, 'gm');
  while ((match = reexportRe.exec(content)) !== null) {
    relations.push({
      source: sourceRelative,
      target: match[1],
      type: 'reexport',
    });
  }

  // dynamic import
  const dynamicRe = new RegExp(DYNAMIC_IMPORT_RE.source, 'g');
  while ((match = dynamicRe.exec(content)) !== null) {
    relations.push({
      source: sourceRelative,
      target: match[1],
      type: 'dynamic-import',
    });
  }

  return relations;
}

/** 통계 수집 */
function collectStats(nodes: DirectoryNode[]): StructureStats {
  const stats: StructureStats = {
    totalFiles: 0,
    totalDirs: 0,
    byLanguage: {},
    byExtension: {},
  };

  function walk(node: DirectoryNode): void {
    if (node.type === 'file') {
      stats.totalFiles++;
      const lang = node.fileInfo?.language;
      const ext = node.fileInfo?.extension;
      if (lang) stats.byLanguage[lang] = (stats.byLanguage[lang] ?? 0) + 1;
      if (ext) stats.byExtension[ext] = (stats.byExtension[ext] ?? 0) + 1;
    } else {
      stats.totalDirs++;
      for (const child of node.children ?? []) {
        walk(child);
      }
    }
  }

  for (const node of nodes) {
    walk(node);
  }

  return stats;
}

/** 디렉토리 재귀 스캔 */
function scanDirectory(
  dirPath: string,
  projectRoot: string,
  excludePatterns: string[],
  maxDepth: number,
  currentDepth: number,
  allRelations: ModuleRelation[],
): DirectoryNode {
  const name = basename(dirPath);
  const pathRelative = relative(projectRoot, dirPath);

  const node: DirectoryNode = {
    name,
    path: pathRelative || '.',
    type: 'directory',
    children: [],
  };

  if (currentDepth >= maxDepth) {
    return node;
  }

  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    logger.warn(`디렉토리 읽기 실패: ${dirPath}`);
    return node;
  }

  for (const entry of entries) {
    // excludePatterns 체크: 디렉토리 진입 전
    if (excludePatterns.some((p) => entry.name === p || entry.name.startsWith(p))) {
      continue;
    }

    const fullPath = join(dirPath, entry.name);
    const entryRelative = relative(projectRoot, fullPath);

    if (entry.isDirectory()) {
      const childNode = scanDirectory(
        fullPath,
        projectRoot,
        excludePatterns,
        maxDepth,
        currentDepth + 1,
        allRelations,
      );
      node.children!.push(childNode);
    } else if (entry.isFile()) {
      const fileInfo = getFileInfo(fullPath);
      const fileNode: DirectoryNode = {
        name: entry.name,
        path: entryRelative,
        type: 'file',
        fileInfo,
      };
      node.children!.push(fileNode);

      // 소스 파일에서 모듈 관계 추출 (텍스트 기반 언어만)
      const lang = fileInfo.language;
      if (lang && ['typescript', 'javascript'].includes(lang)) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const relations = extractModuleRelations(fullPath, content, projectRoot);
          allRelations.push(...relations);
        } catch {
          // 읽기 실패 시 무시
        }
      }
    }
  }

  return node;
}

/**
 * package.json에서 외부 의존성 수집
 * (DependencyGraph의 external 항목 구성용으로 별도 사용 가능)
 */
export function readExternalDependencies(
  projectRoot: string,
): { name: string; version: string }[] {
  try {
    const pkgPath = join(projectRoot, 'package.json');
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all: { name: string; version: string }[] = [];
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
      all.push({ name, version });
    }
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
      all.push({ name, version });
    }
    return all;
  } catch {
    return [];
  }
}

/**
 * Layer 1 전체 스캔 — StructureLayer 반환
 */
export function buildStructureLayer(
  projectRoot: string,
  config: OntologyLayerConfig['structure'],
): StructureLayer {
  logger.info(`Structure Layer 빌드 시작: ${projectRoot}`);

  const gitignorePatterns = loadGitignorePatterns(projectRoot);
  const effectiveExcludes = mergeExcludePatterns(config.excludePatterns, gitignorePatterns);

  const allRelations: ModuleRelation[] = [];
  const tree = scanDirectory(
    projectRoot,
    projectRoot,
    effectiveExcludes,
    config.maxDepth,
    0,
    allRelations,
  );

  const stats = collectStats(tree.children ?? []);

  logger.ok(`Structure Layer 빌드 완료 — 파일 ${stats.totalFiles}개, 디렉토리 ${stats.totalDirs}개`);

  return {
    rootDir: projectRoot,
    tree,
    modules: allRelations,
    stats,
  };
}

/**
 * 점진적 갱신 — 변경된 파일만 재스캔하여 기존 StructureLayer 업데이트
 */
export function updateStructureIncremental(
  projectRoot: string,
  existing: StructureLayer,
  changes: IncrementalChange,
  config: OntologyLayerConfig['structure'],
): StructureLayer {
  logger.info(
    `Structure Layer 점진적 갱신 — 추가 ${changes.added.length}, 수정 ${changes.modified.length}, 삭제 ${changes.deleted.length}`,
  );

  // 삭제된 경로 집합
  const deletedSet = new Set(changes.deleted);
  // 수정/추가된 경로 집합
  const changedSet = new Set([...changes.added, ...changes.modified]);

  // 기존 모듈 관계에서 삭제/변경 파일 제거
  const filteredModules = existing.modules.filter(
    (rel) => !deletedSet.has(rel.source) && !changedSet.has(rel.source),
  );

  // 변경된 파일들에서 새 모듈 관계 추출
  const newRelations: ModuleRelation[] = [];
  for (const relPath of changedSet) {
    const fullPath = join(projectRoot, relPath);
    const lang = detectLanguage(fullPath);
    if (lang && ['typescript', 'javascript'].includes(lang)) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        newRelations.push(...extractModuleRelations(fullPath, content, projectRoot));
      } catch {
        // 읽기 실패 시 무시
      }
    }
  }

  // 변경이 크면 전체 재빌드로 폴백
  const totalChanged = changes.added.length + changes.modified.length + changes.deleted.length;
  if (totalChanged > 50) {
    logger.warn('변경 파일이 50개를 초과하여 전체 재빌드를 수행합니다.');
    return buildStructureLayer(projectRoot, config);
  }

  // 트리는 간단히 전체 재스캔 (stat 호출 최소화 정책 유지)
  const gitignorePatterns = loadGitignorePatterns(projectRoot);
  const effectiveExcludes = mergeExcludePatterns(config.excludePatterns, gitignorePatterns);

  const allRelations: ModuleRelation[] = [];
  const tree = scanDirectory(
    projectRoot,
    projectRoot,
    effectiveExcludes,
    config.maxDepth,
    0,
    allRelations,
  );
  const stats = collectStats(tree.children ?? []);

  return {
    rootDir: projectRoot,
    tree,
    modules: [...filteredModules, ...newRelations],
    stats,
  };
}
