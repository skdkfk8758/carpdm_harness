import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { join } from 'node:path';
import { loadConfig } from '../core/config.js';
import { safeWriteFile } from '../core/file-ops.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';
import type { DomainLayer } from '../types/ontology.js';
import { renderOntologyMarkdown } from '../core/ontology/markdown-renderer.js';
import { loadOntologyCache, saveOntologyCache } from '../core/ontology/incremental-updater.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerOntologyDomainWriteTool(server: McpServer): void {
  server.tool(
    'harness_ontology_domain_write',
    'Domain 레이어 데이터를 저장합니다 (Claude Code가 분석한 결과를 기록)',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      projectSummary: z.string().describe('프로젝트 요약 (1-3문장)'),
      architectureStyle: z.string().describe('아키텍처 스타일 (예: layered, modular)'),
      architectureLayers: z.array(z.string()).describe('아키텍처 계층 목록'),
      architectureKeyDecisions: z.array(z.string()).describe('핵심 설계 결정 사항'),
      architectureEntryPoints: z.array(z.string()).describe('진입점 파일 목록'),
      patterns: z.array(z.object({
        name: z.string(),
        description: z.string(),
        files: z.array(z.string()),
        example: z.string().optional(),
      })).describe('발견된 코드 패턴'),
      conventions: z.array(z.object({
        category: z.enum(['naming', 'structure', 'error-handling', 'testing', 'other']),
        rule: z.string(),
        evidence: z.array(z.string()),
      })).describe('코딩 컨벤션'),
      glossary: z.array(z.object({
        term: z.string(),
        definition: z.string(),
        context: z.string(),
      })).describe('도메인 용어집'),
    },
    async ({
      projectRoot,
      projectSummary,
      architectureStyle,
      architectureLayers,
      architectureKeyDecisions,
      architectureEntryPoints,
      patterns,
      conventions,
      glossary,
    }) => {
      try {
        const res = new McpResponseBuilder();
        const config = loadConfig(projectRoot as string);
        const ontologyConfig = config?.ontology ?? DEFAULT_ONTOLOGY_CONFIG;

        if (!ontologyConfig.enabled) {
          return errorResult('온톨로지가 비활성화 상태입니다. 먼저 harness_init으로 활성화하세요.');
        }

        const domainData: DomainLayer = {
          projectSummary: projectSummary as string,
          architecture: {
            style: architectureStyle as string,
            layers: architectureLayers as string[],
            keyDecisions: architectureKeyDecisions as string[],
            entryPoints: architectureEntryPoints as string[],
          },
          patterns: patterns as DomainLayer['patterns'],
          conventions: conventions as DomainLayer['conventions'],
          glossary: glossary as DomainLayer['glossary'],
        };

        // 기존 캐시에서 structure/semantics 데이터 로드
        const cache = loadOntologyCache(projectRoot as string, ontologyConfig.outputDir);

        // OntologyData 구성 (domain만 새로 작성)
        const ontologyData = {
          metadata: {
            projectName: (projectRoot as string).split('/').pop() ?? 'project',
            generatedAt: new Date().toISOString(),
            harnessVersion: cache?.version ?? '0.0.0',
            layerStatus: {
              structure: { enabled: true, lastBuilt: cache?.builtAt ?? null, lastError: null, fileCount: 0 },
              semantics: { enabled: true, lastBuilt: cache?.builtAt ?? null, lastError: null, fileCount: 0 },
              domain: { enabled: true, lastBuilt: new Date().toISOString(), lastError: null, fileCount: 0 },
            },
          },
          structure: cache?.layerData.structure ?? null,
          semantics: cache?.layerData.semantics ?? null,
          domain: domainData,
        };

        // ONTOLOGY-DOMAIN.md 렌더링 및 저장
        const { domain: domainMd } = renderOntologyMarkdown(ontologyData);
        const outputPath = join(projectRoot as string, ontologyConfig.outputDir, 'ONTOLOGY-DOMAIN.md');
        safeWriteFile(outputPath, domainMd);

        // 캐시 업데이트
        if (cache) {
          saveOntologyCache(projectRoot as string, ontologyConfig.outputDir, {
            ...cache,
            builtAt: new Date().toISOString(),
            layerData: {
              ...cache.layerData,
              domain: domainData,
            },
          });
        }

        res.header('Domain 레이어 저장 완료');
        res.table([
          ['패턴', `${(patterns as unknown[]).length}개`],
          ['컨벤션', `${(conventions as unknown[]).length}개`],
          ['용어', `${(glossary as unknown[]).length}개`],
          ['출력 파일', 'ONTOLOGY-DOMAIN.md'],
        ]);

        return res.toResult();
      } catch (err) {
        return errorResult(`Domain 레이어 저장 실패: ${String(err)}`);
      }
    },
  );
}
