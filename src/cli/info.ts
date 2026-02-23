import { loadConfig } from '../core/config.js';
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
}
