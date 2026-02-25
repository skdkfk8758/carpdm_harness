import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { join } from 'node:path';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { loadConfig, saveConfig, updateFileRecord } from '../core/config.js';
import { analyzeChanges, generateDiff } from '../core/diff-engine.js';
import { getAllModules } from '../core/module-registry.js';
import { safeCopyFile, computeFileHash, backupFile, safeWriteFile, ensureDir } from '../core/file-ops.js';
import { getAllModuleFiles } from '../core/template-engine.js';
import { getTemplatesDir } from '../utils/paths.js';
import { getPackageVersion } from '../utils/version.js';
import { refreshOntology, collectIndexData } from '../core/ontology/index.js';
import { renderIndexMarkdown } from '../core/ontology/markdown-renderer.js';
import { loadStore, syncMemoryMd } from '../core/team-memory.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';
import { logger } from '../utils/logger.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerUpdateTool(server: McpServer): void {
  server.tool(
    'harness_update',
    '설치된 템플릿을 diff 기반으로 업데이트합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      module: z.string().optional().describe('특정 모듈만 업데이트'),
      dryRun: z.boolean().optional().describe('diff만 표시'),
      acceptAll: z.boolean().optional().describe('모든 변경 자동 수락'),
      refreshOntology: z.boolean().optional().describe('온톨로지 갱신'),
    },
    async ({ projectRoot, module: targetModule, dryRun, acceptAll, refreshOntology: doRefreshOntology }) => {
      try {
        logger.clear();
        const res = new McpResponseBuilder();
        const pRoot = projectRoot as string;
        const pDryRun = dryRun === true;
        const pAcceptAll = acceptAll === true;

        const config = loadConfig(pRoot);
        if (!config) {
          return errorResult('carpdm-harness가 설치되어 있지 않습니다. 먼저 harness_init을 실행하세요.');
        }

        res.header('carpdm-harness 업데이트');

        // 레거시 상태 마이그레이션
        if (!pDryRun) {
          const migration = migrateLegacyState(pRoot);
          if (migration.migrated > 0) {
            res.info(`레거시 상태 마이그레이션: ${migration.migrated}/${migration.total}개 파일`);
          }
        }

        const changes = analyzeChanges(config, pRoot);
        const filteredChanges = targetModule
          ? changes.filter(c => c.module === (targetModule as string))
          : changes;

        if (filteredChanges.length === 0) {
          res.ok('모든 파일이 최신 상태입니다.');
          return res.toResult();
        }

        res.info(`${filteredChanges.length}개 파일에 변경사항 발견:`);
        res.blank();

        const templatesDir = getTemplatesDir();
        const modules = getAllModules();
        const version = getPackageVersion();
        let updated = 0;
        let skipped = 0;
        let conflicts = 0;

        for (const change of filteredChanges) {
          const mod = modules[change.module];
          if (!mod) continue;

          const allFiles = getAllModuleFiles(mod);
          const modFile = allFiles.find(f => f.destination === change.relativePath);
          if (!modFile) continue;

          res.line(`  [${change.status}] ${change.relativePath}`);

          if (change.status === 'UPSTREAM_CHANGED') {
            if (pDryRun) {
              const diff = generateDiff(pRoot, change.relativePath, modFile.source);
              res.line(diff);
            }

            if (pAcceptAll && !pDryRun) {
              const srcPath = join(templatesDir, modFile.source);
              const destPath = join(pRoot, change.relativePath);
              safeCopyFile(srcPath, destPath, modFile.executable);
              const hash = computeFileHash(destPath);
              updateFileRecord(config, change.relativePath, change.module, version, hash);
              res.fileAction('update', change.relativePath);
            }
            updated++;
          } else if (change.status === 'USER_MODIFIED') {
            res.fileAction('skip', `${change.relativePath} (사용자 수정됨)`);
            skipped++;
          } else if (change.status === 'CONFLICT') {
            conflicts++;
            if (pAcceptAll && !pDryRun) {
              backupFile(join(pRoot, change.relativePath));
              const srcPath = join(templatesDir, modFile.source);
              const destPath = join(pRoot, change.relativePath);
              safeCopyFile(srcPath, destPath, modFile.executable);
              const hash = computeFileHash(destPath);
              updateFileRecord(config, change.relativePath, change.module, version, hash);
              res.fileAction('update', `${change.relativePath} (백업 후 교체)`);
              updated++;
            } else {
              res.fileAction('skip', `${change.relativePath} (충돌 — acceptAll로 해결)`);
              skipped++;
            }
          }
        }

        if (doRefreshOntology) {
          res.info('온톨로지 점진적 갱신 중...');
          const ontologyConfig = config.ontology ?? DEFAULT_ONTOLOGY_CONFIG;
          if (ontologyConfig.enabled && !pDryRun) {
            try {
              const report = await refreshOntology(pRoot, ontologyConfig);
              res.ok(`온톨로지 갱신 완료 (${report.totalDuration}ms)`);
            } catch (err) {
              res.warn(`온톨로지 갱신 실패 (무시하고 계속): ${String(err)}`);
            }
          } else if (!ontologyConfig.enabled) {
            res.info('온톨로지가 비활성화 상태입니다.');
          }
        }

        // INDEX 재생성 + memory.md 동기화
        if (!pDryRun) {
          try {
            const version = getPackageVersion();
            const indexData = collectIndexData(pRoot, version);
            const indexContent = renderIndexMarkdown(indexData);
            const indexPath = join(pRoot, '.agent', 'ontology', 'ONTOLOGY-INDEX.md');
            ensureDir(join(pRoot, '.agent', 'ontology'));
            safeWriteFile(indexPath, indexContent);
            res.ok('ONTOLOGY-INDEX.md 재생성 완료');
          } catch (err) {
            res.warn(`INDEX 재생성 실패: ${String(err)}`);
          }

          try {
            const store = loadStore(pRoot);
            syncMemoryMd(pRoot, store);
            res.ok('.agent/memory.md 동기화 완료');
          } catch (err) {
            res.warn(`memory.md 동기화 실패: ${String(err)}`);
          }
        }

        if (!pDryRun) {
          saveConfig(pRoot, config);
        }

        const coreLog = logger.flush();
        if (coreLog) {
          res.blank();
          res.line(coreLog);
        }

        res.blank();
        res.header('업데이트 결과');
        res.table([
          ['업데이트', `${updated}개`],
          ['건너뜀', `${skipped}개`],
          ['충돌', `${conflicts}개`],
        ]);

        return res.toResult();
      } catch (err) {
        return errorResult(`업데이트 실패: ${String(err)}`);
      }
    },
  );
}

function migrateLegacyState(projectRoot: string): { migrated: number; total: number } {
  const legacyDir = join(projectRoot, '.omc', 'state');
  const newDir = join(projectRoot, '.harness', 'state');

  mkdirSync(newDir, { recursive: true });

  const LEGACY_FILES = [
    'task-mode', 'lessons-counter', 'todo-done-count',
    'edit-counter', 'cross-verified', 'verify-result',
    'verify-loop-result', 'tdd-result', 'tdd-edit-order',
  ];

  let migrated = 0;
  const total = LEGACY_FILES.length;

  for (const file of LEGACY_FILES) {
    const src = join(legacyDir, file);
    const dest = join(newDir, file);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      migrated++;
    }
  }

  // change-log.md 마이그레이션
  const legacyLog = join(projectRoot, '.omc', 'change-log.md');
  const newLog = join(projectRoot, '.harness', 'change-log.md');
  if (existsSync(legacyLog) && !existsSync(newLog)) {
    mkdirSync(join(projectRoot, '.harness'), { recursive: true });
    copyFileSync(legacyLog, newLog);
    migrated++;
  }

  return { migrated, total: total + 1 };
}
