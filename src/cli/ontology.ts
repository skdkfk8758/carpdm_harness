import { loadConfig } from '../core/config.js';
import {
  buildOntology,
  refreshOntology,
  getOntologyStatus,
} from '../core/ontology/index.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';
import type { OntologyConfig } from '../types/ontology.js';
import { logger } from '../utils/logger.js';

interface OntologyOptions {
  generate?: boolean;
  refresh?: boolean;
  status?: boolean;
  layer?: string;
  dryRun?: boolean;
}

export async function ontologyCommand(options: OntologyOptions): Promise<void> {
  const projectRoot = process.cwd();

  // 설정 로드 — 온톨로지 설정이 없으면 기본값 사용
  const config = loadConfig(projectRoot);
  const ontologyConfig: OntologyConfig = config?.ontology ?? DEFAULT_ONTOLOGY_CONFIG;

  // --layer 옵션으로 특정 계층만 활성화
  const layerConfig = applyLayerFilter(ontologyConfig, options.layer);

  // --status (기본 동작)
  if (options.status || (!options.generate && !options.refresh)) {
    await runStatus(projectRoot, layerConfig);
    return;
  }

  // --generate
  if (options.generate) {
    logger.header('온톨로지 전체 재생성');
    logger.info(`출력 디렉토리: ${layerConfig.outputDir}`);

    const report = await buildOntology(projectRoot, layerConfig);

    if (!options.dryRun) {
      logger.info('파일 작성 중...');
    } else {
      logger.info('[dry-run] 파일 작성 건너뜀');
    }

    console.log('');
    logger.table([
      ['총 소요시간', `${report.totalDuration}ms`],
      ['출력 파일 수', `${report.outputFiles.length}개`],
    ]);

    for (const result of report.results) {
      const status = result.success ? '성공' : '실패';
      logger.table([
        [`${result.layer} 레이어`, status],
        ['처리 파일', `${result.fileCount}개`],
        ['소요시간', `${result.duration}ms`],
      ]);
      if (result.error) {
        logger.error(`오류: ${result.error}`);
      }
      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          logger.warn(w);
        }
      }
    }
    return;
  }

  // --refresh
  if (options.refresh) {
    logger.header('온톨로지 점진적 갱신');
    logger.info(`출력 디렉토리: ${layerConfig.outputDir}`);

    const report = await refreshOntology(projectRoot, layerConfig);

    if (options.dryRun) {
      logger.info('[dry-run] 파일 작성 건너뜀');
    }

    console.log('');
    logger.table([
      ['총 소요시간', `${report.totalDuration}ms`],
      ['출력 파일 수', `${report.outputFiles.length}개`],
    ]);

    for (const result of report.results) {
      const status = result.success ? '성공' : '실패';
      logger.table([
        [`${result.layer} 레이어`, status],
        ['처리 파일', `${result.fileCount}개`],
      ]);
      if (result.error) {
        logger.error(`오류: ${result.error}`);
      }
    }
    return;
  }
}

/** --status 출력 */
async function runStatus(projectRoot: string, config: OntologyConfig): Promise<void> {
  logger.header('온톨로지 상태');

  const status = getOntologyStatus(projectRoot, config);
  if (!status) {
    logger.warn('온톨로지가 아직 생성되지 않았습니다.');
    logger.info('생성하려면: carpdm-harness ontology --generate');
    return;
  }

  logger.table([
    ['프로젝트', status.projectName],
    ['마지막 빌드', status.generatedAt],
    ['harness 버전', status.harnessVersion],
  ]);

  console.log('');
  logger.info('계층별 상태:');

  const layers = ['structure', 'semantics', 'domain'] as const;
  for (const layer of layers) {
    const s = status.layerStatus[layer];
    const enabledLabel = s.enabled ? '활성' : '비활성';
    const builtLabel = s.lastBuilt ?? '미빌드';
    const errorLabel = s.lastError ? `오류: ${s.lastError}` : '정상';
    logger.table([
      [layer, enabledLabel],
      ['마지막 빌드', builtLabel],
      ['파일 수', `${s.fileCount}개`],
      ['상태', errorLabel],
    ]);
  }
}

/** --layer 옵션에 따라 특정 계층만 활성화하도록 설정 복사 */
function applyLayerFilter(config: OntologyConfig, layer?: string): OntologyConfig {
  if (!layer) return config;

  const validLayers = ['structure', 'semantics', 'domain'];
  if (!validLayers.includes(layer)) {
    logger.warn(`알 수 없는 계층: ${layer}. 유효값: structure|semantics|domain`);
    return config;
  }

  return {
    ...config,
    layers: {
      structure: {
        ...config.layers.structure,
        enabled: layer === 'structure',
      },
      semantics: {
        ...config.layers.semantics,
        enabled: layer === 'semantics',
      },
      domain: {
        ...config.layers.domain,
        enabled: layer === 'domain',
      },
    },
  };
}
