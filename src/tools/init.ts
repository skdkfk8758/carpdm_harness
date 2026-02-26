import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveModules, getModule, getPresetModules } from '../core/module-registry.js';
import { createConfig, saveConfig, loadConfig } from '../core/config.js';
import { installModuleFiles, installDocsTemplates } from '../core/template-engine.js';
import { registerHooks } from '../core/hook-registrar.js';
import { ensureDir, safeWriteFile } from '../core/file-ops.js';
import { buildOntology, collectIndexData } from '../core/ontology/index.js';
import { renderIndexMarkdown } from '../core/ontology/markdown-renderer.js';
import { loadStore, syncMemoryMd } from '../core/team-memory.js';
import { getPackageVersion } from '../utils/version.js';
import { syncClaudeMd } from '../core/claudemd-sync.js';
import { setupGithubLabels } from '../core/github-labels.js';
import { getTemplatesDir } from '../utils/paths.js';
import { DEFAULT_ONTOLOGY_CONFIG, ONTOLOGY_LANGUAGE_PRESETS } from '../types/ontology.js';
import { CONFIG_FILENAME } from '../types/config.js';
import { requireOmc, detectCapabilities, cacheCapabilities } from '../core/capability-detector.js';
import { bootstrapProjectSettings, getCapabilityAllowRules } from '../core/settings-bootstrap.js';
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
      skipHooks: z.boolean().optional().describe('훅 등록 건너뛰기'),
      dryRun: z.boolean().optional().describe('미리보기만'),
      enableOntology: z.boolean().optional().describe('온톨로지 활성화'),
      ontologyLanguages: z.string().optional()
        .describe('온톨로지 분석 대상 언어 (typescript,python 또는 프리셋: frontend|backend|fullstack)'),
      ontologyAiApiKeyEnv: z.string().optional()
        .describe('AI Domain 레이어용 API 키 환경변수명 (예: ANTHROPIC_API_KEY)'),
    },
    async ({ projectRoot, preset, modules: modulesStr, skipHooks, dryRun, enableOntology, ontologyLanguages, ontologyAiApiKeyEnv }) => {
      try {
        logger.clear();
        const res = new McpResponseBuilder();
        const pRoot = projectRoot as string;
        const pPreset = (preset as string) || 'standard';
        const pSkipHooks = skipHooks === true;
        const pDryRun = dryRun === true;
        const pEnableOntology = enableOntology === true;

        // OMC 필수 검증
        try {
          requireOmc();
        } catch (err) {
          res.error('OMC(oh-my-claudecode)가 설치되어 있지 않습니다.');
          res.blank();
          res.info('carpdm-harness v4.0.0은 OMC를 필수로 요구합니다.');
          res.info('설치: npm i -g oh-my-claudecode && omc setup');
          return res.toResult(true);
        }

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

        // 필수 설정 부트스트랩 (모든 프리셋에 적용)
        if (!pDryRun) {
          res.info('필수 설정 부트스트랩 중...');

          // capabilities 기반 추가 allow 규칙
          let extraAllow: string[] = [];
          try {
            const caps = detectCapabilities(pRoot);
            extraAllow = getCapabilityAllowRules(caps);
          } catch {
            // 감지 실패 시 빈 배열
          }

          const bsResult = bootstrapProjectSettings(pRoot, {
            includeSecurityModule: resolvedModules.includes('security'),
            extraAllow,
          });

          res.ok(`settings.local.json 부트스트랩 완료`);
          res.line(`  allow: +${bsResult.allowAdded} (총 ${bsResult.totalAllow})`);
          res.line(`  deny: +${bsResult.denyAdded} (총 ${bsResult.totalDeny})`);
          if (bsResult.askAdded > 0) res.line(`  ask: +${bsResult.askAdded}`);
          if (bsResult.envAdded > 0) res.line(`  env: +${bsResult.envAdded}`);
          if (bsResult.languageSet) res.line(`  language: Korea`);
        }

        if (!pDryRun) {
          ensureDir(join(pRoot, '.agent'));
          ensureDir(join(pRoot, '.harness', 'state'));

          // triggers.json 설치 (스킬 트리거 매니페스트)
          try {
            const triggersSrc = join(getTemplatesDir(), 'triggers.json');
            if (existsSync(triggersSrc)) {
              const triggersDest = join(pRoot, '.harness', 'triggers.json');
              const content = readFileSync(triggersSrc, 'utf-8');
              writeFileSync(triggersDest, content);
              res.ok('스킬 트리거 매니페스트 설치');
            }
          } catch (err) {
            res.warn(`triggers.json 설치 실패: ${String(err)}`);
          }

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
          // .agent/ INDEX 생성 (온톨로지 유무와 무관)
          try {
            const version = getPackageVersion();
            const indexData = collectIndexData(pRoot, version);
            const indexContent = renderIndexMarkdown(indexData);
            const indexPath = join(pRoot, '.agent', 'ontology', 'ONTOLOGY-INDEX.md');
            ensureDir(join(pRoot, '.agent', 'ontology'));
            safeWriteFile(indexPath, indexContent);
            res.ok('ONTOLOGY-INDEX.md 생성 완료');
          } catch (err) {
            res.warn(`INDEX 생성 실패: ${String(err)}`);
          }

          // memory.md 초기 동기화
          if (resolvedModules.includes('team-memory')) {
            try {
              const store = loadStore(pRoot);
              syncMemoryMd(pRoot, store);
              res.ok('.agent/memory.md 초기 동기화 완료');
            } catch (err) {
              res.warn(`memory.md 동기화 실패: ${String(err)}`);
            }
          }

          // capabilities 감지 및 캐시
          try {
            const capabilities = detectCapabilities(pRoot);
            config.capabilities = capabilities;
            cacheCapabilities(pRoot, capabilities);
          } catch {
            // 감지 실패는 무시
          }

          saveConfig(pRoot, config);

          // CLAUDE.md 생성 (없을 때만) + 마커 영역 자동 갱신
          const claudeMdPath = join(pRoot, 'CLAUDE.md');
          if (!existsSync(claudeMdPath)) {
            try {
              const templatePath = join(getTemplatesDir(), 'core', 'CLAUDE.md.template');
              if (existsSync(templatePath)) {
                const projectName = pRoot.split('/').pop() || 'my-project';
                const template = readFileSync(templatePath, 'utf-8');
                const content = template.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
                safeWriteFile(claudeMdPath, content);
                res.ok('CLAUDE.md 기본 템플릿 생성');
              }
            } catch (err) {
              res.warn(`CLAUDE.md 생성 실패: ${String(err)}`);
            }
          }
          const claudeResult = syncClaudeMd(pRoot);
          if (claudeResult.updated) {
            res.ok('CLAUDE.md 자동 섹션 갱신 완료');
          }

          // GitHub Labels 자동 생성 (ship 모듈 포함 시)
          if (resolvedModules.includes('ship')) {
            try {
              const labelResult = setupGithubLabels(pRoot);
              if (!labelResult.ghAvailable) {
                res.warn('gh CLI 미인증 — GitHub 라벨 자동 생성 건너뜀 (gh auth login 후 harness_github_setup으로 재시도)');
              } else if (labelResult.created.length > 0) {
                res.ok(`GitHub 라벨 ${labelResult.created.length}개 생성: ${labelResult.created.join(', ')}`);
                if (labelResult.skipped.length > 0) {
                  res.info(`기존 라벨 ${labelResult.skipped.length}개 유지`);
                }
              } else {
                res.ok(`GitHub 라벨 이미 모두 존재 (${labelResult.skipped.length}개)`);
              }
              for (const e of labelResult.errors) {
                res.warn(`라벨 생성 실패: ${e}`);
              }
            } catch (err) {
              res.warn(`GitHub 라벨 설정 실패 (무시하고 계속): ${String(err)}`);
            }
          }
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


