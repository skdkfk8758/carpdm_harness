import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../core/config.js';
import { detectCapabilities } from '../core/capability-detector.js';
import { getActiveOmcMode, getOmcVersion } from '../core/omc-bridge.js';
import { getModule } from '../core/module-registry.js';
import { computeFileHash } from '../core/file-ops.js';
import { getAllModuleFiles } from '../core/template-engine.js';
import { isGitRepo } from '../utils/git.js';
import { getOntologyStatus } from '../core/ontology/index.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerDoctorTool(server: McpServer): void {
  server.tool(
    'harness_doctor',
    '설치 건강 진단을 수행합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
    },
    async ({ projectRoot }) => {
      try {
        const res = new McpResponseBuilder();
        let issues = 0;
        let warnings = 0;

        res.header('carpdm-harness 건강 진단');
        res.blank();

        if (isGitRepo(projectRoot as string)) {
          res.check(true, 'Git 레포지토리');
        } else {
          res.warn('Git 레포지토리 아님');
          warnings++;
        }

        const config = loadConfig(projectRoot as string);
        if (!config) {
          res.check(false, 'carpdm-harness.config.json 없음');
          res.error('carpdm-harness가 설치되어 있지 않습니다.');
          return res.toResult(true);
        }
        res.check(true, `설정 파일 (v${config.version})`);

        for (const moduleName of config.modules) {
          const mod = getModule(moduleName);
          if (!mod) {
            res.line(`  ✗ 모듈 정의 없음: ${moduleName}`);
            issues++;
            continue;
          }

          const allFiles = getAllModuleFiles(mod);
          let moduleOk = true;

          for (const file of allFiles) {
            const destPath = join(projectRoot as string, file.destination);
            if (!existsSync(destPath)) {
              res.check(false, `파일 누락: ${file.destination} (${moduleName})`);
              issues++;
              moduleOk = false;
            }
          }

          if (moduleOk) {
            res.check(true, `모듈: ${moduleName} (${allFiles.length}개 파일)`);
          }
        }

        const settingsPath = join(projectRoot as string, '.claude', 'settings.local.json');
        if (config.options.hooksRegistered) {
          if (existsSync(settingsPath)) {
            res.check(true, '훅 설정 파일');
          } else {
            res.check(false, 'settings.local.json 없음 (훅 미등록)');
            issues++;
          }
        }

        let integrityOk = 0;
        let integrityModified = 0;
        for (const [relativePath, record] of Object.entries(config.files)) {
          const filePath = join(projectRoot as string, relativePath);
          if (existsSync(filePath)) {
            const currentHash = computeFileHash(filePath);
            if (currentHash === record.hash) {
              integrityOk++;
            } else {
              integrityModified++;
            }
          }
        }
        res.check(true, `파일 무결성: ${integrityOk}개 원본, ${integrityModified}개 수정됨`);

        const agentDir = join(projectRoot as string, config.options.agentDir);
        if (existsSync(agentDir)) {
          res.check(true, `에이전트 디렉토리: ${config.options.agentDir}`);
        } else {
          res.warn(`에이전트 디렉토리 없음: ${config.options.agentDir}`);
          warnings++;
        }

        // === OMC 통합 상태 점검 ===
        res.subheader('OMC 통합 상태');

        const capabilities = detectCapabilities(projectRoot as string);

        if (capabilities.omc.installed) {
          const omcVersion = getOmcVersion();
          res.check(true, `OMC 설치됨${omcVersion ? ` (v${omcVersion})` : ''}`);

          const activeMode = getActiveOmcMode(projectRoot as string);
          if (activeMode) {
            res.check(true, `OMC 활성 모드: ${activeMode}`);
          } else {
            res.line('  - OMC 활성 모드 없음');
          }
        } else {
          res.check(false, 'OMC 미설치 (harness v4.0.0 필수)');
          issues++;
        }

        // 외부 도구 상태
        res.subheader('외부 도구 상태');
        const toolEntries = [
          { key: 'serena', label: 'Serena (코드 분석)' },
          { key: 'context7', label: 'Context7 (문서 참조)' },
          { key: 'codex', label: 'Codex (AI 리뷰)' },
          { key: 'gemini', label: 'Gemini (대규모 분석)' },
        ] as const;

        for (const { key, label } of toolEntries) {
          const tool = capabilities.tools[key];
          if (tool.detected) {
            res.check(true, label);
          } else {
            res.line(`  - ${label} (미감지)`);
          }
        }

        const harnessStateDir = join(projectRoot as string, '.harness', 'state');
        if (existsSync(harnessStateDir)) {
          res.check(true, '.harness/state/ 디렉토리');
        } else {
          res.warn('.harness/state/ 없음 (harness_update 실행 권장)');
          warnings++;
        }

        // 레거시 상태 파일 잔존 감지
        const legacyStateDir = join(projectRoot as string, '.omc', 'state');
        const HARNESS_STATE_FILES = ['task-mode', 'lessons-counter', 'todo-done-count', 'edit-counter', 'cross-verified'];
        if (existsSync(legacyStateDir)) {
          for (const file of HARNESS_STATE_FILES) {
            if (existsSync(join(legacyStateDir, file))) {
              res.warn(`레거시 상태 파일 잔존: .omc/state/${file} → harness_update로 마이그레이션하세요`);
              warnings++;
            }
          }
        }

        // === Team Memory 상태 점검 ===
        if (config.modules.includes('team-memory')) {
          res.subheader('Team Memory 상태');

          const rulesDir = join(projectRoot as string, '.claude', 'rules');
          if (existsSync(rulesDir)) {
            res.check(true, '.claude/rules/ 디렉토리');
          } else {
            res.check(false, '.claude/rules/ 없음');
            issues++;
          }

          const ruleFiles = ['conventions.md', 'patterns.md', 'decisions.md', 'mistakes.md'];
          for (const file of ruleFiles) {
            const filePath = join(projectRoot as string, '.claude', 'rules', file);
            if (existsSync(filePath)) {
              const content = readFileSync(filePath, 'utf-8');
              const entryCount = (content.match(/^### /gm) || []).length;
              res.check(true, `${file} (${entryCount}개 항목)`);
            } else {
              res.check(false, `${file} 없음`);
              issues++;
            }
          }

          const keeperPath = join(projectRoot as string, '.claude', 'agents', 'team-memory-keeper.md');
          if (existsSync(keeperPath)) {
            res.check(true, 'team-memory-keeper 에이전트');
          } else {
            res.warn('team-memory-keeper 에이전트 없음');
            warnings++;
          }

          const agentMemoryDir = join(projectRoot as string, '.claude', 'agent-memory');
          if (existsSync(agentMemoryDir)) {
            res.check(true, '.claude/agent-memory/ 디렉토리');
          } else {
            res.line('  - .claude/agent-memory/ 없음 (에이전트 실행 후 자동 생성)');
          }
        }

        const ontologyConfig = config.ontology;
        if (!ontologyConfig || !ontologyConfig.enabled) {
          res.line('  - 온톨로지: 비활성화');
        } else {
          res.check(true, '온톨로지: 활성화');

          // 언어 설정 진단
          const configuredLangs = ontologyConfig.layers.semantics.languages;
          if (configuredLangs.length > 0) {
            res.check(true, `온톨로지 언어: ${configuredLangs.join(', ')}`);
            for (const lang of configuredLangs) {
              if (['typescript', 'javascript'].includes(lang)) {
                res.line(`    ✓ ${lang} 플러그인`);
              } else {
                res.warn(`${lang} 플러그인 없음 (structure만 분석)`);
                warnings++;
              }
            }
          } else {
            res.warn('온톨로지 언어 미설정 (harness_init 시 ontologyLanguages 지정 권장)');
            warnings++;
          }

          // AI 설정 진단
          if (ontologyConfig.ai) {
            if (ontologyConfig.ai.provider === 'claude-code') {
              res.check(true, 'AI 설정: claude-code (Claude Code 세션에서 직접 분석)');
            } else {
              const envKey = ontologyConfig.ai.apiKeyEnv;
              res.check(true, `AI 설정: ${ontologyConfig.ai.provider} (${envKey})`);
              if (process.env[envKey]) {
                res.line(`    ✓ 환경변수 ${envKey} 존재`);
              } else {
                res.line(`    ✗ 환경변수 ${envKey} 없음`);
                issues++;
              }
            }
            if (ontologyConfig.layers.domain.enabled) {
              res.line('    ✓ Domain 레이어 활성화');
            } else {
              res.warn('Domain 레이어 비활성화 (AI 설정은 있으나 domain.enabled=false)');
              warnings++;
            }
          } else {
            res.line('  - AI 미설정: Domain 레이어 비활성');
          }

          const outputDir = join(projectRoot as string, ontologyConfig.outputDir);
          const ontologyFiles = ['ONTOLOGY-STRUCTURE.md', 'ONTOLOGY-SEMANTICS.md', 'ONTOLOGY-DOMAIN.md'];
          for (const fname of ontologyFiles) {
            const fpath = join(outputDir, fname);
            if (existsSync(fpath)) {
              res.check(true, `온톨로지 파일: ${fname}`);
            } else {
              res.warn(`온톨로지 파일 없음: ${fname} (generate로 생성)`);
              warnings++;
            }
          }

          const status = getOntologyStatus(projectRoot as string, ontologyConfig);
          if (status) {
            const builtAt = new Date(status.generatedAt);
            const ageMs = Date.now() - builtAt.getTime();
            const ageDays = Math.floor(ageMs / 86_400_000);
            if (ageDays > 7) {
              res.warn(`온톨로지가 ${ageDays}일 전에 빌드됨 (갱신 권장)`);
              warnings++;
            } else {
              res.check(true, `온톨로지 최신 (${ageDays}일 전)`);
            }
          }

        }

        res.blank();
        if (issues === 0 && warnings === 0) {
          res.ok('모든 진단을 통과했습니다!');
        } else {
          if (issues > 0) res.error(`${issues}개 문제 발견`);
          if (warnings > 0) res.warn(`${warnings}개 경고`);
        }

        return res.toResult(issues > 0);
      } catch (err) {
        return errorResult(`진단 실패: ${String(err)}`);
      }
    },
  );
}
