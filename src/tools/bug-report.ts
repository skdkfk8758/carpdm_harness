import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execFileSync } from 'node:child_process';
import { addEntry } from '../core/team-memory.js';
import type { BugSeverity, BugSubcategory } from '../core/team-memory.js';
import { syncHarnessToOmc } from '../core/state-sync.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerBugReportTool(server: McpServer): void {
  server.tool(
    'harness_bug_report',
    '버그를 팀 메모리에 기록하고 선택적으로 GitHub Issue를 생성합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      title: z.string().describe('버그 제목'),
      description: z.string().describe('버그 설명 (재현 방법 포함)'),
      severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium')
        .describe('심각도'),
      subcategory: z.enum(['ui', 'data', 'api', 'perf', 'crash', 'logic', 'other'])
        .optional()
        .describe('버그 분류'),
      rootCause: z.string().optional().describe('근본 원인 (알려진 경우)'),
      resolution: z.string().optional().describe('해결 방법 (이미 수정한 경우)'),
      affectedFiles: z.array(z.string()).optional().describe('영향받는 파일 경로'),
      createGithubIssue: z.boolean().optional().default(false)
        .describe('GitHub Issue도 생성할지 여부 (gh CLI 필요)'),
    },
    async ({ projectRoot, title, description, severity, subcategory, rootCause, resolution, affectedFiles, createGithubIssue }) => {
      try {
        const status = resolution ? 'resolved' as const : 'open' as const;

        // 1. 팀 메모리에 버그 추가
        const entry = addEntry(projectRoot as string, {
          category: 'bugs',
          subcategory: subcategory as BugSubcategory | undefined,
          title: title as string,
          content: description as string,
          status,
          severity: severity as BugSeverity,
          rootCause: rootCause as string | undefined,
          resolution: resolution as string | undefined,
          affectedFiles: affectedFiles as string[] | undefined,
        });

        const res = new McpResponseBuilder();
        res.header('버그 리포트 등록');
        res.table([
          ['ID',     entry.id],
          ['제목',   entry.title],
          ['심각도', entry.severity ?? 'medium'],
          ['상태',   status],
          ['분류',   (subcategory as string) ?? '-'],
          ['추가일', entry.addedAt.slice(0, 10)],
        ]);

        // 2. 선택적 GitHub Issue 생성
        let issueNumber: string | undefined;
        if (createGithubIssue) {
          try {
            const labels = `bug,${severity as string}`;
            const bodyParts = [
              description as string,
              '',
              rootCause ? `## 근본 원인\n${rootCause as string}` : '',
              (affectedFiles as string[] | undefined)?.length
                ? `## 영향 파일\n${(affectedFiles as string[]).map(f => `- ${f}`).join('\n')}`
                : '',
              '',
              `_harness bug-report ID: ${entry.id}_`,
            ].filter(Boolean);
            const body = bodyParts.join('\n');

            const result = execFileSync('gh', [
              'issue', 'create',
              '--title', title as string,
              '--body', body,
              '--label', labels,
            ], { cwd: projectRoot as string, stdio: 'pipe', timeout: 15000 }).toString().trim();

            const issueMatch = result.match(/#(\d+)|\/issues\/(\d+)/);
            issueNumber = issueMatch?.[1] || issueMatch?.[2];

            if (issueNumber) {
              res.ok(`GitHub Issue 생성: #${issueNumber}`);
              res.info(`커밋 시 fix(scope): description (#${issueNumber}) 형태로 참조하세요`);
            } else {
              res.ok(`GitHub Issue 생성: ${result}`);
            }
          } catch (err) {
            res.warn(`GitHub Issue 생성 실패 (gh CLI 확인 필요): ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // 3. OMC 동기화
        try {
          const syncResult = syncHarnessToOmc(projectRoot as string);
          if (syncResult.synced > 0) {
            res.ok(`OMC 동기화: ${syncResult.synced}개 항목`);
          }
        } catch {
          // OMC 미설치 시 무시
        }

        res.blank();
        if (issueNumber) {
          res.info(`커밋 메시지에 이슈 번호를 포함하세요: fix(scope): [${(subcategory as string) ?? 'Bug'}] description (#${issueNumber})`);
        } else {
          res.info('GitHub Issue 연동을 원하면 createGithubIssue: true로 다시 호출하세요.');
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`버그 리포트 등록 실패: ${String(err)}`);
      }
    },
  );
}
