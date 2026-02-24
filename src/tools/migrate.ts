import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../core/config.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

const FILE_MODULE_MAP: Record<string, string> = {
  'plan-gate.md': 'core',
  'read-domain-context.md': 'core',
  'memory-manager.md': 'core',
  'tdd-cycle.md': 'tdd',
  'quality-guard.md': 'quality',
  'post-task-check.md': 'quality',
  'verify.md': 'quality',
  'logical-commit.md': 'ship',
  'ship-pr.md': 'ship',
  'update-all.md': 'maintenance',
  'pattern-cloner.md': 'patterns',
  'pre-task.sh': 'core',
  'plan-guard.sh': 'core',
  'post-task.sh': 'core',
  'code-change.sh': 'quality',
  'tdd-guard.sh': 'tdd',
};

export function registerMigrateTool(server: McpServer): void {
  server.tool(
    'harness_migrate',
    '기존 agent_harness에서 carpdm-harness로 마이그레이션합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      source: z.string().optional().describe('agent_harness 레포 경로'),
      dryRun: z.boolean().optional().describe('마이그레이션 계획만 표시'),
      keepOld: z.boolean().optional().describe('기존 파일 유지'),
    },
    async ({ projectRoot, dryRun, keepOld }) => {
      try {
        const res = new McpResponseBuilder();
        const pRoot = projectRoot as string;
        const pDryRun = dryRun === true;
        const pKeepOld = keepOld !== false;

        const existingConfig = loadConfig(pRoot);
        if (existingConfig) {
          return errorResult('carpdm-harness가 이미 설치되어 있습니다. harness_update를 사용하세요.');
        }

        res.header('agent_harness → carpdm-harness 마이그레이션');

        const commandsDir = join(pRoot, '.claude', 'commands');
        const hooksDir = join(pRoot, '.claude', 'hooks');
        const detectedFiles: { path: string; name: string; module: string }[] = [];

        if (existsSync(commandsDir)) {
          const files = readdirSync(commandsDir).filter(f => f.endsWith('.md'));
          for (const file of files) {
            const module = FILE_MODULE_MAP[file];
            if (module) {
              detectedFiles.push({ path: join('.claude', 'commands', file), name: file, module });
            }
          }
        }

        if (existsSync(hooksDir)) {
          const files = readdirSync(hooksDir).filter(f => f.endsWith('.sh'));
          for (const file of files) {
            const module = FILE_MODULE_MAP[file];
            if (module) {
              detectedFiles.push({ path: join('.claude', 'hooks', file), name: file, module });
            }
          }
        }

        if (detectedFiles.length === 0) {
          res.warn('agent_harness 파일이 감지되지 않았습니다.');
          res.info('harness_init 도구로 새로 설치하세요.');
          return res.toResult();
        }

        const detectedModules = [...new Set(detectedFiles.map(f => f.module))];
        const resolvedModules = resolveWithDeps(detectedModules);

        res.info(`감지된 파일: ${detectedFiles.length}개`);
        res.blank();

        for (const file of detectedFiles) {
          res.line(`  ${file.path} → ${file.module} 모듈`);
        }

        res.blank();
        res.info(`마이그레이션 모듈: ${resolvedModules.join(', ')}`);

        if (pDryRun) {
          res.info('(dry-run 모드 — 실제 변경 없음)');
          return res.toResult();
        }

        res.blank();
        res.info('마이그레이션을 완료하려면 다음 도구를 호출하세요:');
        res.line(`  harness_init(projectRoot: "${pRoot}", modules: "${resolvedModules.join(',')}", installGlobal: true)`);

        if (pKeepOld) {
          res.info('기존 agent_harness 파일은 보존됩니다.');
          res.info('새 파일로 확인 후 기존 파일을 직접 삭제하세요.');
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`마이그레이션 실패: ${String(err)}`);
      }
    },
  );
}

function resolveWithDeps(modules: string[]): string[] {
  const all = new Set<string>();
  for (const mod of modules) {
    if (mod !== 'core') all.add('core');
    all.add(mod);
  }
  return Array.from(all);
}
