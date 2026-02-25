import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../core/config.js';
import { loadOntologyCache } from '../core/ontology/incremental-updater.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';
import type { OntologyConfig, MxAnnotation, MxTag } from '../types/ontology.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerOntologyAnnotationsTool(server: McpServer): void {
  server.tool(
    'harness_ontology_annotations',
    '@MX 어노테이션을 조회/필터링합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      tag: z.enum(['ANCHOR', 'WARN', 'NOTE', 'TODO']).optional().describe('특정 태그만 필터'),
      file: z.string().optional().describe('특정 파일만 필터'),
      minFanIn: z.number().optional().describe('ANCHOR 최소 fan_in 필터'),
    },
    async ({ projectRoot, tag, file, minFanIn }) => {
      try {
        const res = new McpResponseBuilder();
        const config = loadConfig(projectRoot as string);
        const ontologyConfig: OntologyConfig = config?.ontology ?? DEFAULT_ONTOLOGY_CONFIG;

        // 캐시에서 semantics 데이터 로드
        const cache = loadOntologyCache(projectRoot as string, ontologyConfig.outputDir);
        if (!cache?.layerData?.semantics) {
          return errorResult(
            '온톨로지가 생성되지 않았습니다. 먼저 harness_ontology_generate를 실행하세요.',
          );
        }

        const semantics = cache.layerData.semantics;

        // 모든 파일에서 어노테이션 수집
        let annotations: Array<MxAnnotation & { filePath: string }> = [];
        for (const sf of semantics.files) {
          if (sf.annotations) {
            for (const ann of sf.annotations) {
              annotations.push({
                ...ann,
                filePath: sf.path,
              });
            }
          }
        }

        // 태그 필터
        if (tag) {
          annotations = annotations.filter((a) => a.tag === (tag as MxTag));
        }

        // 파일 필터
        if (file) {
          const fileStr = file as string;
          annotations = annotations.filter(
            (a) => a.filePath.includes(fileStr) || (a.metadata?.file as string)?.includes(fileStr),
          );
        }

        // minFanIn 필터 (ANCHOR 전용)
        if (minFanIn !== undefined) {
          annotations = annotations.filter(
            (a) => a.tag === 'ANCHOR' && (a.metadata?.fanIn as number) >= (minFanIn as number),
          );
        }

        res.header('@MX 어노테이션 조회');

        if (annotations.length === 0) {
          res.info('조건에 맞는 어노테이션이 없습니다.');
          return res.toResult();
        }

        // 요약
        if (semantics.annotationSummary) {
          const s = semantics.annotationSummary;
          res.table([
            ['전체 ANCHOR', `${s.byTag['ANCHOR'] ?? 0}개`],
            ['전체 WARN', `${s.byTag['WARN'] ?? 0}개`],
            ['전체 NOTE', `${s.byTag['NOTE'] ?? 0}개`],
            ['전체 TODO', `${s.byTag['TODO'] ?? 0}개`],
            ['전체 합계', `${s.total}개`],
          ]);
          res.blank();
        }

        res.info(`필터 결과: ${annotations.length}개`);
        res.blank();

        // 태그별 그룹핑
        const grouped: Record<string, typeof annotations> = {};
        for (const ann of annotations) {
          if (!grouped[ann.tag]) grouped[ann.tag] = [];
          grouped[ann.tag].push(ann);
        }

        const tagOrder: MxTag[] = ['ANCHOR', 'WARN', 'NOTE', 'TODO'];
        for (const t of tagOrder) {
          const group = grouped[t];
          if (!group || group.length === 0) continue;

          res.line(`### @MX:${t} (${group.length}개)`);
          res.blank();

          if (t === 'ANCHOR') {
            res.line('| 심볼 | 파일 | fan_in | 메시지 |');
            res.line('|------|------|--------|--------|');
            for (const ann of group.slice(0, 50)) {
              const fanIn = (ann.metadata?.fanIn as number) ?? '-';
              res.line(`| \`${ann.symbolName ?? '-'}\` | \`${ann.filePath}\` | ${fanIn} | ${ann.message} |`);
            }
          } else {
            res.line('| 심볼 | 파일 | 줄 | 메시지 |');
            res.line('|------|------|-----|--------|');
            for (const ann of group.slice(0, 50)) {
              res.line(`| \`${ann.symbolName ?? '-'}\` | \`${ann.filePath}\` | ${ann.line ?? '-'} | ${ann.message} |`);
            }
          }

          if (group.length > 50) {
            res.line(`_...총 ${group.length}개 중 50개 표시_`);
          }
          res.blank();
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`어노테이션 조회 실패: ${String(err)}`);
      }
    },
  );
}
