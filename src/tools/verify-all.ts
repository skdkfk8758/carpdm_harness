import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execSync } from 'node:child_process';
import { z } from 'zod';
import { loadConfig } from '../core/config.js';
import { runIntegratedVerify } from '../core/verify-runner.js';
import { scanVerifySkills } from '../core/verify-skill-manager.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';
import { DEFAULT_QUALITY_GATE_CONFIG, TRUST_CRITERIA_ORDER } from '../types/quality-gate.js';
import type { TrustCriterion } from '../types/quality-gate.js';

export function registerVerifyAllTool(server: McpServer): void {
  server.tool(
    'harness_verify_all',
    'TRUST 5 + 프로젝트 커스텀 verify 스킬 통합 검증을 실행합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      files: z.array(z.string()).optional().describe('검증 대상 파일 목록 (미지정 시 git 변경 파일)'),
      skipTrust: z.boolean().optional().describe('TRUST 5 건너뛰기'),
      skipCustom: z.boolean().optional().describe('커스텀 verify 스킬 건너뛰기'),
      verbose: z.boolean().optional().describe('상세 출력'),
    },
    async ({ projectRoot, files, skipTrust, skipCustom, verbose }) => {
      try {
        const root = projectRoot as string;

        // 대상 파일 결정
        let targetFiles: string[] = (files as string[] | undefined) ?? [];
        if (targetFiles.length === 0) {
          targetFiles = getGitChangedFiles(root);
        }

        // 설정 로드
        const config = loadConfig(root);
        const qualityGateConfig = config?.qualityGate ?? DEFAULT_QUALITY_GATE_CONFIG;

        // 통합 실행
        const report = await runIntegratedVerify(root, targetFiles, {
          skipTrust: skipTrust as boolean | undefined,
          skipCustom: skipCustom as boolean | undefined,
          trustConfig: qualityGateConfig,
        });

        // 결과 포맷팅
        const res = new McpResponseBuilder();
        res.header('통합 검증 리포트');
        res.blank();

        const statusLabel = report.overallPassed ? 'PASS' : 'FAIL';
        res.line(`  전체 점수: ${report.overallScore}/100 (${statusLabel})`);
        res.blank();

        // TRUST 5 요약
        if (!skipTrust) {
          res.line('  === TRUST 5 ===');
          const trustAction = report.trustReport.gateAction.toUpperCase();
          res.line(`  점수: ${report.trustReport.overallScore}/100 (${trustAction})`);

          const criterionLabels: Record<TrustCriterion, string> = {
            tested: 'T Tested    ',
            readable: 'R Readable  ',
            unified: 'U Unified   ',
            secured: 'S Secured   ',
            trackable: 'T Trackable ',
          };

          for (const criterion of TRUST_CRITERIA_ORDER) {
            const result = report.trustReport.results[criterion];
            if (!result) continue;
            const bar = buildBar(result.score);
            const passInfo = `${result.checks.filter(c => c.passed).length}/${result.checks.length}`;
            res.line(`  ${criterionLabels[criterion]} ${bar}  ${String(result.score).padStart(3)}  ${passInfo}`);
          }
          res.blank();
        }

        // 커스텀 verify 스킬 결과
        if (!skipCustom) {
          const skills = scanVerifySkills(root);
          res.line('  === 커스텀 Verify ===');

          if (report.verifyResults.length === 0) {
            res.info('등록된 커스텀 verify 스킬 없음');
            if (skills.length === 0) {
              res.info('harness_manage_verify(action: "apply")로 자동 생성할 수 있습니다');
            }
          } else {
            for (const vr of report.verifyResults) {
              const icon = vr.passed ? 'OK' : 'FAIL';
              res.line(`  [${icon}] ${vr.skillName}: ${vr.score}/100 (${vr.checks.length}개 검사)`);

              if (verbose || !vr.passed) {
                for (const check of vr.checks) {
                  const checkIcon = check.passed ? 'OK' : check.severity === 'error' ? 'ERROR' : 'WARN';
                  res.line(`    [${checkIcon}] ${check.name}: ${check.message}`);
                }
              }
            }
          }
          res.blank();
        }

        // 대상 파일
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

        return res.toResult(!report.overallPassed);
      } catch (err) {
        return errorResult(`통합 검증 실패: ${String(err)}`);
      }
    },
  );
}

/** git 변경 파일 추출 */
function getGitChangedFiles(projectRoot: string): string[] {
  try {
    let stdout = execSync('git diff --cached --name-only', {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 8000,
    }).toString().trim();

    if (!stdout) {
      stdout = execSync(
        'git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD',
        { cwd: projectRoot, stdio: 'pipe', timeout: 8000 },
      ).toString().trim();
    }

    return stdout ? stdout.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** 점수 바 생성 (10칸) */
function buildBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}
