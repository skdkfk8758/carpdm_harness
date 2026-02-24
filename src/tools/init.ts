import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveModules, getModule, getPresetModules } from '../core/module-registry.js';
import { createConfig, saveConfig, loadConfig } from '../core/config.js';
import { installModuleFiles, installDocsTemplates } from '../core/template-engine.js';
import { registerHooks } from '../core/hook-registrar.js';
import { ensureDir, safeCopyFile } from '../core/file-ops.js';
import { getGlobalCommandsDir, getTemplatesDir } from '../utils/paths.js';
import { buildOntology } from '../core/ontology/index.js';
import { DEFAULT_ONTOLOGY_CONFIG, ONTOLOGY_LANGUAGE_PRESETS } from '../types/ontology.js';
import { CONFIG_FILENAME } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerInitTool(server: McpServer): void {
  server.tool(
    'harness_init',
    '프로젝트에 워크플로우를 설치합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      preset: z.string().optional().describe('프리셋 (full|standard|minimal|tdd|secure)'),
      modules: z.string().optional().describe('모듈 직접 지정 (쉼표 구분)'),
      installGlobal: z.boolean().optional().default(true).describe('글로벌 커맨드 설치 (기본값: true)'),
      skipHooks: z.boolean().optional().describe('훅 등록 건너뛰기'),
      dryRun: z.boolean().optional().describe('미리보기만'),
      enableOntology: z.boolean().optional().describe('온톨로지 활성화'),
      ontologyLanguages: z.string().optional()
        .describe('온톨로지 분석 대상 언어 (typescript,python 또는 프리셋: frontend|backend|fullstack)'),
      ontologyAiApiKeyEnv: z.string().optional()
        .describe('AI Domain 레이어용 API 키 환경변수명 (예: ANTHROPIC_API_KEY)'),
    },
    async ({ projectRoot, preset, modules: modulesStr, installGlobal, skipHooks, dryRun, enableOntology, ontologyLanguages, ontologyAiApiKeyEnv }) => {
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
          for (const w of hookResult.warnings) {
            res.warn(w);
          }
          config.options.hooksRegistered = true;
        }

        // security deny 규칙 자동 적용
        if (resolvedModules.includes('security') && !pDryRun) {
          res.info('보안 deny 규칙 적용 중...');
          const denyResult = applySecurityDenyRules(pRoot);
          res.ok(`deny 규칙 ${denyResult.added}/${denyResult.total}개 추가`);
        }

        if (pInstallGlobal && !pDryRun) {
          res.info('글로벌 커맨드 설치 중...');
          installGlobalCommands();
          config.globalCommandsInstalled = true;
        }

        if (!pDryRun) {
          ensureDir(join(pRoot, '.agent'));
          ensureDir(join(pRoot, '.harness', 'state'));

          // .gitignore에 .harness/ 추가
          const gitignorePath = join(pRoot, '.gitignore');
          if (existsSync(gitignorePath)) {
            const content = readFileSync(gitignorePath, 'utf-8');
            if (!content.includes('.harness/')) {
              writeFileSync(gitignorePath, content.trimEnd() + '\n.harness/\n');
              res.info('.gitignore에 .harness/ 추가');
            }
          } else {
            writeFileSync(gitignorePath, '.harness/\n');
            res.info('.gitignore 생성 (.harness/)');
          }
        }

        let ontologyConfig;
        if (pEnableOntology) {
          const langInput = ontologyLanguages || 'typescript';
          const languages = ONTOLOGY_LANGUAGE_PRESETS[langInput]
            || langInput.split(',').map((l: string) => l.trim());

          const availablePlugins = languages.filter((l: string) => ['typescript', 'javascript'].includes(l));
          if (availablePlugins.length === 0) {
            res.warn('선택한 언어에 대한 semantics 플러그인이 아직 없습니다. Structure 레이어만 생성됩니다.');
          }

          let aiConfig: import('../types/ontology.js').AIProviderConfig | null = null;
          let domainEnabled = false;
          if (ontologyAiApiKeyEnv) {
            aiConfig = {
              provider: 'anthropic',
              apiKeyEnv: ontologyAiApiKeyEnv,
              model: 'claude-sonnet-4-20250514',
              maxTokensPerRequest: 4096,
              rateLimitMs: 1000,
            };
            domainEnabled = true;
            if (!process.env[ontologyAiApiKeyEnv]) {
              res.warn(`환경변수 ${ontologyAiApiKeyEnv}가 설정되지 않았습니다. Domain 레이어는 API 키 설정 후 동작합니다.`);
            }
          } else {
            // claude-code provider: API 키 없이 Claude Code가 직접 domain 분석
            aiConfig = {
              provider: 'claude-code',
              apiKeyEnv: '',
              model: '',
              maxTokensPerRequest: 0,
              rateLimitMs: 0,
            };
            domainEnabled = true;
          }

          ontologyConfig = {
            ...DEFAULT_ONTOLOGY_CONFIG,
            enabled: true,
            layers: {
              ...DEFAULT_ONTOLOGY_CONFIG.layers,
              semantics: { ...DEFAULT_ONTOLOGY_CONFIG.layers.semantics, languages },
              domain: { ...DEFAULT_ONTOLOGY_CONFIG.layers.domain, enabled: domainEnabled },
            },
            plugins: availablePlugins.length > 0 ? availablePlugins : [],
            ai: aiConfig,
          };
        } else {
          ontologyConfig = { ...DEFAULT_ONTOLOGY_CONFIG, enabled: false };
        }

        config.ontology = ontologyConfig;

        if (pEnableOntology && !pDryRun) {
          res.info('온톨로지 초기 생성 중...');
          try {
            const report = await buildOntology(pRoot, ontologyConfig);
            res.ok(`온톨로지 생성 완료 (${report.totalDuration}ms)`);

            if (report.domainContext) {
              res.blank();
              res.header('Domain 레이어 분석 요청');
              res.line('아래 context를 분석하여 harness_ontology_domain_write 도구로 domain 레이어를 생성하세요.');
              res.blank();
              res.info('디렉토리 구조:');
              res.line(report.domainContext.directoryTree);
              res.blank();
              res.info('package.json:');
              res.line(report.domainContext.packageJson);
              if (report.domainContext.symbolSamples) {
                res.blank();
                res.info('심볼 샘플:');
                res.line(report.domainContext.symbolSamples);
              }
              if (report.domainContext.entryPoints.length > 0) {
                res.blank();
                res.info(`진입점: ${report.domainContext.entryPoints.join(', ')}`);
              }
              if (report.domainContext.externalDeps.length > 0) {
                res.blank();
                res.info(`외부 의존성: ${report.domainContext.externalDeps.join(', ')}`);
              }
            }
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

function applySecurityDenyRules(projectRoot: string): { added: number; total: number } {
  const settingsPath = join(projectRoot, '.claude', 'settings.local.json');
  let settings: Record<string, unknown> = {};

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }

  if (!settings.permissions) {
    settings.permissions = {};
  }
  const permissions = settings.permissions as Record<string, unknown>;
  if (!Array.isArray(permissions.deny)) {
    permissions.deny = [];
  }
  const deny = permissions.deny as string[];

  const SECURITY_DENY_RULES = [
    // 파괴적 파일 작업
    'Bash(rm -rf /)*',
    'Bash(rm -rf ~)*',
    'Bash(rm -rf .)*',
    'Bash(rm -rf *)*',
    'Bash(sudo:*)',
    'Bash(chmod 777:*)',
    'Bash(>/dev/*)',
    // 외부 코드 실행
    'Bash(curl*|*sh)*',
    'Bash(wget*|*sh)*',
    'Bash(eval *)*',
    'Bash(bash -c *)*',
    'Bash(sh -c *)*',
    'Bash(node -e *)*',
    'Bash(perl -e *)*',
    'Bash(python3 -c *import os*)*',
    // 환경/프로필 보호
    'Bash(*>~/.ssh/*)',
    'Bash(*>~/.zshrc)*',
    'Bash(*>~/.bashrc)*',
    'Bash(*>~/.profile)*',
    'Bash(*>~/.zprofile)*',
    // Git 위험 명령
    'Bash(git push --force*main)*',
    'Bash(git push -f*main)*',
    'Bash(git push --force*master)*',
    'Bash(git push -f*master)*',
    'Bash(git reset --hard origin/*)*',
    'Bash(git clean -f*)*',
    'Bash(git checkout -- .)*',
    'Bash(git restore .)*',
    // 패키지 배포
    'Bash(npm publish)*',
    'Bash(pnpm publish)*',
    'Bash(yarn publish)*',
    // 시스템 명령
    'Bash(osascript*)*',
    'Bash(crontab*)*',
    'Bash(launchctl*)*',
    'Bash(docker system prune)*',
    'Bash(mkfs*)*',
    'Bash(dd if=*)*',
  ];

  let added = 0;
  for (const rule of SECURITY_DENY_RULES) {
    if (!deny.includes(rule)) {
      deny.push(rule);
      added++;
    }
  }

  if (added > 0) {
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  return { added, total: SECURITY_DENY_RULES.length };
}

function installGlobalCommands(): void {
  const globalDir = getGlobalCommandsDir();
  const templatesDir = getTemplatesDir();
  const globalTemplates = join(templatesDir, 'global');

  ensureDir(globalDir);

  const globalFiles = ['project-setup.md', 'project-init.md', 'project-setup-simple.md', 'harness-init.md', 'harness-update.md', 'workflow-guide.md', 'dashboard.md'];
  for (const file of globalFiles) {
    const src = join(globalTemplates, file);
    const dest = join(globalDir, file);
    if (existsSync(src)) {
      safeCopyFile(src, dest);
      logger.fileAction('create', `~/.claude/commands/${file}`);
    }
  }
}
