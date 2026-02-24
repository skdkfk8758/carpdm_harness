import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../core/config.js';
import { getOntologyStatus } from '../core/ontology/index.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';
import type { OntologyConfig } from '../types/ontology.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerOntologyStatusTool(server: McpServer): void {
  server.tool(
    'harness_ontology_status',
    '온톨로지 상태를 표시합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
    },
    async ({ projectRoot }) => {
      try {
        const res = new McpResponseBuilder();
        const config = loadConfig(projectRoot as string);
        const ontologyConfig: OntologyConfig = config?.ontology ?? DEFAULT_ONTOLOGY_CONFIG;

        res.header('온톨로지 상태');

        const status = getOntologyStatus(projectRoot as string, ontologyConfig);
        if (!status) {
          res.warn('온톨로지가 아직 생성되지 않았습니다.');
          res.info('생성하려면: harness_ontology_generate 도구를 사용하세요');
          return res.toResult();
        }

        res.table([
          ['프로젝트', status.projectName],
          ['마지막 빌드', status.generatedAt],
          ['harness 버전', status.harnessVersion],
        ]);

        res.blank();
        res.info('계층별 상태:');

        const layers = ['structure', 'semantics', 'domain'] as const;
        for (const layer of layers) {
          const s = status.layerStatus[layer];
          const enabledLabel = s.enabled ? '활성' : '비활성';
          const builtLabel = s.lastBuilt ?? '미빌드';
          const errorLabel = s.lastError ? `오류: ${s.lastError}` : '정상';
          res.table([
            [layer, enabledLabel],
            ['마지막 빌드', builtLabel],
            ['파일 수', `${s.fileCount}개`],
            ['상태', errorLabel],
          ]);
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`온톨로지 상태 조회 실패: ${String(err)}`);
      }
    },
  );
}
