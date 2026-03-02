/**
 * Post-Install Tasks — init/update 공통 후처리 작업
 *
 * harness_init과 harness_update에서 공유하는 후처리 로직을 중앙화합니다.
 * 각 함수는 독립적으로 실패해도 다른 작업에 영향을 주지 않습니다.
 */

import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ensureDir, safeWriteFile } from './file-ops.js';
import { collectIndexData } from './ontology/index.js';
import { renderIndexMarkdown } from './ontology/markdown-renderer.js';
import { loadStore, syncMemoryMd } from './team-memory.js';
import { initKnowledgeVault, updateKnowledgeIndex, syncOntologyToVault } from './knowledge-vault.js';
import { syncClaudeMd } from './claudemd-sync.js';
import { detectLocalMcpConflict, getMcpConflictWarning, knowledgeDir } from './omc-compat.js';
import { scanOverlaps } from './overlap-detector.js';
import { detectCapabilities, cacheCapabilities } from './capability-detector.js';
import { getPackageVersion } from '../utils/version.js';
import { getTemplatesDir } from '../utils/paths.js';
import { DEFAULT_KNOWLEDGE_CONFIG } from '../types/config.js';
import type { HarnessConfig, KnowledgeConfig } from '../types/config.js';
import type { CapabilityResult } from '../types/capabilities.js';
import type { McpResponseBuilder } from '../types/mcp.js';

// ────────────────────────────────────────────────────────────────────────────
// ONTOLOGY-INDEX.md 재생성
// ────────────────────────────────────────────────────────────────────────────

/** .agent/ontology/ONTOLOGY-INDEX.md 재생성 */
export function regenerateOntologyIndex(
  projectRoot: string,
  res: McpResponseBuilder,
): void {
  try {
    const version = getPackageVersion();
    const indexData = collectIndexData(projectRoot, version);
    const indexContent = renderIndexMarkdown(indexData);
    const indexPath = join(projectRoot, '.agent', 'ontology', 'ONTOLOGY-INDEX.md');
    ensureDir(join(projectRoot, '.agent', 'ontology'));
    safeWriteFile(indexPath, indexContent);
    res.ok('ONTOLOGY-INDEX.md 생성 완료');
  } catch (err) {
    res.warn(`INDEX 생성 실패: ${String(err)}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Team Memory 동기화
// ────────────────────────────────────────────────────────────────────────────

/** .agent/memory.md 동기화 */
export function syncTeamMemoryMd(
  projectRoot: string,
  res: McpResponseBuilder,
): void {
  try {
    const store = loadStore(projectRoot);
    syncMemoryMd(projectRoot, store);
    res.ok('.agent/memory.md 동기화 완료');
  } catch (err) {
    res.warn(`memory.md 동기화 실패: ${String(err)}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Knowledge Vault
// ────────────────────────────────────────────────────────────────────────────

export interface KnowledgeVaultOptions {
  /** 온톨로지 활성화 여부 (init 시 사용) */
  ontologyEnabled?: boolean;
  /** true이면 기존 vault가 없을 때만 초기화 (update 시 사용) */
  updateMode?: boolean;
}

/** Knowledge Vault 초기화 또는 갱신 */
export function ensureKnowledgeVault(
  projectRoot: string,
  config: HarnessConfig,
  options: KnowledgeVaultOptions,
  res: McpResponseBuilder,
): void {
  try {
    const knowledgeConfig: KnowledgeConfig = config.knowledge ?? { ...DEFAULT_KNOWLEDGE_CONFIG };
    if (!knowledgeConfig.enabled) return;

    const kDirPath = knowledgeDir(projectRoot);
    if (!existsSync(kDirPath)) {
      config.knowledge = knowledgeConfig;
      initKnowledgeVault(projectRoot, knowledgeConfig);
      res.ok('Knowledge Vault 초기화 완료 (.knowledge/)');
    } else if (options.updateMode) {
      updateKnowledgeIndex(projectRoot);
    }

    // 온톨로지 동기화 (init: ontologyEnabled 플래그, update: config.syncOntology)
    if (options.ontologyEnabled || knowledgeConfig.syncOntology) {
      syncOntologyToVault(projectRoot);
      res.ok('온톨로지 → Knowledge Vault 동기화 완료');
    }
  } catch (err) {
    res.warn(`Knowledge Vault 처리 실패 (무시하고 계속): ${String(err)}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CLAUDE.md
// ────────────────────────────────────────────────────────────────────────────

/** CLAUDE.md 마커 영역 동기화 */
export function syncClaudeMdMarkers(
  projectRoot: string,
  res: McpResponseBuilder,
): void {
  const claudeResult = syncClaudeMd(projectRoot);
  if (claudeResult.updated) {
    res.ok('CLAUDE.md 자동 섹션 갱신 완료');
  }
}

/** CLAUDE.md 기본 템플릿 생성 (없을 때만) + 마커 갱신 */
export function ensureClaudeMd(
  projectRoot: string,
  res: McpResponseBuilder,
): void {
  const claudeMdPath = join(projectRoot, 'CLAUDE.md');
  if (!existsSync(claudeMdPath)) {
    try {
      const templatePath = join(getTemplatesDir(), 'core', 'CLAUDE.md.template');
      if (existsSync(templatePath)) {
        const projectName = projectRoot.split('/').pop() || 'my-project';
        const template = readFileSync(templatePath, 'utf-8');
        const content = template.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
        safeWriteFile(claudeMdPath, content);
        res.ok('CLAUDE.md 기본 템플릿 생성');
      }
    } catch (err) {
      res.warn(`CLAUDE.md 생성 실패: ${String(err)}`);
    }
  }
  syncClaudeMdMarkers(projectRoot, res);
}

// ────────────────────────────────────────────────────────────────────────────
// MCP 충돌 감지
// ────────────────────────────────────────────────────────────────────────────

/** Local MCP 충돌 감지 + 경고 */
export function checkMcpConflict(
  projectRoot: string,
  res: McpResponseBuilder,
): void {
  if (detectLocalMcpConflict(projectRoot)) {
    const conflict = getMcpConflictWarning();
    res.blank();
    res.warn(conflict.title);
    for (const line of conflict.lines) res.line(line);
    res.info(conflict.resolution);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Capabilities
// ────────────────────────────────────────────────────────────────────────────

/** capabilities 감지 + config 저장 + 캐시 */
export function detectAndCacheCapabilities(
  projectRoot: string,
  config: HarnessConfig,
): CapabilityResult | null {
  try {
    const capabilities = detectCapabilities(projectRoot);
    config.capabilities = capabilities;
    cacheCapabilities(projectRoot, capabilities);
    return capabilities;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// .gitignore 관리
// ────────────────────────────────────────────────────────────────────────────

/** .gitignore에 엔트리 추가 (없을 때만) */
export function ensureGitignoreEntries(
  projectRoot: string,
  entries: string[],
  res: McpResponseBuilder,
): void {
  const gitignorePath = join(projectRoot, '.gitignore');
  if (existsSync(gitignorePath)) {
    let content = readFileSync(gitignorePath, 'utf-8');
    const added: string[] = [];
    for (const entry of entries) {
      if (!content.includes(entry)) {
        content = content.trimEnd() + '\n' + entry + '\n';
        added.push(entry);
      }
    }
    if (added.length > 0) {
      writeFileSync(gitignorePath, content);
      res.info(`.gitignore에 ${added.join(', ')} 추가`);
    }
  } else {
    writeFileSync(gitignorePath, entries.join('\n') + '\n');
    res.info(`.gitignore 생성 (${entries.join(', ')})`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Triggers.json 설치
// ────────────────────────────────────────────────────────────────────────────

/** 스킬 트리거 매니페스트 설치 */
export function installTriggers(
  projectRoot: string,
  res: McpResponseBuilder,
): void {
  try {
    const triggersSrc = join(getTemplatesDir(), 'triggers.json');
    if (existsSync(triggersSrc)) {
      const triggersDest = join(projectRoot, '.harness', 'triggers.json');
      const content = readFileSync(triggersSrc, 'utf-8');
      writeFileSync(triggersDest, content);
      res.ok('스킬 트리거 매니페스트 설치');
    }
  } catch (err) {
    res.warn(`triggers.json 설치 실패: ${String(err)}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 중복(Overlap) 스캔
// ────────────────────────────────────────────────────────────────────────────

/** 중복 스캔 실행 (capabilities 재사용) */
export function scanOverlapsWithCaps(
  projectRoot: string,
  config: HarnessConfig,
  capabilities: CapabilityResult | null,
) {
  if (!capabilities) {
    try {
      capabilities = detectCapabilities(projectRoot);
    } catch {
      return null;
    }
  }
  return scanOverlaps(projectRoot, config, capabilities);
}
