import { Command } from 'commander';
import { getPackageVersion } from './utils/version.js';
import { initCommand } from './cli/init.js';
import { updateCommand } from './cli/update.js';
import { migrateCommand } from './cli/migrate.js';
import { listCommand } from './cli/list.js';
import { infoCommand } from './cli/info.js';
import { doctorCommand } from './cli/doctor.js';

const program = new Command();

program
  .name('carpdm-harness')
  .description('AI 협업 워크플로우 모듈화 CLI — Plan-First + DDD + SPARC')
  .version(getPackageVersion());

program
  .command('init')
  .description('프로젝트에 워크플로우 설치')
  .option('--preset <name>', '프리셋 (full|standard|minimal|tdd)', 'standard')
  .option('--modules <list>', '모듈 직접 지정 (쉼표 구분)')
  .option('--global', '~/.claude/commands/에도 글로벌 커맨드 설치')
  .option('--skip-hooks', '훅 등록 건너뛰기')
  .option('--dry-run', '미리보기만')
  .option('--yes', '비대화형 (기본값 수락)')
  .action(initCommand);

program
  .command('update')
  .description('설치된 템플릿 diff 기반 업데이트')
  .option('--all', '전체 모듈 업데이트')
  .option('--module <name>', '특정 모듈만')
  .option('--global', '글로벌 커맨드도 업데이트')
  .option('--dry-run', 'diff만 표시')
  .option('--accept-all', '모든 변경 수락')
  .action(updateCommand);

program
  .command('migrate')
  .description('기존 agent_harness → carpdm-harness 전환')
  .option('--source <path>', 'agent_harness 레포 경로')
  .option('--dry-run', '마이그레이션 계획만 표시')
  .option('--keep-old', '기존 파일 유지')
  .action(migrateCommand);

program
  .command('list')
  .description('모듈/프리셋 목록 표시')
  .option('--modules', '모듈 목록')
  .option('--presets', '프리셋 목록')
  .action(listCommand);

program
  .command('info')
  .description('현재 설치 상태 표시')
  .action(infoCommand);

program
  .command('doctor')
  .description('설치 건강 진단')
  .action(doctorCommand);

program.parse();
