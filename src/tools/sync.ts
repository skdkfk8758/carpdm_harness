import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../core/config.js';
import { fullSync, syncHarnessToOmc, syncOmcToHarness, syncOntologyToOmc } from '../core/state-sync.js';
import type { SyncResult } from '../types/sync.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';
import { syncClaudeMd } from '../core/claudemd-sync.js';

function formatSyncResult(res: McpResponseBuilder, result: SyncResult, label: string): void {
  res.info(`${label}:`);
  res.line(`  동기화: ${result.synced}개 항목`);
  if (result.skipped > 0) {
    res.line(`  건너뜀: ${result.skipped}개`);
  }
  if (result.conflicts.length > 0) {
    res.line(`  충돌: ${result.conflicts.length}개`);
    for (const conflict of result.conflicts) {
      res.line(`    - ${conflict.path} (${conflict.resolvedWith} 기준으로 해결)`);
    }
  }
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      res.warn(`  ${error}`);
    }
  }
}

export function registerSyncTool(server: McpServer): void {
  server.tool(
    'harness_sync',
    'Harness와 OMC 간 상태를 동기화합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      direction: z.enum(['full', 'harness-to-omc', 'omc-to-harness', 'ontology-to-omc']).optional()
        .describe('동기화 방향 (기본값: full)'),
      dryRun: z.boolean().optional().describe('미리보기만'),
    },
    async ({ projectRoot, direction, dryRun }) => {
      try {
        const res = new McpResponseBuilder();
        const pRoot = projectRoot as string;
        const pDirection = (direction as string) || 'full';
        const pDryRun = dryRun === true;

        const config = loadConfig(pRoot);
        if (!config) {
          return errorResult('carpdm-harness가 설치되어 있지 않습니다. harness_init을 먼저 실행하세요.');
        }

        res.header('상태 동기화');
        if (pDryRun) {
          res.warn('미리보기 모드 (실제 변경 없음)');
        }
        res.blank();

        let result: SyncResult;

        switch (pDirection) {
          case 'harness-to-omc':
            result = syncHarnessToOmc(pRoot, pDryRun);
            formatSyncResult(res, result, 'Harness → OMC');
            break;

          case 'omc-to-harness':
            result = syncOmcToHarness(pRoot, pDryRun);
            formatSyncResult(res, result, 'OMC → Harness');
            break;

          case 'ontology-to-omc':
            result = syncOntologyToOmc(pRoot, pDryRun);
            formatSyncResult(res, result, 'Ontology → OMC');
            break;

          case 'full':
          default:
            result = fullSync(pRoot, pDryRun);
            formatSyncResult(res, result, '전체 동기화');
            break;
        }

        res.blank();
        res.info(`타임스탬프: ${result.timestamp}`);

        if (result.errors.length > 0) {
          res.blank();
          res.error(`${result.errors.length}개 에러 발생`);
          return res.toResult(true);
        }

        // CLAUDE.md 마커 영역 갱신
        if (!pDryRun) {
          const claudeResult = syncClaudeMd(pRoot);
          if (claudeResult.updated) {
            res.info('CLAUDE.md 자동 섹션 갱신 완료');
          }
        }

        res.blank();
        res.ok('동기화 완료');
        return res.toResult();
      } catch (err) {
        return errorResult(`동기화 실패: ${String(err)}`);
      }
    },
  );
}
