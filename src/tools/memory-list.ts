import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listEntries } from '../core/team-memory.js';
import type { MemoryCategory, BugStatus, BugSeverity } from '../core/team-memory.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerMemoryListTool(server: McpServer): void {
  server.tool(
    'harness_memory_list',
    '팀 메모리 항목을 조회합니다 (버그 필터링 지원)',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      category: z.enum(['all', 'conventions', 'patterns', 'decisions', 'mistakes', 'bugs'])
        .optional()
        .describe('조회할 카테고리 (기본값: all)'),
      status: z.enum(['open', 'resolved', 'wontfix']).optional()
        .describe('버그 상태 필터 (bugs 카테고리에서 유용)'),
      severity: z.enum(['critical', 'high', 'medium', 'low']).optional()
        .describe('버그 심각도 필터 (bugs 카테고리에서 유용)'),
    },
    async ({ projectRoot, category, status, severity }) => {
      try {
        const cat = (category ?? 'all') as MemoryCategory | 'all';
        const filters = (status || severity)
          ? { status: status as BugStatus | undefined, severity: severity as BugSeverity | undefined }
          : undefined;
        const entries = listEntries(projectRoot as string, cat, filters);

        const res = new McpResponseBuilder();
        res.header(`팀 메모리 (${cat})`);

        if (entries.length === 0) {
          res.info('항목이 없습니다.');
          return res.toResult();
        }

        // 카테고리별 그룹화
        const groups: Record<string, typeof entries> = {};
        for (const entry of entries) {
          const key = entry.category;
          if (!groups[key]) groups[key] = [];
          groups[key].push(entry);
        }

        for (const [groupName, groupEntries] of Object.entries(groups)) {
          res.line(`\n### ${groupName} (${groupEntries.length}개)\n`);
          for (const entry of groupEntries) {
            const sub = entry.subcategory ? ` [${entry.subcategory}]` : '';
            const bugMeta = entry.category === 'bugs'
              ? ` ${entry.severity ?? ''} ${entry.status ?? ''}`.trimEnd()
              : '';
            res.line(`  - **${entry.title}**${sub}${bugMeta}  _(${entry.addedAt.slice(0, 10)})_`);
            const preview = entry.content.split('\n')[0];
            if (preview) {
              res.line(`    ${preview.length > 80 ? preview.slice(0, 80) + '…' : preview}`);
            }
            if (entry.linkedIssue) {
              res.line(`    이슈: ${entry.linkedIssue}`);
            }
          }
        }

        res.blank();
        res.info(`총 ${entries.length}개 항목`);
        return res.toResult();
      } catch (err) {
        return errorResult(`팀 메모리 조회 실패: ${String(err)}`);
      }
    },
  );
}
