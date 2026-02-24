import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveModules, getModule, getPresetModules } from '../core/module-registry.js';
import { createConfig, saveConfig, loadConfig } from '../core/config.js';
import { installModuleFiles, installDocsTemplates } from '../core/template-engine.js';
import { registerHooks } from '../core/hook-registrar.js';
import { ensureDir, safeCopyFile } from '../core/file-ops.js';
import { getGlobalCommandsDir, getTemplatesDir } from '../utils/paths.js';
import { buildOntology } from '../core/ontology/index.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';
import { CONFIG_FILENAME } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerInitTool(server: McpServer): void {
  server.tool(
    'harness_init',
    '프로젝트에 워크플로우를 설치합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      preset: z.string().optional().describe('프리셋 (full|standard|minimal|tdd)'),
      modules: z.string().optional().describe('모듈 직접 지정 (쉼표 구분)'),
      installGlobal: z.boolean().optional().describe('글로벌 커맨드 설치'),
      skipHooks: z.boolean().optional().describe('훅 등록 건너뛰기'),
      dryRun: z.boolean().optional().describe('미리보기만'),
      enableOntology: z.boolean().optional().describe('온톨로지 활성화'),
    },
    async ({ projectRoot, preset, modules: modulesStr, installGlobal, skipHooks, dryRun, enableOntology }) => {
      try {
        logger.clear();
        const res = new McpResponseBuilder();
        const pRoot = projectRoot as string;
        const pPreset = (preset as string) || 'standard';
        const pInstallGlobal = installGlobal !== false;
        const pSkipHooks = skipHooks === true;
        const pDryRun = dryRun === true;
        const pEnableOntology = enableOntology === true;

        const existingConfig = loadConfig(pRoot);
        if (existingConfig) {
          return errorResult(`이미 설치되어 있습니다 (preset: ${existingConfig.preset}). harness_update를 사용하세요.`);
        }

        let moduleList: string[];
        if (modulesStr) {
          moduleList = (modulesStr as string).split(',').map(m => m.trim());
        } else {
          moduleList = getPresetModules(pPreset);
        }

        const resolvedModules = resolveModules(moduleList);

        res.header('carpdm-harness 설치');
        res.line(`  프리셋: ${pPreset}`);
        res.line(`  모듈: ${resolvedModules.join(', ')}`);
        res.blank();

        const config = createConfig(pRoot, pPreset, resolvedModules, {
          hooksRegistered: !pSkipHooks,
          docsTemplatesDir: 'docs/templates',
          agentDir: '.agent',
        });

        let totalInstalled = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        for (const moduleName of resolvedModules) {
          const mod = getModule(moduleName);
          if (!mod) {
            res.warn(`모듈을 찾을 수 없음: ${moduleName}`);
            continue;
          }

          res.info(`모듈 설치: ${moduleName}`);
          const result = installModuleFiles(mod, pRoot, config, pDryRun);
          totalInstalled += result.installed.length;
          totalSkipped += result.skipped.length;
          totalErrors += result.errors.length;

          if (mod.docs.length > 0) {
            const docsResult = installDocsTemplates(mod, pRoot, 'docs/templates', config, pDryRun);
            totalInstalled += docsResult.installed.length;
            totalSkipped += docsResult.skipped.length;
          }
        }

        if (!pSkipHooks && !pDryRun) {
          res.info('훅 등록 중...');
          const hookResult = registerHooks(resolvedModules, pRoot, pDryRun);
          res.ok(`훅 ${hookResult.registered}/${hookResult.total}개 등록`);
          config.options.hooksRegistered = true;
        }

        if (pInstallGlobal && !pDryRun) {
          res.info('글로벌 커맨드 설치 중...');
          installGlobalCommands();
          config.globalCommandsInstalled = true;
        }

        if (!pDryRun) {
          ensureDir(join(pRoot, '.agent'));
        }

        const ontologyConfig = pEnableOntology
          ? { ...DEFAULT_ONTOLOGY_CONFIG, enabled: true }
          : { ...DEFAULT_ONTOLOGY_CONFIG, enabled: false };

        config.ontology = ontologyConfig;

        if (pEnableOntology && !pDryRun) {
          res.info('온톨로지 초기 생성 중...');
          try {
            const report = await buildOntology(pRoot, ontologyConfig);
            res.ok(`온톨로지 생성 완료 (${report.totalDuration}ms)`);
          } catch (err) {
            res.warn(`온톨로지 생성 실패 (무시하고 계속): ${String(err)}`);
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
        res.header('설치 완료');
        res.table([
          ['설치됨', `${totalInstalled}개 파일`],
          ['건너뜀', `${totalSkipped}개 파일`],
          ['오류', `${totalErrors}개`],
          ['설정 파일', CONFIG_FILENAME],
        ]);

        return res.toResult();
      } catch (err) {
        return errorResult(`설치 실패: ${String(err)}`);
      }
    },
  );
}

function installGlobalCommands(): void {
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
