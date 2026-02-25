import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { logger } from '../../utils/logger.js';
import type {
  SemanticsLayer,
  OntologyLayerConfig,
  StructureLayer,
  BuildResult,
  IncrementalChange,
  SymbolIndex,
  DependencyGraph,
  SemanticFile,
  DirectoryNode,
  ModuleRelation,
} from '../../types/ontology.js';
import type { CapabilityResult } from '../../types/capabilities.js';
import { PluginRegistry } from './plugin-registry.js';
import { generateAnnotations } from './annotation-analyzer.js';

// ────────────────────────────────────────────────────────────────────────────
// 내부 유틸
// ────────────────────────────────────────────────────────────────────────────

/** DirectoryNode 트리에서 소스 파일 경로 목록을 수집 */
function collectSourceFiles(
  node: DirectoryNode,
  projectRoot: string,
  languages: string[],
): string[] {
  const results: string[] = [];

  function walk(n: DirectoryNode): void {
    if (n.type === 'file') {
      const lang = n.fileInfo?.language;
      if (lang && languages.includes(lang)) {
        results.push(join(projectRoot, n.path));
      }
    } else {
      for (const child of n.children ?? []) {
        walk(child);
      }
    }
  }

  walk(node);
  return results;
}

/** SemanticFile 배열로 SymbolIndex 빌드 */
function buildSymbolIndex(files: SemanticFile[]): SymbolIndex {
  const byName: SymbolIndex['byName'] = {};
  let exportedCount = 0;
  let totalCount = 0;

  for (const file of files) {
    for (const sym of file.exports) {
      totalCount++;
      if (sym.exported) exportedCount++;
      if (!byName[sym.name]) byName[sym.name] = [];
      byName[sym.name].push({ file: file.path, line: sym.line, kind: sym.kind });
    }
    // 클래스, 함수, 인터페이스, 타입도 인덱스에 포함
    for (const cls of file.classes) {
      if (!cls.exported) {
        totalCount++;
        if (!byName[cls.name]) byName[cls.name] = [];
        byName[cls.name].push({ file: file.path, line: cls.line, kind: cls.kind });
      }
    }
    for (const fn of file.functions) {
      if (!fn.exported) {
        totalCount++;
        if (!byName[fn.name]) byName[fn.name] = [];
        byName[fn.name].push({ file: file.path, line: fn.line, kind: fn.kind });
      }
    }
    for (const iface of file.interfaces) {
      if (!iface.exported) {
        totalCount++;
        if (!byName[iface.name]) byName[iface.name] = [];
        byName[iface.name].push({ file: file.path, line: iface.line, kind: iface.kind });
      }
    }
    for (const typeAlias of file.types) {
      if (!typeAlias.exported) {
        totalCount++;
        if (!byName[typeAlias.name]) byName[typeAlias.name] = [];
        byName[typeAlias.name].push({ file: file.path, line: typeAlias.line, kind: typeAlias.kind });
      }
    }
  }

  return { byName, exportedCount, totalCount };
}

/** SemanticFile 배열 + 구조 레이어 모듈 관계로 DependencyGraph 빌드 */
function buildDependencyGraph(
  files: SemanticFile[],
  modules: ModuleRelation[],
  projectRoot: string,
  pkgExternal: { name: string; version: string }[],
): DependencyGraph {
  // internal: 프로젝트 내부 import (상대 경로 또는 ./ ../ 시작)
  const internal: ModuleRelation[] = modules.filter(
    (rel) => rel.target.startsWith('.') || rel.target.startsWith('/'),
  );

  // external: 각 SemanticFile의 import 중 패키지 이름 기반
  const externalUsage: Record<string, string[]> = {};
  for (const file of files) {
    for (const imp of file.imports) {
      if (!imp.source.startsWith('.') && !imp.source.startsWith('/')) {
        // 패키지명 추출 (scoped 패키지 포함)
        const pkgName = imp.source.startsWith('@')
          ? imp.source.split('/').slice(0, 2).join('/')
          : imp.source.split('/')[0];
        if (!externalUsage[pkgName]) externalUsage[pkgName] = [];
        const relPath = relative(projectRoot, file.path);
        if (!externalUsage[pkgName].includes(relPath)) {
          externalUsage[pkgName].push(relPath);
        }
      }
    }
  }

  // pkgExternal와 실제 사용 정보를 merge
  const pkgMap = new Map(pkgExternal.map((p) => [p.name, p.version]));
  const external = Object.entries(externalUsage).map(([name, usedBy]) => ({
    name,
    version: pkgMap.get(name) ?? 'unknown',
    usedBy,
  }));

  return { internal, external };
}

/** 단일 파일 분석 (플러그인 없으면 null 반환) */
async function analyzeFile(
  filePath: string,
  pluginRegistry: PluginRegistry,
): Promise<SemanticFile | null> {
  const plugin = pluginRegistry.getPluginForFile(filePath);
  if (!plugin) return null;

  const content = readFileSync(filePath, 'utf-8');
  return plugin.analyzeFile(filePath, content);
}

// ────────────────────────────────────────────────────────────────────────────
// 공개 API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Layer 2 전체 빌드
 * structureLayer의 파일 트리를 순회하여 플러그인으로 분석합니다.
 */
export async function buildSemanticsLayer(
  projectRoot: string,
  structureLayer: StructureLayer,
  config: OntologyLayerConfig['semantics'],
  pluginRegistry: PluginRegistry,
  capabilities?: CapabilityResult,
): Promise<BuildResult & { data: SemanticsLayer }> {
  const startTime = Date.now();
  logger.info('Semantics Layer 빌드 시작');

  const warnings: string[] = [];

  // 소스 파일 목록 수집
  const sourceFiles = collectSourceFiles(structureLayer.tree, projectRoot, config.languages);
  logger.dim(`분석 대상 파일: ${sourceFiles.length}개`);

  // 병렬 분석 (개별 실패는 warning으로 처리)
  const settled = await Promise.allSettled(
    sourceFiles.map((fp) => analyzeFile(fp, pluginRegistry)),
  );

  const files: SemanticFile[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === 'fulfilled' && result.value !== null) {
      files.push(result.value);
    } else if (result.status === 'rejected') {
      warnings.push(`파일 분석 실패: ${sourceFiles[i]} — ${String(result.reason)}`);
    }
  }

  // SymbolIndex 및 DependencyGraph 빌드
  const symbols = buildSymbolIndex(files);
  const dependencies = buildDependencyGraph(
    files,
    structureLayer.modules,
    projectRoot,
    [], // package.json 외부 의존성은 structure-builder에서 별도 읽음
  );

  // SemanticsLayer 조합
  const semanticsData: SemanticsLayer = { files, symbols, dependencies };

  // @MX 어노테이션 분석 및 부착
  const annotationResult = generateAnnotations(semanticsData, projectRoot);
  semanticsData.annotationSummary = annotationResult.summary;

  const duration = Date.now() - startTime;
  logger.ok(`Semantics Layer 빌드 완료 — 파일 ${files.length}개, 심볼 ${symbols.totalCount}개, 어노테이션 ${annotationResult.summary.total}개 (${duration}ms)`);

  // Serena 감지 시 LSP 심볼 보강 힌트 추가
  if (capabilities?.tools?.serena?.detected) {
    warnings.push(
      '[힌트] Serena가 감지되었습니다. lsp_document_symbols로 심볼 정보를 보강할 수 있습니다.',
    );
    logger.dim('Serena 감지됨 — LSP 심볼 보강 힌트 추가');
  }

  return {
    layer: 'semantics',
    success: true,
    duration,
    fileCount: files.length,
    warnings,
    data: semanticsData,
  };
}

/**
 * Layer 2 점진적 갱신
 * 변경된 파일만 재분석하여 기존 SemanticsLayer와 merge합니다.
 */
export async function updateSemanticsIncremental(
  projectRoot: string,
  existing: SemanticsLayer,
  changes: IncrementalChange,
  pluginRegistry: PluginRegistry,
): Promise<BuildResult & { data: SemanticsLayer }> {
  const startTime = Date.now();
  logger.info(
    `Semantics Layer 점진적 갱신 — 추가 ${changes.added.length}, 수정 ${changes.modified.length}, 삭제 ${changes.deleted.length}`,
  );

  const warnings: string[] = [];

  // 삭제 및 변경 파일 집합
  const removedPaths = new Set([...changes.deleted, ...changes.modified]);
  const addedOrModified = [...changes.added, ...changes.modified];

  // 기존 파일 목록에서 삭제/변경된 파일 제거
  const keptFiles = existing.files.filter((f) => {
    const rel = relative(projectRoot, f.path);
    return !removedPaths.has(rel) && !removedPaths.has(f.path);
  });

  // 변경/추가된 파일 재분석
  const settled = await Promise.allSettled(
    addedOrModified.map((relPath) => {
      const fullPath = join(projectRoot, relPath);
      return analyzeFile(fullPath, pluginRegistry);
    }),
  );

  const newFiles: SemanticFile[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === 'fulfilled' && result.value !== null) {
      newFiles.push(result.value);
    } else if (result.status === 'rejected') {
      warnings.push(`파일 재분석 실패: ${addedOrModified[i]} — ${String(result.reason)}`);
    }
  }

  const mergedFiles = [...keptFiles, ...newFiles];

  // SymbolIndex 및 DependencyGraph 재빌드
  const symbols = buildSymbolIndex(mergedFiles);
  const dependencies: DependencyGraph = {
    internal: existing.dependencies.internal.filter(
      (rel) => !removedPaths.has(rel.source),
    ),
    external: existing.dependencies.external,
  };

  // SemanticsLayer 조합
  const semanticsData: SemanticsLayer = { files: mergedFiles, symbols, dependencies };

  // @MX 어노테이션 재계산
  const annotationResult = generateAnnotations(semanticsData, projectRoot);
  semanticsData.annotationSummary = annotationResult.summary;

  const duration = Date.now() - startTime;
  logger.ok(`Semantics Layer 점진적 갱신 완료 — 파일 ${mergedFiles.length}개, 어노테이션 ${annotationResult.summary.total}개 (${duration}ms)`);

  return {
    layer: 'semantics',
    success: true,
    duration,
    fileCount: mergedFiles.length,
    warnings,
    data: semanticsData,
  };
}
