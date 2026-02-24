import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../core/config.js';
import { buildOntology } from '../core/ontology/index.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';
import type { OntologyConfig } from '../types/ontology.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerOntologyGenerateTool(server: McpServer): void {
  server.tool(
    'harness_ontology_generate',
    '온톨로지를 전체 재생성합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      layer: z.string().optional().describe('특정 계층만 (structure|semantics|domain)'),
      dryRun: z.boolean().optional().describe('미리보기만'),
    },
    async ({ projectRoot, layer, dryRun }) => {
      try {
        const res = new McpResponseBuilder();
        const config = loadConfig(projectRoot as string);
        let ontologyConfig: OntologyConfig = config?.ontology ?? DEFAULT_ONTOLOGY_CONFIG;

        if (layer) {
          const validLayers = ['structure', 'semantics', 'domain'];
          if (!validLayers.includes(layer as string)) {
            return errorResult(`알 수 없는 계층: ${layer}. 유효값: structure|semantics|domain`);
          }
          ontologyConfig = {
            ...ontologyConfig,
            layers: {
              structure: { ...ontologyConfig.layers.structure, enabled: layer === 'structure' },
              semantics: { ...ontologyConfig.layers.semantics, enabled: layer === 'semantics' },
              domain: { ...ontologyConfig.layers.domain, enabled: layer === 'domain' },
            },
          };
        }

        res.header('온톨로지 전체 재생성');
        res.info(`출력 디렉토리: ${ontologyConfig.outputDir}`);

        const report = await buildOntology(projectRoot as string, ontologyConfig);

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
            ['소요시간', `${result.duration}ms`],
          ]);
          if (result.error) {
            res.error(`오류: ${result.error}`);
          }
          if (result.warnings.length > 0) {
            for (const w of result.warnings) {
              res.warn(w);
            }
          }
        }

        if (report.domainContext) {
          res.blank();
          res.header('Domain 레이어 분석 요청');
          res.line('아래 context를 분석하여 harness_ontology_domain_write 도구로 domain 레이어를 생성하세요.');
          res.blank();
          res.info('디렉토리 구조:');
          res.line(report.domainContext.directoryTree);
          res.blank();
          res.info('package.json:');
          res.line(report.domainContext.packageJson);
          if (report.domainContext.symbolSamples) {
            res.blank();
            res.info('심볼 샘플:');
            res.line(report.domainContext.symbolSamples);
          }
          if (report.domainContext.entryPoints.length > 0) {
            res.blank();
            res.info(`진입점: ${report.domainContext.entryPoints.join(', ')}`);
          }
          if (report.domainContext.externalDeps.length > 0) {
            res.blank();
            res.info(`외부 의존성: ${report.domainContext.externalDeps.join(', ')}`);
          }
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`온톨로지 생성 실패: ${String(err)}`);
      }
    },
  );
}
