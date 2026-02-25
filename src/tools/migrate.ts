import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, saveConfig } from '../core/config.js';
import { detectCapabilities, cacheCapabilities } from '../core/capability-detector.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';
import type { ToolResult } from '../types/mcp.js';
import { DEFAULT_OMC_CONFIG } from '../types/config.js';

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
    '기존 agent_harness 또는 v3 설정에서 v4로 마이그레이션합니다',
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

        // v3→v4 업그레이드 경로
        if (existingConfig && existingConfig.version && !existingConfig.version.startsWith('4.')) {
          return migrateV3ToV4(pRoot, existingConfig as unknown as Record<string, unknown>, pDryRun, res);
        }

        if (existingConfig && existingConfig.version?.startsWith('4.')) {
          return errorResult('이미 v4입니다. harness_update를 사용하세요.');
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

function migrateV3ToV4(
  projectRoot: string,
  config: Record<string, unknown>,
  dryRun: boolean,
  res: McpResponseBuilder,
): ToolResult {
  res.header('v3 → v4 마이그레이션');

  // 프리셋 매핑: minimal → standard
  const oldPreset = (config.preset as string) || 'standard';
  const presetMapping: Record<string, string> = {
    minimal: 'standard',
    standard: 'standard',
    full: 'full',
    tdd: 'tdd',
    secure: 'secure',
  };
  const newPreset = presetMapping[oldPreset] || 'standard';

  if (oldPreset !== newPreset) {
    res.info(`프리셋 매핑: ${oldPreset} → ${newPreset}`);
  }

  // capabilities 감지
  res.info('capabilities 감지 중...');
  let capabilities;
  try {
    capabilities = detectCapabilities(projectRoot);
    const detected: string[] = [];
    if (capabilities.omc.installed) detected.push('OMC');
    if (capabilities.tools.serena.detected) detected.push('Serena');
    if (capabilities.tools.context7.detected) detected.push('Context7');
    if (capabilities.tools.codex.detected) detected.push('Codex');
    if (capabilities.tools.gemini.detected) detected.push('Gemini');
    res.ok(`감지: ${detected.length > 0 ? detected.join(', ') : '없음'}`);
  } catch {
    res.warn('capabilities 감지 실패 (기본값 사용)');
    capabilities = null;
  }

  // 변경 사항 요약
  res.blank();
  res.info('변경 사항:');
  res.table([
    ['버전', `${config.version as string} → 4.0.0`],
    ['프리셋', `${oldPreset} → ${newPreset}`],
    ['capabilities', capabilities ? '추가' : '기본값'],
    ['omcConfig', '추가 (기본값)'],
  ]);

  if (dryRun) {
    res.blank();
    res.info('(dry-run 모드 — 실제 변경 없음)');
    return res.toResult();
  }

  // 백업
  const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
  const { join } = require('node:path');
  const backupDir = join(projectRoot, '.harness', 'backup');
  try {
    mkdirSync(backupDir, { recursive: true });
    const configPath = join(projectRoot, 'carpdm-harness.config.json');
    writeFileSync(
      join(backupDir, `config-v${config.version as string}-${Date.now()}.json`),
      readFileSync(configPath, 'utf-8'),
    );
    res.ok('기존 설정 백업 완료');
  } catch {
    res.warn('백업 실패 (계속 진행)');
  }

  // 설정 업그레이드
  config.version = '4.0.0';
  config.preset = newPreset;
  if (capabilities) {
    config.capabilities = capabilities;
    cacheCapabilities(projectRoot, capabilities);
  }
  if (!config.omcConfig) {
    config.omcConfig = { ...DEFAULT_OMC_CONFIG };
  }

  saveConfig(projectRoot, config as any);

  res.blank();
  res.ok('v4.0.0 마이그레이션 완료');
  res.info('`harness_doctor`로 건강 진단을 권장합니다.');

  return res.toResult();
}
