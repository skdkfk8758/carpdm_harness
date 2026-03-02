import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { analyzeRepo } from '../core/repo-analyzer.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerRepoAnalyzeTool(server: McpServer): void {
  server.tool(
    'harness_repo_analyze',
    '외부 GitHub 레포지토리를 분석하고 현재 프로젝트와의 통합 가능성을 평가합니다 (gh CLI 필요)',
    {
      projectRoot: z.string().describe('현재 프로젝트 루트 경로'),
      repoUrl: z.string().describe('분석할 레포지토리 (owner/repo 또는 GitHub URL)'),
      depth: z
        .enum(['quick', 'standard', 'deep'])
        .optional()
        .default('standard')
        .describe('분석 깊이: quick(기본정보), standard(구조+의존성), deep(패턴 분석 포함)'),
    },
    async ({ projectRoot, repoUrl, depth }) => {
      try {
        const result = analyzeRepo({
          projectRoot: projectRoot as string,
          repoUrl: repoUrl as string,
          depth: depth as 'quick' | 'standard' | 'deep',
        });

        const res = new McpResponseBuilder();

        // gh 사용 불가 시 에러 리포트
        if (!result.ghStatus.canAccessRepo) {
          res.error(result.report);
          if (!result.ghStatus.installed) {
            res.blank();
            res.info('1. gh CLI 설치: brew install gh');
            res.info('2. 인증: gh auth login');
            res.info('3. 다시 실행: harness_repo_analyze');
          } else if (!result.ghStatus.authenticated) {
            res.blank();
            res.info('gh auth login을 실행하세요.');
          }
          return res.toResult(true);
        }

        // 성공 리포트
        res.header(`레포 분석: ${result.parsedUrl.fullName}`);

        if (result.repoInfo) {
          res.subheader('기본 정보');
          res.table([
            ['이름', result.repoInfo.fullName],
            ['언어', result.repoInfo.language ?? '(없음)'],
            ['Stars', result.repoInfo.stars.toLocaleString()],
            ['라이선스', result.repoInfo.license ?? '(없음)'],
            ['아카이브', result.repoInfo.isArchived ? 'Yes' : 'No'],
          ]);
        }

        if (result.structure) {
          res.subheader('구조');
          res.check(result.structure.hasPackageJson, 'package.json');
          res.check(result.structure.hasTsConfig, 'TypeScript');
          res.check(result.structure.hasTests, '테스트');
          res.check(result.structure.hasCi, 'CI/CD');
          res.info(`모듈: ${result.structure.moduleSystem.toUpperCase()}`);
        }

        if (result.depComparison) {
          res.subheader('의존성');
          res.table([
            ['공유', `${result.depComparison.shared.length}개`],
            ['대상만', `${result.depComparison.onlyInTarget.length}개`],
            ['로컬만', `${result.depComparison.onlyInLocal.length}개`],
            ['비호환', `${result.depComparison.incompatibleCount}건`],
          ]);
        }

        if (result.feasibility) {
          res.subheader('통합 평가');
          res.info(result.feasibility.summary);
          for (const f of result.feasibility.factors) {
            const sign = f.impact > 0 ? '+' : '';
            res.line(`  ${sign}${f.impact}  ${f.reason}`);
          }
        }

        res.divider();
        res.info(`상세 리포트는 아래를 참조하세요.`);
        res.blank();
        res.line(result.report);

        return res.toResult();
      } catch (err) {
        return errorResult(`레포 분석 실패: ${String(err)}`);
      }
    },
  );
}
