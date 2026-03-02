import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { join } from 'node:path';
import { resolveModules, getModule, getPresetModules } from '../core/module-registry.js';
import { createConfig, saveConfig, loadConfig } from '../core/config.js';
import { installModuleFiles, installDocsTemplates } from '../core/template-engine.js';
import { registerHooks } from '../core/hook-registrar.js';
import { ensureDir } from '../core/file-ops.js';
import { buildOntology } from '../core/ontology/index.js';
import { setupGithubLabels } from '../core/github-labels.js';
import { DEFAULT_ONTOLOGY_CONFIG, ONTOLOGY_LANGUAGE_PRESETS } from '../types/ontology.js';
import { CONFIG_FILENAME } from '../types/config.js';
import { requireOmc, detectCapabilities } from '../core/capability-detector.js';
import { bootstrapProjectSettings, getCapabilityAllowRules } from '../core/settings-bootstrap.js';
import { applyOverlapChoices } from '../core/overlap-applier.js';
import type { OverlapChoices } from '../types/overlap.js';
import {
  regenerateOntologyIndex,
  syncTeamMemoryMd,
  ensureKnowledgeVault,
  ensureClaudeMd,
  checkMcpConflict,
  detectAndCacheCapabilities,
  ensureGitignoreEntries,
  installTriggers,
  scanOverlapsWithCaps,
} from '../core/post-install-tasks.js';
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
      overlapChoices: z.string().optional()
        .describe('중복 처리 선택 JSON. harness_setup 결과를 참고하여 전달. {"applyDefaults":true}로 권장 설정 일괄 적용'),
    },
    async ({ projectRoot, preset, modules: modulesStr, skipHooks, dryRun, enableOntology, ontologyLanguages, ontologyAiApiKeyEnv, overlapChoices: overlapChoicesStr }) => {
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
        // capabilities를 한 번만 감지하여 재사용
        let capabilities: import('../types/capabilities.js').CapabilityResult | null = null;

        if (!pDryRun) {
          res.info('필수 설정 부트스트랩 중...');

          // capabilities 기반 추가 allow 규칙
          let extraAllow: string[] = [];
          try {
            capabilities = detectCapabilities(pRoot);
            extraAllow = getCapabilityAllowRules(capabilities);
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

          // Phase 4.5: 중복 적용 (capabilities 재사용)
          if (overlapChoicesStr) {
            try {
              const choices = JSON.parse(overlapChoicesStr as string) as OverlapChoices;
              const scan = scanOverlapsWithCaps(pRoot, config, capabilities);
              if (scan && scan.totalOverlaps > 0) {
                const overlapResult = applyOverlapChoices(pRoot, scan, choices);
                config.overlapPreferences = {
                  lastOptimizedAt: new Date().toISOString(),
                  decisions: choices.applyDefaults
                    ? Object.fromEntries(scan.items.map(i => [i.id, i.recommended]))
                    : choices.decisions ?? {},
                };
                res.ok(`중복 처리 완료: ${overlapResult.applied}개 적용, ${overlapResult.skipped}개 유지`);
                for (const e of overlapResult.errors) {
                  res.warn(e);
                }
              }
            } catch (err) {
              res.warn(`중복 처리 실패 (무시하고 계속): ${String(err)}`);
            }
          }
        }

        if (!pDryRun) {
          ensureDir(join(pRoot, '.agent'));
          ensureDir(join(pRoot, '.harness', 'state'));
          installTriggers(pRoot, res);
          ensureGitignoreEntries(pRoot, ['.harness/', '.knowledge/'], res);
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
          regenerateOntologyIndex(pRoot, res);
          ensureKnowledgeVault(pRoot, config, { ontologyEnabled: pEnableOntology }, res);

          if (resolvedModules.includes('team-memory')) {
            syncTeamMemoryMd(pRoot, res);
          }

          // capabilities 캐시 (이미 감지한 것 재사용, 없으면 새로 감지)
          if (capabilities) {
            config.capabilities = capabilities;
            detectAndCacheCapabilities(pRoot, config);
          } else {
            detectAndCacheCapabilities(pRoot, config);
          }

          saveConfig(pRoot, config);
          ensureClaudeMd(pRoot, res);

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

        checkMcpConflict(pRoot, res);

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


