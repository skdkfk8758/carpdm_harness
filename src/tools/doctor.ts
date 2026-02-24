import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../core/config.js';
import { getModule } from '../core/module-registry.js';
import { computeFileHash } from '../core/file-ops.js';
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
          res.line('  ✓ Git 레포지토리');
        } else {
          res.line('  ! Git 레포지토리 아님');
          warnings++;
        }

        const config = loadConfig(projectRoot as string);
        if (!config) {
          res.line('  ✗ carpdm-harness.config.json 없음');
          res.error('carpdm-harness가 설치되어 있지 않습니다.');
          return res.toResult(true);
        }
        res.line(`  ✓ 설정 파일 (v${config.version})`);

        for (const moduleName of config.modules) {
          const mod = getModule(moduleName);
          if (!mod) {
            res.line(`  ✗ 모듈 정의 없음: ${moduleName}`);
            issues++;
            continue;
          }

          const allFiles = [...mod.commands, ...mod.hooks, ...mod.docs];
          let moduleOk = true;

          for (const file of allFiles) {
            const destPath = join(projectRoot as string, file.destination);
            if (!existsSync(destPath)) {
              res.line(`  ✗ 파일 누락: ${file.destination} (${moduleName})`);
              issues++;
              moduleOk = false;
            }
          }

          if (moduleOk) {
            res.line(`  ✓ 모듈: ${moduleName} (${allFiles.length}개 파일)`);
          }
        }

        const settingsPath = join(projectRoot as string, '.claude', 'settings.local.json');
        if (config.options.hooksRegistered) {
          if (existsSync(settingsPath)) {
            res.line('  ✓ 훅 설정 파일');
          } else {
            res.line('  ✗ settings.local.json 없음 (훅 미등록)');
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
        res.line(`  ✓ 파일 무결성: ${integrityOk}개 원본, ${integrityModified}개 수정됨`);

        const agentDir = join(projectRoot as string, config.options.agentDir);
        if (existsSync(agentDir)) {
          res.line(`  ✓ 에이전트 디렉토리: ${config.options.agentDir}`);
        } else {
          res.line(`  ! 에이전트 디렉토리 없음: ${config.options.agentDir}`);
          warnings++;
        }

        const ontologyConfig = config.ontology;
        if (!ontologyConfig || !ontologyConfig.enabled) {
          res.line('  - 온톨로지: 비활성화');
        } else {
          res.line('  ✓ 온톨로지: 활성화');

          const outputDir = join(projectRoot as string, ontologyConfig.outputDir);
          const ontologyFiles = ['ONTOLOGY-STRUCTURE.md', 'ONTOLOGY-SEMANTICS.md', 'ONTOLOGY-DOMAIN.md'];
          for (const fname of ontologyFiles) {
            const fpath = join(outputDir, fname);
            if (existsSync(fpath)) {
              res.line(`  ✓ 온톨로지 파일: ${fname}`);
            } else {
              res.line(`  ! 온톨로지 파일 없음: ${fname} (generate로 생성)`);
              warnings++;
            }
          }

          const status = getOntologyStatus(projectRoot as string, ontologyConfig);
          if (status) {
            const builtAt = new Date(status.generatedAt);
            const ageMs = Date.now() - builtAt.getTime();
            const ageDays = Math.floor(ageMs / 86_400_000);
            if (ageDays > 7) {
              res.line(`  ! 온톨로지가 ${ageDays}일 전에 빌드됨 (갱신 권장)`);
              warnings++;
            } else {
              res.line(`  ✓ 온톨로지 최신 (${ageDays}일 전)`);
            }
          }

          if (ontologyConfig.ai) {
            const envKey = ontologyConfig.ai.apiKeyEnv;
            if (process.env[envKey]) {
              res.line(`  ✓ AI API 키 환경변수: ${envKey}`);
            } else {
              res.line(`  ✗ AI API 키 환경변수 없음: ${envKey}`);
              issues++;
            }
          }

          if (ontologyConfig.plugins.includes('typescript')) {
            try {
              await import('typescript');
              res.line('  ✓ typescript 패키지');
            } catch {
              res.line('  ! typescript 패키지 미설치 (semantics 분석에 필요)');
              warnings++;
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
