import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { archivePlan, listArchives, restoreArchive } from '../core/plan-archive.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerPlanArchiveTool(server: McpServer): void {
  server.tool(
    'harness_plan_archive',
    'plan.md/todo.md를 아카이브/복원합니다. plan-gate 전에 기존 계획을 보존하거나, 이전 계획을 복원할 때 사용합니다.',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      action: z.enum(['archive', 'list', 'restore'])
        .describe('archive: 현재 plan 아카이브, list: 목록 조회, restore: 복원'),
      filename: z.string().optional()
        .describe('restore 시 복원할 아카이브 파일명 (list로 조회 가능)'),
    },
    async ({ projectRoot, action, filename }) => {
      try {
        if (action === 'archive') {
          const result = archivePlan(projectRoot as string);
          const res = new McpResponseBuilder();
          res.header('Plan 아카이브');
          if (result.success) {
            res.ok(result.message);
            res.info('새 plan-gate를 시작할 수 있습니다.');
          } else {
            res.warn(result.message);
          }
          return res.toResult(!result.success);
        }

        if (action === 'list') {
          const entries = listArchives(projectRoot as string);
          const res = new McpResponseBuilder();
          res.header('아카이브 목록');
          if (entries.length === 0) {
            res.info('아카이브가 없습니다.');
          } else {
            res.info(`총 ${entries.length}개`);
            res.blank();
            for (const entry of entries) {
              res.line(`  ${entry.date}  ${entry.filename}`);
            }
            res.blank();
            res.info('복원하려면 action: "restore", filename: "<파일명>"으로 호출하세요.');
          }
          return res.toResult();
        }

        if (action === 'restore') {
          if (!filename) {
            return errorResult('restore 액션에는 filename이 필수입니다. 먼저 list로 파일명을 확인하세요.');
          }
          const result = restoreArchive(projectRoot as string, filename as string);
          const res = new McpResponseBuilder();
          res.header('Plan 복원');
          if (result.success) {
            res.ok(result.message);
            res.info('.agent/plan.md와 .agent/todo.md를 확인하세요.');
          } else {
            res.warn(result.message);
          }
          return res.toResult(!result.success);
        }

        return errorResult(`알 수 없는 action: ${action as string}`);
      } catch (err) {
        return errorResult(`plan-archive 실패: ${String(err)}`);
      }
    },
  );
}
