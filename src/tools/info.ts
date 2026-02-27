import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../core/config.js';
import { getOntologyStatus } from '../core/ontology/index.js';
import { getPackageVersion } from '../utils/version.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerInfoTool(server: McpServer): void {
  server.tool(
    'harness_info',
    '현재 설치 상태를 표시합니다',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
    },
    async ({ projectRoot }) => {
      try {
        const config = loadConfig(projectRoot as string);
        if (!config) {
          return errorResult('carpdm-harness가 설치되어 있지 않습니다.');
        }

        const pkgVersion = getPackageVersion();
        const res = new McpResponseBuilder();

        res.header('carpdm-harness 설치 정보');
        res.table([
          ['패키지 버전', pkgVersion],
          ['설치 버전', config.version],
          ['프리셋', config.preset],
          ['모듈', config.modules.join(', ')],
          ['설치일', config.installedAt],
          ['마지막 업데이트', config.updatedAt],
          ['글로벌 커맨드', config.globalCommandsInstalled ? '설치됨' : '미설치'],
          ['훅 등록', config.options.hooksRegistered ? '등록됨' : '미등록'],
          ['문서 디렉토리', config.options.docsTemplatesDir],
          ['에이전트 디렉토리', config.options.agentDir],
        ]);

        res.blank();
        res.info(`추적 중인 파일: ${Object.keys(config.files).length}개`);

        if (Object.keys(config.files).length > 0) {
          res.blank();
          const byModule: Record<string, string[]> = {};
          for (const [path, record] of Object.entries(config.files)) {
            if (!byModule[record.module]) byModule[record.module] = [];
            byModule[record.module].push(path);
          }
          for (const [mod, files] of Object.entries(byModule)) {
            res.line(`  ${mod} (${files.length}개):`);
            for (const f of files) {
              res.line(`    ${f}`);
            }
          }
        }

        res.blank();
        res.header('온톨로지');

        const ontologyConfig = config.ontology;
        if (!ontologyConfig || !ontologyConfig.enabled) {
          res.info('온톨로지: 비활성화 (harness_ontology_generate로 활성화)');
          return res.toResult();
        }

        res.table([
          ['활성화', '예'],
          ['출력 디렉토리', ontologyConfig.outputDir],
          ['자동 갱신', ontologyConfig.autoUpdate.enabled ? `예 (${ontologyConfig.autoUpdate.gitHook})` : '아니오'],
          ['AI 제공자', ontologyConfig.ai ? ontologyConfig.ai.provider : '없음'],
        ]);

        const layers: Array<'structure' | 'semantics' | 'domain'> = ['structure', 'semantics', 'domain'];
        res.blank();
        res.subheader('계층별 상태');

        for (const layer of layers) {
          const enabled = ontologyConfig.layers[layer].enabled;
          const status = getOntologyStatus(projectRoot as string, ontologyConfig);
          const layerStatus = status?.layerStatus[layer];
          const lastBuilt = layerStatus?.lastBuilt ?? '미빌드';
          const fileCount = layerStatus?.fileCount ?? 0;

          res.table([
            [layer, enabled ? '활성' : '비활성'],
            ['마지막 빌드', lastBuilt],
            ['파일 수', `${fileCount}개`],
          ]);
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`정보 조회 실패: ${String(err)}`);
      }
    },
  );
}
