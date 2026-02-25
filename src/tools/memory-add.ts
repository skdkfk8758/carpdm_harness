import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { addEntry } from '../core/team-memory.js';
import type { MemoryCategory, ConventionSubcategory, BugSubcategory, BugStatus, BugSeverity } from '../core/team-memory.js';
import { syncHarnessToOmc } from '../core/state-sync.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerMemoryAddTool(server: McpServer): void {
  server.tool(
    'harness_memory_add',
    '팀 메모리에 패턴, 컨벤션, 결정, 실수, 버그를 추가합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      category: z.enum(['conventions', 'patterns', 'decisions', 'mistakes', 'bugs'])
        .describe('카테고리'),
      subcategory: z.enum(['naming', 'structure', 'error-handling', 'other', 'ui', 'data', 'api', 'perf', 'crash', 'logic'])
        .optional()
        .describe('서브카테고리 (conventions: naming/structure/error-handling/other, bugs: ui/data/api/perf/crash/logic)'),
      title: z.string().describe('항목 제목'),
      content: z.string().describe('마크다운 내용'),
      evidence: z.array(z.string()).optional().describe('근거 파일 경로 배열'),
      status: z.enum(['open', 'resolved', 'wontfix']).optional().describe('버그 상태 (bugs 카테고리 전용)'),
      severity: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('버그 심각도 (bugs 카테고리 전용)'),
      rootCause: z.string().optional().describe('근본 원인 (bugs 카테고리 전용)'),
      resolution: z.string().optional().describe('해결 방법 (bugs 카테고리 전용)'),
      linkedIssue: z.string().optional().describe('연결된 이슈 번호 (예: #42, PROJ-123)'),
      affectedFiles: z.array(z.string()).optional().describe('영향받는 파일 경로 (bugs 카테고리 전용)'),
    },
    async ({ projectRoot, category, subcategory, title, content, evidence, status, severity, rootCause, resolution, linkedIssue, affectedFiles }) => {
      try {
        const entry = addEntry(projectRoot as string, {
          category: category as MemoryCategory,
          subcategory: subcategory as (ConventionSubcategory | BugSubcategory) | undefined,
          title: title as string,
          content: content as string,
          evidence: evidence as string[] | undefined,
          status: status as BugStatus | undefined,
          severity: severity as BugSeverity | undefined,
          rootCause: rootCause as string | undefined,
          resolution: resolution as string | undefined,
          linkedIssue: linkedIssue as string | undefined,
          affectedFiles: affectedFiles as string[] | undefined,
        });

        const res = new McpResponseBuilder();
        res.header('팀 메모리 추가 완료');
        res.table([
          ['ID',       entry.id],
          ['카테고리', entry.category],
          ['제목',     entry.title],
          ['추가일',   entry.addedAt.slice(0, 10)],
        ]);
        if (entry.subcategory) {
          res.info(`서브카테고리: ${entry.subcategory}`);
        }
        res.blank();
        res.ok('.claude/rules/ + .agent/memory.md 동기화 완료');

        // OMC project-memory 동기화
        try {
          const syncResult = syncHarnessToOmc(projectRoot as string);
          if (syncResult.synced > 0) {
            res.ok(`OMC project-memory 동기화: ${syncResult.synced}개 항목`);
          }
        } catch {
          // OMC 동기화 실패는 무시 (OMC 미설치 가능)
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`팀 메모리 추가 실패: ${String(err)}`);
      }
    },
  );
}
