import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import { loadConfig } from '../core/config.js';
import { QualityGateRunner } from '../core/quality-gate/index.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';
import type { TrustCriterion, ValidationContext } from '../types/quality-gate.js';
import { DEFAULT_QUALITY_GATE_CONFIG, TRUST_CRITERIA_ORDER } from '../types/quality-gate.js';

export function registerQualityCheckTool(server: McpServer): void {
  server.tool(
    'harness_quality_check',
    'TRUST 5 품질 게이트를 수동 실행합니다 (Tested, Readable, Unified, Secured, Trackable)',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      files: z.array(z.string()).optional().describe('검증 대상 파일 목록 (미지정 시 git staged 파일)'),
      criteria: z.array(z.enum(['tested', 'readable', 'unified', 'secured', 'trackable']))
        .optional().describe('실행할 기준 (미지정 시 전체)'),
      verbose: z.boolean().optional().describe('상세 출력 (기본: false)'),
    },
    async ({ projectRoot, files, criteria, verbose }) => {
      try {
        const config = loadConfig(projectRoot as string);
        const qualityGateConfig = config?.qualityGate ?? DEFAULT_QUALITY_GATE_CONFIG;

        // files 미지정 시 git staged 파일 사용
        let targetFiles: string[] = files ?? [];
        if (targetFiles.length === 0) {
          try {
            const staged = execSync('git diff --cached --name-only', {
              cwd: projectRoot as string,
              stdio: 'pipe',
            }).toString().trim();

            if (staged) {
              targetFiles = staged.split('\n').filter(Boolean);
            } else {
              // staged 파일 없으면 최근 커밋 변경 파일
              const lastCommit = execSync('git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD', {
                cwd: projectRoot as string,
                stdio: 'pipe',
              }).toString().trim();
              targetFiles = lastCommit ? lastCommit.split('\n').filter(Boolean) : [];
            }
          } catch {
            targetFiles = [];
          }
        }

        // criteria로 skip 목록 생성
        const skip: TrustCriterion[] = criteria
          ? TRUST_CRITERIA_ORDER.filter(c => !criteria.includes(c))
          : qualityGateConfig.skip ?? [];

        const validationContext: ValidationContext = {
          projectRoot: projectRoot as string,
          targetFiles,
          config: { ...qualityGateConfig, skip },
          gitStagedFiles: targetFiles,
        };

        const runner = new QualityGateRunner();
        const report = await runner.run(validationContext);

        // McpResponseBuilder로 결과 포맷팅
        const res = new McpResponseBuilder();
        res.header('TRUST 5 품질 게이트 결과');
        res.blank();

        const actionLabel = report.gateAction === 'pass' ? 'PASS'
          : report.gateAction === 'warn' ? 'WARN'
          : 'BLOCK';
        res.line(`  전체 점수: ${report.overallScore}/100 (${actionLabel})`);
        res.blank();

        // 스코어보드
        const criterionLabels: Record<TrustCriterion, string> = {
          tested: 'T Tested    ',
          readable: 'R Readable  ',
          unified: 'U Unified   ',
          secured: 'S Secured   ',
          trackable: 'T Trackable ',
        };

        for (const criterion of TRUST_CRITERIA_ORDER) {
          const result = report.results[criterion];
          const bar = buildBar(result.score);
          const passInfo = `${result.checks.filter(c => c.passed).length}/${result.checks.length} 항목 통과`;
          res.line(`  ${criterionLabels[criterion]} ${bar}  ${String(result.score).padStart(3)}  ${passInfo}`);
        }

        // 상세 결과
        if (verbose || !report.overallPassed) {
          res.blank();
          res.header('상세 결과');

          for (const criterion of TRUST_CRITERIA_ORDER) {
            const result = report.results[criterion];
            if (result.checks.length === 0) continue;

            res.blank();
            res.line(`### ${criterion.charAt(0).toUpperCase()} - ${criterion.charAt(0).toUpperCase()}${criterion.slice(1)} (${result.score}점)`);

            for (const check of result.checks) {
              if (check.passed) {
                res.ok(`${check.name}: ${check.message}`);
              } else if (check.severity === 'error') {
                res.error(`${check.name}: ${check.message}`);
              } else if (check.severity === 'warning') {
                res.warn(`${check.name}: ${check.message}`);
              } else {
                res.info(`${check.name}: ${check.message}`);
              }
            }
          }
        }

        // 검증 대상 파일 표시
        res.blank();
        res.info(`검증 대상: ${targetFiles.length}개 파일`);
        if (targetFiles.length > 0 && targetFiles.length <= 10) {
          for (const f of targetFiles) {
            res.line(`  - ${f}`);
          }
        } else if (targetFiles.length > 10) {
          for (const f of targetFiles.slice(0, 5)) {
            res.line(`  - ${f}`);
          }
          res.line(`  ... 외 ${targetFiles.length - 5}개`);
        }

        return res.toResult(report.gateAction === 'block');
      } catch (err) {
        return errorResult(`품질 검증 실패: ${String(err)}`);
      }
    },
  );
}

/** 점수 바 생성 (10칸) */
function buildBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}
