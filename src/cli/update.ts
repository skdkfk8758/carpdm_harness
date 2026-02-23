import { loadConfig, saveConfig, updateFileRecord } from '../core/config.js';
import { analyzeChanges, generateDiff } from '../core/diff-engine.js';
import { getModule, getAllModules } from '../core/module-registry.js';
import { safeCopyFile, computeFileHash, backupFile } from '../core/file-ops.js';
import { getTemplatesDir } from '../utils/paths.js';
import { getPackageVersion } from '../utils/version.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';
import { join } from 'node:path';

interface UpdateOptions {
  all?: boolean;
  module?: string;
  global?: boolean;
  dryRun?: boolean;
  acceptAll?: boolean;
}

export async function updateCommand(options: UpdateOptions): Promise<void> {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);

  if (!config) {
    logger.error('carpdm-harness가 설치되어 있지 않습니다. 먼저 init을 실행하세요.');
    return;
  }

  logger.header('carpdm-harness 업데이트');

  const changes = analyzeChanges(config, projectRoot);

  // 특정 모듈 필터
  const filteredChanges = options.module
    ? changes.filter(c => c.module === options.module)
    : changes;

  if (filteredChanges.length === 0) {
    logger.ok('모든 파일이 최신 상태입니다.');
    return;
  }

  logger.info(`${filteredChanges.length}개 파일에 변경사항 발견:`);
  console.log('');

  const templatesDir = getTemplatesDir();
  const modules = getAllModules();
  const version = getPackageVersion();
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;

  for (const change of filteredChanges) {
    const mod = modules[change.module];
    if (!mod) continue;

    const allFiles = [...mod.commands, ...mod.hooks, ...mod.docs];
    const modFile = allFiles.find(f => f.destination === change.relativePath);
    if (!modFile) continue;

    const statusColor = {
      UPSTREAM_CHANGED: chalk.yellow,
      USER_MODIFIED: chalk.blue,
      CONFLICT: chalk.red,
    }[change.status] || chalk.dim;

    console.log(`  ${statusColor(`[${change.status}]`)} ${change.relativePath}`);

    if (change.status === 'UPSTREAM_CHANGED') {
      if (options.dryRun) {
        const diff = generateDiff(projectRoot, change.relativePath, modFile.source);
        console.log(chalk.dim(diff));
      }

      if (options.acceptAll || options.dryRun) {
        if (!options.dryRun) {
          const srcPath = join(templatesDir, modFile.source);
          const destPath = join(projectRoot, change.relativePath);
          safeCopyFile(srcPath, destPath, modFile.executable);
          const hash = computeFileHash(destPath);
          updateFileRecord(config, change.relativePath, change.module, version, hash);
          logger.fileAction('update', change.relativePath);
        }
        updated++;
      } else {
        // 대화형: 사용자에게 선택 요청
        const inquirer = await import('inquirer');
        const diff = generateDiff(projectRoot, change.relativePath, modFile.source);
        console.log(chalk.dim(diff));

        const { action } = await inquirer.default.prompt([{
          type: 'list',
          name: 'action',
          message: `${change.relativePath}:`,
          choices: [
            { name: '[A] 수락 (Accept)', value: 'accept' },
            { name: '[S] 건너뛰기 (Skip)', value: 'skip' },
            { name: '[B] 백업 후 수락 (Backup+Accept)', value: 'backup' },
          ],
        }]);

        if (action === 'accept' || action === 'backup') {
          if (action === 'backup') {
            backupFile(join(projectRoot, change.relativePath));
          }
          const srcPath = join(templatesDir, modFile.source);
          const destPath = join(projectRoot, change.relativePath);
          safeCopyFile(srcPath, destPath, modFile.executable);
          const hash = computeFileHash(destPath);
          updateFileRecord(config, change.relativePath, change.module, version, hash);
          logger.fileAction('update', change.relativePath);
          updated++;
        } else {
          skipped++;
        }
      }
    } else if (change.status === 'USER_MODIFIED') {
      logger.fileAction('skip', `${change.relativePath} (사용자 수정됨)`);
      skipped++;
    } else if (change.status === 'CONFLICT') {
      conflicts++;
      if (!options.acceptAll) {
        const inquirer = await import('inquirer');
        const diff = generateDiff(projectRoot, change.relativePath, modFile.source);
        console.log(chalk.dim(diff));

        const { action } = await inquirer.default.prompt([{
          type: 'list',
          name: 'action',
          message: `충돌: ${change.relativePath}:`,
          choices: [
            { name: '[A] 새 버전으로 교체', value: 'accept' },
            { name: '[K] 현재 파일 유지', value: 'keep' },
            { name: '[B] 백업 후 교체', value: 'backup' },
          ],
        }]);

        if (action === 'accept' || action === 'backup') {
          if (action === 'backup') {
            backupFile(join(projectRoot, change.relativePath));
          }
          const srcPath = join(templatesDir, modFile.source);
          const destPath = join(projectRoot, change.relativePath);
          safeCopyFile(srcPath, destPath, modFile.executable);
          const hash = computeFileHash(destPath);
          updateFileRecord(config, change.relativePath, change.module, version, hash);
          updated++;
        } else {
          skipped++;
        }
      }
    }
  }

  if (!options.dryRun) {
    saveConfig(projectRoot, config);
  }

  console.log('');
  logger.header('업데이트 결과');
  logger.table([
    ['업데이트', `${updated}개`],
    ['건너뜀', `${skipped}개`],
    ['충돌', `${conflicts}개`],
  ]);
}
