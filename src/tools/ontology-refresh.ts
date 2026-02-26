import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../core/config.js';
import { refreshOntology } from '../core/ontology/index.js';
import { mergeExcludePatterns } from '../core/ontology/structure-builder.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';
import type { OntologyConfig } from '../types/ontology.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';
import { syncOntologyToOmc } from '../core/state-sync.js';

export function registerOntologyRefreshTool(server: McpServer): void {
  server.tool(
    'harness_ontology_refresh',
    '변경된 파일만 점진적으로 온톨로지를 갱신합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      dryRun: z.boolean().optional().describe('미리보기만'),
    },
    async ({ projectRoot, dryRun }) => {
      try {
        const res = new McpResponseBuilder();
        const config = loadConfig(projectRoot as string);
        const userOntology = config?.ontology;
        const ontologyConfig: OntologyConfig = userOntology
          ? {
              ...DEFAULT_ONTOLOGY_CONFIG,
              ...userOntology,
              layers: {
                ...DEFAULT_ONTOLOGY_CONFIG.layers,
                ...userOntology.layers,
                structure: {
                  ...DEFAULT_ONTOLOGY_CONFIG.layers.structure,
                  ...userOntology.layers?.structure,
                  excludePatterns: mergeExcludePatterns(
                    DEFAULT_ONTOLOGY_CONFIG.layers.structure.excludePatterns,
                    userOntology.layers?.structure?.excludePatterns ?? [],
                  ),
                },
              },
            }
          : DEFAULT_ONTOLOGY_CONFIG;

        if (!ontologyConfig.enabled) {
          return errorResult('온톨로지가 비활성화 상태입니다. 먼저 harness_ontology_generate로 활성화하세요.');
        }

        res.header('온톨로지 점진적 갱신');
        res.info(`출력 디렉토리: ${ontologyConfig.outputDir}`);

        const report = await refreshOntology(projectRoot as string, ontologyConfig);

        if (dryRun) {
          res.info('[dry-run] 파일 작성 건너뜀');
        }

        res.blank();
        res.table([
          ['총 소요시간', `${report.totalDuration}ms`],
          ['출력 파일 수', `${report.outputFiles.length}개`],
        ]);

        for (const result of report.results) {
          const status = result.success ? '성공' : '실패';
          res.table([
            [`${result.layer} 레이어`, status],
            ['처리 파일', `${result.fileCount}개`],
          ]);
          if (result.error) {
            res.error(`오류: ${result.error}`);
          }
        }

        // @MX 어노테이션 요약
        if (report.annotationSummary) {
          const s = report.annotationSummary;
          res.blank();
          res.header('@MX 어노테이션');
          res.table([
            ['ANCHOR', `${s.byTag['ANCHOR'] ?? 0}개`],
            ['WARN', `${s.byTag['WARN'] ?? 0}개`],
            ['NOTE', `${s.byTag['NOTE'] ?? 0}개`],
            ['TODO', `${s.byTag['TODO'] ?? 0}개`],
            ['합계', `${s.total}개`],
          ]);
        }

        // OMC project-memory 동기화
        if (!dryRun) {
          try {
            const syncResult = syncOntologyToOmc(projectRoot as string);
            if (syncResult.synced > 0) {
              res.blank();
              res.ok(`OMC project-memory 동기화: ${syncResult.synced}개 항목`);
            }
          } catch {
            // OMC 동기화 실패는 무시
          }
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`온톨로지 갱신 실패: ${String(err)}`);
      }
    },
  );
}
