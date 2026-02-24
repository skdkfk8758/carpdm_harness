import { loadConfig } from '../core/config.js';
import { getOntologyStatus } from '../core/ontology/index.js';
import { logger } from '../utils/logger.js';
import { getPackageVersion } from '../utils/version.js';
import chalk from 'chalk';

export async function infoCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);

  if (!config) {
    logger.error('carpdm-harness가 설치되어 있지 않습니다.');
    return;
  }

  const pkgVersion = getPackageVersion();

  logger.header('carpdm-harness 설치 정보');

  logger.table([
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

  console.log('');
  logger.info(`추적 중인 파일: ${Object.keys(config.files).length}개`);

  if (Object.keys(config.files).length > 0) {
    console.log('');
    const byModule: Record<string, string[]> = {};
    for (const [path, record] of Object.entries(config.files)) {
      if (!byModule[record.module]) byModule[record.module] = [];
      byModule[record.module].push(path);
    }
    for (const [mod, files] of Object.entries(byModule)) {
      console.log(`  ${chalk.bold(mod)} (${files.length}개):`);
      for (const f of files) {
        console.log(`    ${chalk.dim(f)}`);
      }
    }
  }

  // 온톨로지 섹션
  console.log('');
  logger.header('온톨로지');

  const ontologyConfig = config.ontology;
  if (!ontologyConfig || !ontologyConfig.enabled) {
    logger.info('온톨로지: 비활성화 (carpdm-harness ontology --generate로 활성화)');
    return;
  }

  logger.table([
    ['활성화', '예'],
    ['출력 디렉토리', ontologyConfig.outputDir],
    ['플러그인', ontologyConfig.plugins.join(', ') || '없음'],
    ['자동 갱신', ontologyConfig.autoUpdate.enabled ? `예 (${ontologyConfig.autoUpdate.gitHook})` : '아니오'],
    ['AI 제공자', ontologyConfig.ai ? ontologyConfig.ai.provider : '없음'],
  ]);

  // 각 계층 상태
  const layers: Array<'structure' | 'semantics' | 'domain'> = ['structure', 'semantics', 'domain'];
  console.log('');
  logger.info('계층별 상태:');

  for (const layer of layers) {
    const layerCfg = ontologyConfig.layers[layer];
    const enabled = layerCfg.enabled;
    const status = getOntologyStatus(projectRoot, ontologyConfig);
    const layerStatus = status?.layerStatus[layer];
    const lastBuilt = layerStatus?.lastBuilt ?? '미빌드';
    const fileCount = layerStatus?.fileCount ?? 0;

    logger.table([
      [layer, enabled ? '활성' : '비활성'],
      ['마지막 빌드', lastBuilt],
      ['파일 수', `${fileCount}개`],
    ]);
  }
}
