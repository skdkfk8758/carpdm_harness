export interface InitAnswers {
  preset: string;
  modules: string[];
  installGlobal: boolean;
  registerHooks: boolean;
  docsDir: string;
  agentDir: string;
  confirm: boolean;
}

export async function runInitPrompts(
  _presetNames: string[],
  moduleNames: string[],
): Promise<InitAnswers> {
  const inquirer = await import('inquirer');

  const answers = await inquirer.default.prompt([
    {
      type: 'list',
      name: 'preset',
      message: '어떤 프리셋을 사용하시겠습니까?',
      choices: [
        { name: 'standard (추천) — core + quality + ship', value: 'standard' },
        { name: 'full — 전체 6개 모듈', value: 'full' },
        { name: 'tdd — core + tdd + quality + ship', value: 'tdd' },
        { name: 'minimal — core만', value: 'minimal' },
        { name: 'custom — 직접 선택', value: 'custom' },
      ],
      default: 'standard',
    },
    {
      type: 'checkbox',
      name: 'modules',
      message: '설치할 모듈을 선택하세요:',
      choices: moduleNames.map(name => ({ name, checked: name === 'core' })),
      when: (answers: { preset: string }) => answers.preset === 'custom',
    },
    {
      type: 'confirm',
      name: 'installGlobal',
      message: '글로벌 커맨드도 설치하시겠습니까? (~/.claude/commands/)',
      default: true,
    },
    {
      type: 'confirm',
      name: 'registerHooks',
      message: '훅을 자동 등록하시겠습니까? (settings.local.json)',
      default: true,
    },
    {
      type: 'input',
      name: 'docsDir',
      message: '문서 템플릿 디렉토리:',
      default: 'docs/templates',
    },
    {
      type: 'input',
      name: 'agentDir',
      message: '에이전트 작업 디렉토리:',
      default: '.agent',
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: '위 설정으로 설치를 진행하시겠습니까?',
      default: true,
    },
  ]);

  return answers as InitAnswers;
}
