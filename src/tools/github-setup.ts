import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { setupGithubLabels, STANDARD_LABELS } from '../core/github-labels.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerGithubSetupTool(server: McpServer): void {
  server.tool(
    'harness_github_setup',
    'GitHub 라벨을 프로젝트 리포지토리에 자동 생성합니다 (gh CLI 필요)',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
    },
    async ({ projectRoot }) => {
      try {
        const res = new McpResponseBuilder();
        const result = setupGithubLabels(projectRoot as string);

        if (!result.ghAvailable) {
          res.error('gh CLI가 인증되지 않았습니다.');
          res.blank();
          res.info('1. gh CLI 설치: brew install gh');
          res.info('2. 인증: gh auth login');
          res.info('3. 다시 실행: harness_github_setup');
          return res.toResult(true);
        }

        res.header('GitHub 라벨 설정');

        if (result.created.length > 0) {
          res.ok(`${result.created.length}개 라벨 생성:`);
          for (const name of result.created) {
            res.line(`  + ${name}`);
          }
        }

        if (result.skipped.length > 0) {
          res.info(`${result.skipped.length}개 기존 라벨 유지:`);
          for (const name of result.skipped) {
            res.line(`  = ${name}`);
          }
        }

        for (const e of result.errors) {
          res.warn(`실패: ${e}`);
        }

        res.blank();
        res.table([
          ['생성', `${result.created.length}개`],
          ['유지', `${result.skipped.length}개`],
          ['실패', `${result.errors.length}개`],
          ['전체', `${STANDARD_LABELS.length}개`],
        ]);

        return res.toResult();
      } catch (err) {
        return errorResult(`GitHub 라벨 설정 실패: ${String(err)}`);
      }
    },
  );
}
