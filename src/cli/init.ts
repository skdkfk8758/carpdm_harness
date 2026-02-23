import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadPreset, resolveModules, getModule, getModuleNames, getPresetNames, getPresetModules } from '../core/module-registry.js';
import { createConfig, saveConfig, loadConfig } from '../core/config.js';
import { installModuleFiles, installDocsTemplates } from '../core/template-engine.js';
import { registerHooks } from '../core/hook-registrar.js';
import { ensureDir } from '../core/file-ops.js';
import { getGlobalCommandsDir, getTemplatesDir } from '../utils/paths.js';
import { safeCopyFile, computeFileHash } from '../core/file-ops.js';
import { updateFileRecord } from '../core/config.js';
import { getPackageVersion } from '../utils/version.js';
import { logger } from '../utils/logger.js';
import { runInitPrompts } from '../prompts/init-prompts.js';
import { CONFIG_FILENAME } from '../types/config.js';
import chalk from 'chalk';

interface InitOptions {
  preset?: string;
  modules?: string;
  global?: boolean;
  skipHooks?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const projectRoot = process.cwd();

  // 이미 설치되어 있는지 확인
  const existingConfig = loadConfig(projectRoot);
  if (existingConfig) {
    logger.warn(`이미 설치되어 있습니다 (preset: ${existingConfig.preset})`);
    logger.info('업데이트하려면 carpdm-harness update를 사용하세요.');
    return;
  }

  let preset: string;
  let modules: string[];
  let installGlobal: boolean;
  let skipHooks: boolean;
  let docsDir = 'docs/templates';
  let agentDir = '.agent';

  if (options.yes) {
    // 비대화형 모드
    preset = options.preset || 'standard';
    if (options.modules) {
      modules = options.modules.split(',').map(m => m.trim());
    } else {
      modules = getPresetModules(preset);
    }
    installGlobal = options.global ?? true;
    skipHooks = options.skipHooks ?? false;
  } else {
    // 대화형 모드
    const answers = await runInitPrompts(getPresetNames(), getModuleNames());
    if (!answers.confirm) {
      logger.info('설치가 취소되었습니다.');
      return;
    }
    preset = answers.preset;
    modules = answers.preset === 'custom'
      ? answers.modules
      : getPresetModules(answers.preset);
    installGlobal = answers.installGlobal;
    skipHooks = !answers.registerHooks;
    docsDir = answers.docsDir;
    agentDir = answers.agentDir;
  }

  // 의존성 해석
  const resolvedModules = resolveModules(modules);

  logger.header('carpdm-harness 설치');
  console.log(`  프리셋: ${chalk.bold(preset)}`);
  console.log(`  모듈: ${chalk.bold(resolvedModules.join(', '))}`);
  console.log('');

  // 설정 생성
  const config = createConfig(projectRoot, preset, resolvedModules, {
    hooksRegistered: !skipHooks,
    docsTemplatesDir: docsDir,
    agentDir,
  });

  // 모듈별 파일 설치
  let totalInstalled = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const moduleName of resolvedModules) {
    const mod = getModule(moduleName);
    if (!mod) {
      logger.warn(`모듈을 찾을 수 없음: ${moduleName}`);
      continue;
    }

    logger.info(`모듈 설치: ${chalk.bold(moduleName)}`);
    const result = installModuleFiles(mod, projectRoot, config, options.dryRun);
    totalInstalled += result.installed.length;
    totalSkipped += result.skipped.length;
    totalErrors += result.errors.length;

    // 문서 템플릿 설치
    if (mod.docs.length > 0) {
      const docsResult = installDocsTemplates(mod, projectRoot, docsDir, config, options.dryRun);
      totalInstalled += docsResult.installed.length;
      totalSkipped += docsResult.skipped.length;
    }
  }

  // 훅 등록
  if (!skipHooks && !options.dryRun) {
    logger.info('훅 등록 중...');
    const hookResult = registerHooks(resolvedModules, projectRoot, options.dryRun);
    logger.ok(`훅 ${hookResult.registered}/${hookResult.total}개 등록`);
    config.options.hooksRegistered = true;
  }

  // 글로벌 커맨드 설치
  if (installGlobal && !options.dryRun) {
    logger.info('글로벌 커맨드 설치 중...');
    installGlobalCommands(config);
    config.globalCommandsInstalled = true;
  }

  // .agent 디렉토리 생성
  if (!options.dryRun) {
    ensureDir(join(projectRoot, agentDir));
  }

  // 설정 저장
  if (!options.dryRun) {
    saveConfig(projectRoot, config);
  }

  // 결과 출력
  console.log('');
  logger.header('설치 완료');
  logger.table([
    ['설치됨', `${totalInstalled}개 파일`],
    ['건너뜀', `${totalSkipped}개 파일`],
    ['오류', `${totalErrors}개`],
    ['설정 파일', CONFIG_FILENAME],
  ]);
  console.log('');
}

function installGlobalCommands(config: any): void {
  const globalDir = getGlobalCommandsDir();
  const templatesDir = getTemplatesDir();
  const globalTemplates = join(templatesDir, 'global');

  ensureDir(globalDir);

  const globalFiles = ['project-setup.md', 'project-init.md', 'project-setup-simple.md'];
  for (const file of globalFiles) {
    const src = join(globalTemplates, file);
    const dest = join(globalDir, file);
    if (existsSync(src)) {
      safeCopyFile(src, dest);
      logger.fileAction('create', `~/.claude/commands/${file}`);
    }
  }
}
