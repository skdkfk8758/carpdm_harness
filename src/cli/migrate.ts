import { existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadConfig } from '../core/config.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

interface MigrateOptions {
  source?: string;
  dryRun?: boolean;
  keepOld?: boolean;
}

// agent_harness 파일 → carpdm-harness 모듈 매핑
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

export async function migrateCommand(options: MigrateOptions): Promise<void> {
  const projectRoot = process.cwd();

  // 이미 설치된 경우
  const existingConfig = loadConfig(projectRoot);
  if (existingConfig) {
    logger.warn('carpdm-harness가 이미 설치되어 있습니다.');
    logger.info('update 커맨드를 사용하세요.');
    return;
  }

  logger.header('agent_harness → carpdm-harness 마이그레이션');

  // 기존 파일 스캔
  const commandsDir = join(projectRoot, '.claude', 'commands');
  const hooksDir = join(projectRoot, '.claude', 'hooks');
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
    logger.warn('agent_harness 파일이 감지되지 않았습니다.');
    logger.info('init 커맨드로 새로 설치하세요.');
    return;
  }

  // 모듈 추론
  const detectedModules = [...new Set(detectedFiles.map(f => f.module))];
  const resolvedModules = resolveWithDeps(detectedModules);

  logger.info(`감지된 파일: ${detectedFiles.length}개`);
  console.log('');

  for (const file of detectedFiles) {
    console.log(`  ${chalk.dim(file.path)} → ${chalk.bold(file.module)} 모듈`);
  }

  console.log('');
  logger.info(`마이그레이션 모듈: ${resolvedModules.join(', ')}`);

  if (options.dryRun) {
    logger.info('(dry-run 모드 — 실제 변경 없음)');
    return;
  }

  // init을 내부적으로 실행
  const { initCommand } = await import('./init.js');
  await initCommand({
    modules: resolvedModules.join(','),
    global: true,
    yes: true,
  });

  logger.ok('마이그레이션 완료!');
  if (!options.keepOld) {
    logger.info('기존 agent_harness 파일은 보존되었습니다 (--keep-old 기본 동작).');
    logger.info('새 파일로 확인 후 기존 파일을 직접 삭제하세요.');
  }
}

function resolveWithDeps(modules: string[]): string[] {
  const all = new Set<string>();
  for (const mod of modules) {
    if (mod !== 'core') all.add('core');
    all.add(mod);
  }
  return Array.from(all);
}
