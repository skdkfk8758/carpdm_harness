import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../core/config.js';
import { getModule } from '../core/module-registry.js';
import { computeFileHash } from '../core/file-ops.js';
import { isGitRepo } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

export async function doctorCommand(): Promise<void> {
  const projectRoot = process.cwd();
  let issues = 0;
  let warnings = 0;

  logger.header('carpdm-harness 건강 진단');
  console.log('');

  // 1. Git 레포 확인
  if (isGitRepo(projectRoot)) {
    console.log(`  ${chalk.green('✓')} Git 레포지토리`);
  } else {
    console.log(`  ${chalk.yellow('!')} Git 레포지토리 아님`);
    warnings++;
  }

  // 2. 설정 파일 확인
  const config = loadConfig(projectRoot);
  if (!config) {
    console.log(`  ${chalk.red('✗')} carpdm-harness.config.json 없음`);
    logger.error('carpdm-harness가 설치되어 있지 않습니다.');
    return;
  }
  console.log(`  ${chalk.green('✓')} 설정 파일 (v${config.version})`);

  // 3. 모듈별 파일 존재 확인
  for (const moduleName of config.modules) {
    const mod = getModule(moduleName);
    if (!mod) {
      console.log(`  ${chalk.red('✗')} 모듈 정의 없음: ${moduleName}`);
      issues++;
      continue;
    }

    const allFiles = [...mod.commands, ...mod.hooks, ...mod.docs];
    let moduleOk = true;

    for (const file of allFiles) {
      const destPath = join(projectRoot, file.destination);
      if (!existsSync(destPath)) {
        console.log(`  ${chalk.red('✗')} 파일 누락: ${file.destination} (${moduleName})`);
        issues++;
        moduleOk = false;
      }
    }

    if (moduleOk) {
      console.log(`  ${chalk.green('✓')} 모듈: ${moduleName} (${allFiles.length}개 파일)`);
    }
  }

  // 4. 훅 등록 확인
  const settingsPath = join(projectRoot, '.claude', 'settings.local.json');
  if (config.options.hooksRegistered) {
    if (existsSync(settingsPath)) {
      console.log(`  ${chalk.green('✓')} 훅 설정 파일`);
    } else {
      console.log(`  ${chalk.red('✗')} settings.local.json 없음 (훅 미등록)`);
      issues++;
    }
  }

  // 5. 파일 무결성 확인
  let integrityOk = 0;
  let integrityModified = 0;
  for (const [relativePath, record] of Object.entries(config.files)) {
    const filePath = join(projectRoot, relativePath);
    if (existsSync(filePath)) {
      const currentHash = computeFileHash(filePath);
      if (currentHash === record.hash) {
        integrityOk++;
      } else {
        integrityModified++;
      }
    }
  }
  console.log(`  ${chalk.green('✓')} 파일 무결성: ${integrityOk}개 원본, ${integrityModified}개 수정됨`);

  // 6. .agent 디렉토리 확인
  const agentDir = join(projectRoot, config.options.agentDir);
  if (existsSync(agentDir)) {
    console.log(`  ${chalk.green('✓')} 에이전트 디렉토리: ${config.options.agentDir}`);
  } else {
    console.log(`  ${chalk.yellow('!')} 에이전트 디렉토리 없음: ${config.options.agentDir}`);
    warnings++;
  }

  // 결과
  console.log('');
  if (issues === 0 && warnings === 0) {
    logger.ok('모든 진단을 통과했습니다!');
  } else {
    if (issues > 0) logger.error(`${issues}개 문제 발견`);
    if (warnings > 0) logger.warn(`${warnings}개 경고`);
  }
}
