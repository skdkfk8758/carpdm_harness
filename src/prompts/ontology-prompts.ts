import type { OntologyConfig, AIProviderConfig } from '../types/ontology.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';

/** 온톨로지 초기 설정 프롬프트 */
export async function promptOntologySetup(): Promise<OntologyConfig> {
  const inquirer = await import('inquirer');

  // 1. 온톨로지 활성화 여부
  const { enabled } = await inquirer.default.prompt<{ enabled: boolean }>([
    {
      type: 'confirm',
      name: 'enabled',
      message: '온톨로지 기능을 활성화하시겠습니까? (프로젝트 구조/코드 시맨틱/도메인 지식 자동 생성)',
      default: false,
    },
  ]);

  if (!enabled) {
    return { ...DEFAULT_ONTOLOGY_CONFIG, enabled: false };
  }

  // 2. 계층 선택
  const { layers } = await inquirer.default.prompt<{ layers: string[] }>([
    {
      type: 'checkbox',
      name: 'layers',
      message: '활성화할 계층을 선택하세요:',
      choices: [
        { name: 'structure — 파일/디렉토리/모듈 관계 맵', value: 'structure', checked: true },
        { name: 'semantics — 함수/클래스/타입 의존성 분석', value: 'semantics', checked: true },
        { name: 'domain — AI 기반 도메인 지식 추출 (API 키 필요)', value: 'domain', checked: false },
      ],
    },
  ]);

  const structureEnabled = layers.includes('structure');
  const semanticsEnabled = layers.includes('semantics');
  const domainEnabled = layers.includes('domain');

  // 3. semantics 선택 시 언어 선택
  let semanticsLanguages = ['typescript'];
  if (semanticsEnabled) {
    const { languages } = await inquirer.default.prompt<{ languages: string[] }>([
      {
        type: 'checkbox',
        name: 'languages',
        message: '분석할 언어를 선택하세요:',
        choices: [
          { name: 'TypeScript / JavaScript', value: 'typescript', checked: true },
        ],
      },
    ]);
    semanticsLanguages = languages.length > 0 ? languages : ['typescript'];
  }

  // 4. domain 선택 시 AI 제공자 선택
  let aiConfig: AIProviderConfig | null = null;
  let domainProvider = 'anthropic';
  let domainModel = 'claude-sonnet-4-20250514';

  if (domainEnabled) {
    const { provider } = await inquirer.default.prompt<{ provider: 'anthropic' | 'openai' | 'custom' }>([
      {
        type: 'list',
        name: 'provider',
        message: 'AI 제공자를 선택하세요:',
        choices: [
          { name: 'Anthropic (Claude)', value: 'anthropic' },
          { name: 'OpenAI (GPT)', value: 'openai' },
          { name: 'Custom (직접 설정)', value: 'custom' },
        ],
        default: 'anthropic',
      },
    ]);

    const defaultEnvMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      custom: 'AI_API_KEY',
    };
    const defaultModelMap: Record<string, string> = {
      anthropic: 'claude-sonnet-4-20250514',
      openai: 'gpt-4o',
      custom: 'gpt-4o',
    };

    domainProvider = provider;
    domainModel = defaultModelMap[provider];

    // 5. API 키 환경변수 이름
    const { apiKeyEnv } = await inquirer.default.prompt<{ apiKeyEnv: string }>([
      {
        type: 'input',
        name: 'apiKeyEnv',
        message: 'API 키 환경변수 이름:',
        default: defaultEnvMap[provider],
      },
    ]);

    aiConfig = {
      provider,
      apiKeyEnv,
      model: domainModel,
      maxTokensPerRequest: 4096,
      rateLimitMs: 1000,
    };
  }

  // 6. 자동 갱신 활성화
  const { autoUpdateEnabled } = await inquirer.default.prompt<{ autoUpdateEnabled: boolean }>([
    {
      type: 'confirm',
      name: 'autoUpdateEnabled',
      message: '온톨로지 자동 갱신을 활성화하시겠습니까? (git hook 기반)',
      default: false,
    },
  ]);

  // 7. 자동 갱신 시 git hook 종류
  let gitHook: 'post-commit' | 'pre-push' | 'manual' = 'post-commit';
  if (autoUpdateEnabled) {
    const { selectedHook } = await inquirer.default.prompt<{ selectedHook: 'post-commit' | 'pre-push' | 'manual' }>([
      {
        type: 'list',
        name: 'selectedHook',
        message: 'git hook 종류를 선택하세요:',
        choices: [
          { name: 'post-commit — 커밋 후 자동 갱신', value: 'post-commit' },
          { name: 'pre-push — 푸시 전 갱신', value: 'pre-push' },
          { name: 'manual — 수동 실행만', value: 'manual' },
        ],
        default: 'post-commit',
      },
    ]);
    gitHook = selectedHook;
  }

  const ontologyConfig: OntologyConfig = {
    enabled: true,
    outputDir: DEFAULT_ONTOLOGY_CONFIG.outputDir,
    layers: {
      structure: {
        ...DEFAULT_ONTOLOGY_CONFIG.layers.structure,
        enabled: structureEnabled,
      },
      semantics: {
        ...DEFAULT_ONTOLOGY_CONFIG.layers.semantics,
        enabled: semanticsEnabled,
        languages: semanticsLanguages,
      },
      domain: {
        ...DEFAULT_ONTOLOGY_CONFIG.layers.domain,
        enabled: domainEnabled,
        provider: domainProvider,
        model: domainModel,
      },
    },
    autoUpdate: {
      enabled: autoUpdateEnabled,
      gitHook,
      debounceMs: DEFAULT_ONTOLOGY_CONFIG.autoUpdate.debounceMs,
      incrementalOnly: DEFAULT_ONTOLOGY_CONFIG.autoUpdate.incrementalOnly,
    },
    plugins: semanticsEnabled ? ['typescript'] : [],
    ai: aiConfig,
  };

  return ontologyConfig;
}
