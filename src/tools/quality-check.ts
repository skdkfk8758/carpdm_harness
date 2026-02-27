import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import { loadConfig } from '../core/config.js';
import { QualityGateRunner } from '../core/quality-gate/index.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';
import type { TrustCriterion, ValidationContext, ValidatorResult } from '../types/quality-gate.js';
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
            res.subheader(`${criterion.charAt(0).toUpperCase()} - ${criterion.charAt(0).toUpperCase()}${criterion.slice(1)} (${result.score}점)`);

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

        // 개선 가이드 (통과하지 못한 기준)
        const hints = buildImprovementHints(report.results);
        if (hints.length > 0) {
          res.blank();
          res.header('개선 가이드');
          for (const hint of hints) {
            res.warn(hint);
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

/** 기준별 실패 항목 기반 개선 힌트 생성 */
const IMPROVEMENT_HINTS: Record<TrustCriterion, Record<string, string>> = {
  tested: {
    '테스트 파일 존재': '변경된 소스 파일에 대응하는 .test.ts/.spec.ts 파일을 추가하세요',
    '테스트 명령어': 'package.json에 test 스크립트를 설정하세요 (예: "test": "vitest run")',
    '커버리지 힌트': '테스트 커버리지 설정을 추가하세요 (vitest.config.ts → coverage 옵션)',
    'TDD 순서': '구현 전에 테스트를 먼저 커밋하세요 (Red → Green → Refactor)',
  },
  readable: {
    '린트 검사': 'ESLint/Biome 등 린터를 설정하고 `npm run lint`로 확인하세요',
    '파일 길이': '300줄 이상 파일을 분리하세요 — 단일 책임 원칙에 따라 모듈 추출',
    '함수 길이': '50줄 이상 함수를 작은 함수로 분리하세요',
    'TODO/FIXME/HACK': '임시 마커를 해결하거나 이슈로 등록하세요',
    '네이밍 규칙': '함수/변수 네이밍 컨벤션을 통일하세요 (camelCase/PascalCase)',
  },
  unified: {
    '포맷팅 일관성': 'Prettier/Biome 포맷터를 설정하고 전체 포맷팅을 적용하세요',
    '임포트 순서': 'import 정렬 규칙을 설정하세요 (eslint-plugin-import 등)',
    '프로젝트 구조': '프로젝트 구조 컨벤션을 docs/conventions.md에 문서화하세요',
    'EditorConfig': '.editorconfig 파일을 추가하여 들여쓰기/인코딩을 통일하세요',
  },
  secured: {
    '시크릿 스캔': '하드코딩된 시크릿을 환경변수로 이동하세요 (.env + .gitignore)',
    'eval/exec 사용': 'eval/exec 호출을 안전한 대안으로 교체하세요',
    'SQL 인젝션': '파라미터 바인딩 또는 ORM을 사용하세요',
    '입력 검증': '사용자 입력에 Zod/joi 등 검증 라이브러리를 적용하세요',
    '의존성 보안': '`npm audit`로 취약 의존성을 확인하고 업데이트하세요',
  },
  trackable: {
    '커밋 메시지 컨벤션': 'Conventional Commits 형식을 사용하세요: feat(scope): description',
    '이슈 참조': '커밋 메시지 또는 브랜치에 이슈 번호를 포함하세요 (#123)',
    'fix 원인 태그': 'fix 커밋에 원인 설명을 추가하세요 (root-cause: ...)',
    '변경 로그': 'CHANGELOG.md를 유지하거나 자동 생성 도구를 설정하세요',
    '브랜치 네이밍': 'feat/fix/chore 등 접두사 + 이슈번호 형식을 사용하세요',
  },
};

function buildImprovementHints(
  results: Record<TrustCriterion, ValidatorResult>,
): string[] {
  const hints: string[] = [];
  for (const criterion of TRUST_CRITERIA_ORDER) {
    const result = results[criterion];
    if (result.score >= 60) continue;

    const failedNames = result.checks
      .filter(c => !c.passed)
      .map(c => c.name);

    const criterionHints = IMPROVEMENT_HINTS[criterion];
    const matched: string[] = [];
    for (const name of failedNames) {
      if (criterionHints[name] && !matched.includes(criterionHints[name])) {
        matched.push(criterionHints[name]);
      }
    }

    if (matched.length > 0) {
      hints.push(`${criterion} (${result.score}점) → ${matched.join('; ')}`);
    }
  }
  return hints;
}
