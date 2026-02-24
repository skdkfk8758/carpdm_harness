import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { logger } from '../../utils/logger.js';
import type {
  IncrementalChange,
  OntologyCache,
  OntologyConfig,
  OntologyData,
  OntologyBuildReport,
} from '../../types/ontology.js';
import { PluginRegistry } from './plugin-registry.js';
import { updateStructureIncremental } from './structure-builder.js';
import { updateSemanticsIncremental } from './semantics-builder.js';
import { buildDomainLayer } from './domain-builder.js';

// ────────────────────────────────────────────────────────────────────────────
// 캐시 경로
// ────────────────────────────────────────────────────────────────────────────

function getCachePath(outputDir: string): string {
  return join(outputDir, '.cache', 'ontology-cache.json');
}

// ────────────────────────────────────────────────────────────────────────────
// 파일 해시 계산
// ────────────────────────────────────────────────────────────────────────────

/**
 * 파일 내용을 sha256으로 해시
 */
export function computeFileHash(filePath: string): string {
  try {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 캐시 로드/저장
// ────────────────────────────────────────────────────────────────────────────

/**
 * 온톨로지 캐시 로드
 * 캐시 파일이 없거나 파싱 실패 시 null 반환
 */
export function loadOntologyCache(projectRoot: string, outputDir: string): OntologyCache | null {
  const absOutputDir = join(projectRoot, outputDir);
  const cachePath = getCachePath(absOutputDir);
  try {
    const raw = readFileSync(cachePath, 'utf-8');
    return JSON.parse(raw) as OntologyCache;
  } catch {
    return null;
  }
}

/**
 * 온톨로지 캐시 저장
 */
export function saveOntologyCache(
  projectRoot: string,
  outputDir: string,
  cache: OntologyCache,
): void {
  const absOutputDir = join(projectRoot, outputDir);
  const cachePath = getCachePath(absOutputDir);
  try {
    mkdirSync(join(absOutputDir, '.cache'), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    logger.warn(`온톨로지 캐시 저장 실패: ${String(err)}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 변경 사항 감지
// ────────────────────────────────────────────────────────────────────────────

/**
 * 프로젝트 내 모든 파일 해시를 재계산하여 캐시와 비교
 * added / modified / deleted 분류
 */
export async function computeIncrementalChanges(
  projectRoot: string,
  cache: OntologyCache,
  excludePatterns: string[],
): Promise<IncrementalChange> {
  const currentHashes: Record<string, string> = {};

  function walkDir(dirPath: string): void {
    let entries;
    try {
      entries = readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      // exclude 패턴 체크
      if (excludePatterns.some((p) => entry.name === p || entry.name.startsWith(p))) {
        continue;
      }

      const fullPath = join(dirPath, entry.name);
      const relPath = relative(projectRoot, fullPath);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        currentHashes[relPath] = computeFileHash(fullPath);
      }
    }
  }

  walkDir(projectRoot);

  const cachedHashes = cache.fileHashes;

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  // 추가 및 수정 감지
  for (const [relPath, hash] of Object.entries(currentHashes)) {
    if (!(relPath in cachedHashes)) {
      added.push(relPath);
    } else if (cachedHashes[relPath] !== hash) {
      modified.push(relPath);
    }
  }

  // 삭제 감지
  for (const relPath of Object.keys(cachedHashes)) {
    if (!(relPath in currentHashes)) {
      deleted.push(relPath);
    }
  }

  logger.dim(
    `변경 감지 완료 — 추가 ${added.length}, 수정 ${modified.length}, 삭제 ${deleted.length}`,
  );

  return { added, modified, deleted };
}

// ────────────────────────────────────────────────────────────────────────────
// 점진적 업데이트 적용
// ────────────────────────────────────────────────────────────────────────────

/**
 * 점진적 업데이트 적용
 * Layer 1, 2는 항상 갱신. Layer 3는 변경 비율 20% 초과 시에만 AI 재호출.
 */
export async function applyIncrementalUpdate(
  projectRoot: string,
  existingData: OntologyData,
  changes: IncrementalChange,
  config: OntologyConfig,
  pluginRegistry: PluginRegistry,
): Promise<OntologyBuildReport> {
  const startTime = Date.now();
  const results: OntologyBuildReport['results'] = [];
  const outputFiles: string[] = [];

  const totalChanged = changes.added.length + changes.modified.length + changes.deleted.length;

  // ── Layer 1: Structure ──
  if (config.layers.structure.enabled && existingData.structure) {
    const t0 = Date.now();
    try {
      const updated = updateStructureIncremental(
        projectRoot,
        existingData.structure,
        changes,
        config.layers.structure,
      );
      existingData.structure = updated;
      results.push({
        layer: 'structure',
        success: true,
        duration: Date.now() - t0,
        fileCount: updated.stats.totalFiles,
        warnings: [],
      });
    } catch (err) {
      results.push({
        layer: 'structure',
        success: false,
        duration: Date.now() - t0,
        fileCount: 0,
        error: String(err),
        warnings: [],
      });
    }
  }

  // ── Layer 2: Semantics ──
  if (config.layers.semantics.enabled && existingData.semantics) {
    const t0 = Date.now();
    try {
      const result = await updateSemanticsIncremental(
        projectRoot,
        existingData.semantics,
        changes,
        pluginRegistry,
      );
      existingData.semantics = result.data;
      results.push({
        layer: 'semantics',
        success: result.success,
        duration: result.duration,
        fileCount: result.fileCount,
        warnings: result.warnings,
      });
    } catch (err) {
      results.push({
        layer: 'semantics',
        success: false,
        duration: Date.now() - t0,
        fileCount: 0,
        error: String(err),
        warnings: [],
      });
    }
  }

  // ── Layer 3: Domain ──
  if (config.layers.domain.enabled && config.ai) {
    const t0 = Date.now();

    // 총 파일 수 대비 변경 비율 계산
    const totalFiles = existingData.structure?.stats.totalFiles ?? 1;
    const changeRatio = totalChanged / Math.max(totalFiles, 1);

    if (changeRatio > 0.2) {
      // 20% 초과 → AI 재호출
      logger.info(`변경 비율 ${Math.round(changeRatio * 100)}% > 20% — Domain Layer AI 재호출`);
      try {
        const result = await buildDomainLayer(
          projectRoot,
          existingData.structure!,
          existingData.semantics ?? null,
          config.layers.domain,
          config.ai,
        );
        existingData.domain = result.data;
        results.push({
          layer: 'domain',
          success: result.success,
          duration: result.duration,
          fileCount: result.fileCount,
          warnings: result.warnings,
        });
      } catch (err) {
        results.push({
          layer: 'domain',
          success: false,
          duration: Date.now() - t0,
          fileCount: 0,
          error: String(err),
          warnings: [],
        });
      }
    } else {
      // 20% 이하 → 캐시 유지
      logger.dim(`변경 비율 ${Math.round(changeRatio * 100)}% ≤ 20% — Domain Layer 캐시 유지`);
      results.push({
        layer: 'domain',
        success: true,
        duration: Date.now() - t0,
        fileCount: 0,
        warnings: ['캐시 유지 (변경 비율 낮음)'],
      });
    }
  }

  const totalDuration = Date.now() - startTime;

  return {
    results,
    totalDuration,
    outputFiles,
  };
}
