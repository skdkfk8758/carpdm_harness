import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { logger } from '../../utils/logger.js';
import { safeWriteFile } from '../file-ops.js';
import type {
  OntologyConfig,
  OntologyData,
  OntologyBuildReport,
  BuildResult,
  OntologyMetadata,
  LayerStatus,
  DomainBuildContext,
  OntologyIndexData,
  AgentFileInfo,
  AgentFileStatus,
} from '../../types/ontology.js';
import { PluginRegistry } from './plugin-registry.js';
import { buildStructureLayer } from './structure-builder.js';
import { buildSemanticsLayer } from './semantics-builder.js';
import { buildDomainLayer, collectDomainContext } from './domain-builder.js';
import { renderOntologyMarkdown, renderIndexMarkdown } from './markdown-renderer.js';
import {
  loadOntologyCache,
  saveOntologyCache,
  computeIncrementalChanges,
  applyIncrementalUpdate,
} from './incremental-updater.js';

// ────────────────────────────────────────────────────────────────────────────
// 내부 유틸
// ────────────────────────────────────────────────────────────────────────────

/** package.json에서 버전 읽기 */
function readHarnessVersion(projectRoot: string): string {
  try {
    const raw = readFileSync(join(projectRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** 초기 LayerStatus 생성 */
function makeLayerStatus(enabled: boolean): LayerStatus {
  return { enabled, lastBuilt: null, lastError: null, fileCount: 0 };
}

/** BuildResult에서 LayerStatus 업데이트 */
function updateLayerStatus(
  status: LayerStatus,
  result: BuildResult & { error?: string },
): LayerStatus {
  if (result.success) {
    return {
      ...status,
      lastBuilt: new Date().toISOString(),
      lastError: null,
      fileCount: result.fileCount,
    };
  } else {
    return {
      ...status,
      lastError: result.error ?? 'unknown error',
    };
  }
}

/**
 * 레이어 빌드를 독립적으로 실행하는 래퍼
 * 실패 시 success: false를 반환하고 다른 레이어 실행에 영향을 주지 않습니다.
 */
async function safeLayerBuild<T>(
  layer: 'structure' | 'semantics' | 'domain',
  fn: () => Promise<BuildResult & { data: T }>,
): Promise<(BuildResult & { data: T }) | (BuildResult & { data: null })> {
  const t0 = Date.now();
  try {
    return await fn();
  } catch (err) {
    logger.warn(`${layer} 레이어 빌드 실패: ${String(err)}`);
    return {
      layer,
      success: false,
      duration: Date.now() - t0,
      fileCount: 0,
      error: String(err),
      warnings: [],
      data: null,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 공개 API
// ────────────────────────────────────────────────────────────────────────────

/**
 * 온톨로지 전체 빌드
 * Layer 1 → 2 → 3 순차 실행, 각 레이어는 독립적으로 실패 처리됩니다.
 */
export async function buildOntology(
  projectRoot: string,
  config: OntologyConfig,
): Promise<OntologyBuildReport> {
  const startTime = Date.now();
  logger.header('온톨로지 빌드 시작');

  const pluginRegistry = PluginRegistry.createDefault();
  const version = readHarnessVersion(projectRoot);
  const now = new Date().toISOString();

  const metadata: OntologyMetadata = {
    projectName: projectRoot.split('/').pop() ?? 'project',
    generatedAt: now,
    harnessVersion: version,
    layerStatus: {
      structure: makeLayerStatus(config.layers.structure.enabled),
      semantics: makeLayerStatus(config.layers.semantics.enabled),
      domain: makeLayerStatus(config.layers.domain.enabled),
    },
  };

  const results: BuildResult[] = [];

  // ── Layer 1: Structure ──
  let structureData = null;
  if (config.layers.structure.enabled) {
    logger.info('Layer 1: Structure 빌드 중...');
    const result = await safeLayerBuild('structure', async () => {
      const t0 = Date.now();
      const data = buildStructureLayer(projectRoot, config.layers.structure);
      return {
        layer: 'structure' as const,
        success: true,
        duration: Date.now() - t0,
        fileCount: data.stats.totalFiles,
        warnings: [],
        data,
      };
    });
    results.push(result);
    metadata.layerStatus.structure = updateLayerStatus(metadata.layerStatus.structure, result);
    structureData = result.data;
  }

  // ── Layer 2: Semantics ──
  let semanticsData = null;
  if (config.layers.semantics.enabled && structureData) {
    logger.info('Layer 2: Semantics 빌드 중...');
    const result = await safeLayerBuild('semantics', () =>
      buildSemanticsLayer(projectRoot, structureData!, config.layers.semantics, pluginRegistry),
    );
    results.push(result);
    metadata.layerStatus.semantics = updateLayerStatus(metadata.layerStatus.semantics, result);
    semanticsData = result.data;
  }

  // ── Layer 3: Domain ──
  let domainData = null;
  let domainContext: DomainBuildContext | undefined;
  if (config.layers.domain.enabled && structureData) {
    if (config.ai?.provider === 'claude-code') {
      // claude-code provider: context만 수집하여 반환 (Claude Code가 분석)
      logger.info('Layer 3: Domain context 수집 중 (claude-code provider)...');
      domainContext = collectDomainContext(projectRoot, structureData, semanticsData);
      results.push({
        layer: 'domain',
        success: true,
        duration: 0,
        fileCount: 0,
        warnings: ['claude-code provider: Claude Code에서 domain 분석을 수행하세요'],
      });
    } else if (!config.ai) {
      logger.warn('Domain 레이어가 활성화되었으나 AI 설정이 없습니다. Domain 레이어를 건너뜁니다.');
      results.push({
        layer: 'domain',
        success: true,
        duration: 0,
        fileCount: 0,
        warnings: ['AI 설정 누락으로 Domain 레이어 스킵'],
      });
    } else {
      logger.info('Layer 3: Domain 빌드 중...');
      const result = await safeLayerBuild('domain', () =>
        buildDomainLayer(
          projectRoot,
          structureData!,
          semanticsData,
          config.layers.domain,
          config.ai!,
        ),
      );
      results.push(result);
      metadata.layerStatus.domain = updateLayerStatus(metadata.layerStatus.domain, result);
      domainData = result.data;
    }
  }

  // OntologyData 조합
  const ontologyData: OntologyData = {
    metadata,
    structure: structureData,
    semantics: semanticsData,
    domain: domainData,
  };

  // Markdown 파일 출력
  const outputFiles = await writeOntologyFiles(projectRoot, ontologyData, config.outputDir);

  // 캐시 저장 (파일 해시 기반)
  if (structureData) {
    // 간단히 현재 시각만 기록하고 fileHashes는 빈 상태로 초기화
    // (incremental-updater.ts에서 computeIncrementalChanges 호출 시 갱신됨)
    saveOntologyCache(projectRoot, config.outputDir, {
      version,
      builtAt: now,
      fileHashes: {},
      layerData: {
        structure: structureData ?? undefined,
        semantics: semanticsData ?? undefined,
        domain: domainData ?? undefined,
      },
    });
  }

  const totalDuration = Date.now() - startTime;
  logger.ok(`온톨로지 빌드 완료 (${totalDuration}ms)`);

  return {
    results,
    totalDuration,
    outputFiles,
    domainContext,
    annotationSummary: semanticsData?.annotationSummary,
  };
}

/**
 * 온톨로지 점진적 갱신
 * 캐시 기반으로 변경된 파일만 처리합니다.
 */
export async function refreshOntology(
  projectRoot: string,
  config: OntologyConfig,
): Promise<OntologyBuildReport> {
  logger.header('온톨로지 점진적 갱신 시작');

  const cache = loadOntologyCache(projectRoot, config.outputDir);
  if (!cache) {
    logger.warn('캐시 없음 — 전체 빌드로 폴백');
    return buildOntology(projectRoot, config);
  }

  const existingData: OntologyData = {
    metadata: {
      projectName: projectRoot.split('/').pop() ?? 'project',
      generatedAt: cache.builtAt,
      harnessVersion: cache.version,
      layerStatus: {
        structure: makeLayerStatus(config.layers.structure.enabled),
        semantics: makeLayerStatus(config.layers.semantics.enabled),
        domain: makeLayerStatus(config.layers.domain.enabled),
      },
    },
    structure: cache.layerData.structure ?? null,
    semantics: cache.layerData.semantics ?? null,
    domain: cache.layerData.domain ?? null,
  };

  const changes = await computeIncrementalChanges(
    projectRoot,
    cache,
    config.layers.structure.excludePatterns,
  );

  const pluginRegistry = PluginRegistry.createDefault();
  const report = await applyIncrementalUpdate(
    projectRoot,
    existingData,
    changes,
    config,
    pluginRegistry,
  );

  // 갱신된 데이터로 Markdown 재출력
  const outputFiles = await writeOntologyFiles(projectRoot, existingData, config.outputDir);
  report.outputFiles = outputFiles;

  // 캐시 업데이트
  saveOntologyCache(projectRoot, config.outputDir, {
    ...cache,
    builtAt: new Date().toISOString(),
    layerData: {
      structure: existingData.structure ?? undefined,
      semantics: existingData.semantics ?? undefined,
      domain: existingData.domain ?? undefined,
    },
  });

  // @MX 어노테이션 요약 전달
  report.annotationSummary = existingData.semantics?.annotationSummary;

  logger.ok('온톨로지 점진적 갱신 완료');
  return report;
}

/**
 * 온톨로지 상태 조회
 * 캐시에서 metadata를 로드하여 반환합니다.
 */
export function getOntologyStatus(
  projectRoot: string,
  config: OntologyConfig,
): OntologyData['metadata'] | null {
  const cache = loadOntologyCache(projectRoot, config.outputDir);
  if (!cache) return null;

  return {
    projectName: projectRoot.split('/').pop() ?? 'project',
    generatedAt: cache.builtAt,
    harnessVersion: cache.version,
    layerStatus: {
      structure: makeLayerStatus(!!cache.layerData.structure),
      semantics: makeLayerStatus(!!cache.layerData.semantics),
      domain: makeLayerStatus(!!cache.layerData.domain),
    },
  };
}

/**
 * .agent/ 디렉토리의 파일 현황을 수집하여 인덱스 데이터를 생성합니다.
 */
export function collectIndexData(
  projectRoot: string,
  version: string,
): OntologyIndexData {
  const checkStatus = (relPath: string): AgentFileStatus => {
    return existsSync(join(projectRoot, relPath)) ? 'exists' : 'missing';
  };

  const agentFiles: AgentFileInfo[] = [
    { path: '.agent/plan.md', status: checkStatus('.agent/plan.md'), description: '작업 계획 (SDD 기반)', managed: 'manual' },
    { path: '.agent/todo.md', status: checkStatus('.agent/todo.md'), description: 'TODO 체크리스트', managed: 'manual' },
    { path: '.agent/context.md', status: checkStatus('.agent/context.md'), description: '결정/트레이드오프 기록', managed: 'manual' },
    { path: '.agent/memory.md', status: checkStatus('.agent/memory.md'), description: '팀 메모리 (자동 동기화)', managed: 'semi-auto' },
  ];

  const ontologyFiles: AgentFileInfo[] = [
    { path: '.agent/ontology/ONTOLOGY-STRUCTURE.md', status: checkStatus('.agent/ontology/ONTOLOGY-STRUCTURE.md'), description: '디렉토리 구조 맵', managed: 'auto' },
    { path: '.agent/ontology/ONTOLOGY-SEMANTICS.md', status: checkStatus('.agent/ontology/ONTOLOGY-SEMANTICS.md'), description: '코드 심볼 인덱스', managed: 'auto' },
    { path: '.agent/ontology/ONTOLOGY-DOMAIN.md', status: checkStatus('.agent/ontology/ONTOLOGY-DOMAIN.md'), description: '도메인 지식', managed: 'auto' },
    { path: '.agent/ontology/ONTOLOGY-INDEX.md', status: checkStatus('.agent/ontology/ONTOLOGY-INDEX.md'), description: '전체 지식 인덱스 (이 파일)', managed: 'auto' },
  ];

  return {
    generatedAt: new Date().toISOString(),
    harnessVersion: version,
    agentFiles,
    ontologyFiles,
  };
}

/**
 * Markdown 파일로 저장
 * renderOntologyMarkdown 결과를 outputDir에 씁니다.
 */
export async function writeOntologyFiles(
  projectRoot: string,
  data: OntologyData,
  outputDir: string,
): Promise<string[]> {
  const absOutputDir = join(projectRoot, outputDir);
  const { structure, semantics, domain } = renderOntologyMarkdown(data);

  const filePaths: string[] = [];

  const files: [string, string][] = [
    [join(absOutputDir, 'ONTOLOGY-STRUCTURE.md'), structure],
    [join(absOutputDir, 'ONTOLOGY-SEMANTICS.md'), semantics],
    [join(absOutputDir, 'ONTOLOGY-DOMAIN.md'), domain],
  ];

  for (const [filePath, content] of files) {
    try {
      safeWriteFile(filePath, content);
      filePaths.push(filePath);
      logger.fileAction('create', filePath);
    } catch (err) {
      logger.warn(`파일 쓰기 실패: ${filePath} — ${String(err)}`);
    }
  }

  // ONTOLOGY-INDEX.md 생성
  try {
    const version = data.metadata.harnessVersion;
    const indexData = collectIndexData(projectRoot, version);
    const indexContent = renderIndexMarkdown(indexData);
    const indexPath = join(absOutputDir, 'ONTOLOGY-INDEX.md');
    safeWriteFile(indexPath, indexContent);
    filePaths.push(indexPath);
    logger.fileAction('create', indexPath);
  } catch (err) {
    logger.warn(`INDEX 파일 쓰기 실패: ${String(err)}`);
  }

  return filePaths;
}
