import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_ONTOLOGY_CONFIG } from '../../src/types/ontology.js';

// loadConfig를 mock하여 파일시스템 의존성 제거
vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn(),
}));

import { loadConfig } from '../../src/core/config.js';
import { loadMergedOntologyConfig } from '../../src/core/ontology/config-loader.js';

const mockedLoadConfig = vi.mocked(loadConfig);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadMergedOntologyConfig', () => {
  it('config가 없으면 DEFAULT_ONTOLOGY_CONFIG를 반환한다', () => {
    mockedLoadConfig.mockReturnValue(null);

    const result = loadMergedOntologyConfig('/fake/root');
    expect(result).toEqual(DEFAULT_ONTOLOGY_CONFIG);
  });

  it('ontology 설정이 없는 config면 DEFAULT를 반환한다', () => {
    mockedLoadConfig.mockReturnValue({} as ReturnType<typeof loadConfig>);

    const result = loadMergedOntologyConfig('/fake/root');
    expect(result).toEqual(DEFAULT_ONTOLOGY_CONFIG);
  });

  it('사용자 ontology 설정과 DEFAULT를 deep merge한다', () => {
    mockedLoadConfig.mockReturnValue({
      ontology: {
        enabled: true,
        outputDir: '.custom-ontology',
      },
    } as ReturnType<typeof loadConfig>);

    const result = loadMergedOntologyConfig('/fake/root');
    expect(result.enabled).toBe(true);
    expect(result.outputDir).toBe('.custom-ontology');
    // layers는 DEFAULT에서 상속
    expect(result.layers).toBeDefined();
    expect(result.layers.structure).toBeDefined();
  });

  it('layers.structure.excludePatterns를 병합한다', () => {
    const customPatterns = ['custom/**', 'temp/**'];
    mockedLoadConfig.mockReturnValue({
      ontology: {
        layers: {
          structure: {
            excludePatterns: customPatterns,
          },
        },
      },
    } as ReturnType<typeof loadConfig>);

    const result = loadMergedOntologyConfig('/fake/root');
    const patterns = result.layers.structure.excludePatterns;

    // DEFAULT 패턴 + 사용자 패턴 모두 포함
    for (const p of DEFAULT_ONTOLOGY_CONFIG.layers.structure.excludePatterns) {
      expect(patterns).toContain(p);
    }
    for (const p of customPatterns) {
      expect(patterns).toContain(p);
    }
  });

  it('사용자가 excludePatterns를 지정하지 않으면 DEFAULT 패턴만 포함', () => {
    mockedLoadConfig.mockReturnValue({
      ontology: {
        enabled: true,
        layers: {
          structure: {},
        },
      },
    } as ReturnType<typeof loadConfig>);

    const result = loadMergedOntologyConfig('/fake/root');
    const patterns = result.layers.structure.excludePatterns;

    // mergeExcludePatterns가 중복 제거를 수행하므로 Set 비교
    const defaultSet = new Set(DEFAULT_ONTOLOGY_CONFIG.layers.structure.excludePatterns);
    const resultSet = new Set(patterns);
    expect(resultSet).toEqual(defaultSet);
  });
});
