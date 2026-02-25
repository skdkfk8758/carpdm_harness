import { describe, it, expect } from 'vitest';
import {
  analyzeFanIn,
  analyzeComplexity,
  scanExistingAnnotations,
  scanTodoComments,
  generateAnnotations,
} from '../src/core/ontology/annotation-analyzer.js';
import type {
  SemanticsLayer,
  SemanticFile,
  FunctionEntry,
  SymbolIndex,
  DependencyGraph,
} from '../src/types/ontology.js';

// ────────────────────────────────────────────────────────────────────────────
// 테스트 헬퍼
// ────────────────────────────────────────────────────────────────────────────

function makeSemanticFile(overrides: Partial<SemanticFile> = {}): SemanticFile {
  return {
    path: '/project/src/test.ts',
    language: 'typescript',
    exports: [],
    imports: [],
    classes: [],
    functions: [],
    interfaces: [],
    types: [],
    ...overrides,
  };
}

function makeFunction(overrides: Partial<FunctionEntry> = {}): FunctionEntry {
  return {
    name: 'testFn',
    kind: 'function',
    line: 1,
    exported: true,
    params: [],
    returnType: 'void',
    isAsync: false,
    ...overrides,
  };
}

function makeSemanticsLayer(overrides: Partial<SemanticsLayer> = {}): SemanticsLayer {
  return {
    files: [],
    symbols: { byName: {}, exportedCount: 0, totalCount: 0 },
    dependencies: { internal: [], external: [] },
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// @MX:ANCHOR — fan_in 분석
// ────────────────────────────────────────────────────────────────────────────

describe('@MX:ANCHOR — fan_in 분석', () => {
  it('3개 이상 파일이 import하는 심볼을 ANCHOR로 태깅한다', () => {
    const semantics = makeSemanticsLayer({
      files: [
        makeSemanticFile({
          path: '/project/src/config.ts',
          exports: [{ name: 'loadConfig', kind: 'function', line: 10, exported: true }],
          imports: [],
        }),
        makeSemanticFile({
          path: '/project/src/a.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
        makeSemanticFile({
          path: '/project/src/b.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
        makeSemanticFile({
          path: '/project/src/c.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
      ],
      symbols: {
        byName: {
          loadConfig: [{ file: '/project/src/config.ts', line: 10, kind: 'function' }],
        },
        exportedCount: 1,
        totalCount: 1,
      },
    });

    const result = analyzeFanIn(semantics);
    expect(result.length).toBe(1);
    expect(result[0].tag).toBe('ANCHOR');
    expect(result[0].symbolName).toBe('loadConfig');
    expect(result[0].metadata?.fanIn).toBe(3);
  });

  it('2개 파일만 참조하면 ANCHOR로 태깅하지 않는다', () => {
    const semantics = makeSemanticsLayer({
      files: [
        makeSemanticFile({
          path: '/project/src/config.ts',
          exports: [{ name: 'loadConfig', kind: 'function', line: 10, exported: true }],
          imports: [],
        }),
        makeSemanticFile({
          path: '/project/src/a.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
        makeSemanticFile({
          path: '/project/src/b.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
      ],
      symbols: {
        byName: {
          loadConfig: [{ file: '/project/src/config.ts', line: 10, kind: 'function' }],
        },
        exportedCount: 1,
        totalCount: 1,
      },
    });

    const result = analyzeFanIn(semantics);
    expect(result.length).toBe(0);
  });

  it('커스텀 threshold를 지원한다', () => {
    const semantics = makeSemanticsLayer({
      files: [
        makeSemanticFile({
          path: '/project/src/config.ts',
          exports: [{ name: 'loadConfig', kind: 'function', line: 10, exported: true }],
          imports: [],
        }),
        makeSemanticFile({
          path: '/project/src/a.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
        makeSemanticFile({
          path: '/project/src/b.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
      ],
      symbols: {
        byName: {
          loadConfig: [{ file: '/project/src/config.ts', line: 10, kind: 'function' }],
        },
        exportedCount: 1,
        totalCount: 1,
      },
    });

    // threshold=2이면 감지됨
    const result = analyzeFanIn(semantics, 2);
    expect(result.length).toBe(1);
    expect(result[0].metadata?.fanIn).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// @MX:WARN — 복잡도 분석
// ────────────────────────────────────────────────────────────────────────────

describe('@MX:WARN — 복잡도 분석', () => {
  it('매개변수 5개 이상 함수를 WARN으로 태깅한다', () => {
    const file = makeSemanticFile({
      functions: [
        makeFunction({
          name: 'complexFn',
          line: 5,
          params: [
            { name: 'a', type: 'string', optional: false },
            { name: 'b', type: 'number', optional: false },
            { name: 'c', type: 'boolean', optional: false },
            { name: 'd', type: 'string', optional: false },
            { name: 'e', type: 'number', optional: false },
          ],
        }),
      ],
    });

    const result = analyzeComplexity([file]);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const paramWarn = result.find((a) => a.message.includes('매개변수'));
    expect(paramWarn).toBeDefined();
    expect(paramWarn!.tag).toBe('WARN');
    expect(paramWarn!.symbolName).toBe('complexFn');
  });

  it('4개 이하 매개변수 함수는 WARN하지 않는다', () => {
    const file = makeSemanticFile({
      functions: [
        makeFunction({
          name: 'simpleFn',
          params: [
            { name: 'a', type: 'string', optional: false },
            { name: 'b', type: 'number', optional: false },
          ],
        }),
      ],
    });

    const result = analyzeComplexity([file]);
    const paramWarn = result.find((a) => a.message.includes('매개변수'));
    expect(paramWarn).toBeUndefined();
  });

  it('any 타입 사용 함수를 WARN으로 태깅한다', () => {
    const file = makeSemanticFile({
      functions: [
        makeFunction({
          name: 'unsafeFn',
          params: [{ name: 'data', type: 'any', optional: false }],
          returnType: 'string',
        }),
      ],
    });

    const result = analyzeComplexity([file]);
    const anyWarn = result.find((a) => a.message.includes('any'));
    expect(anyWarn).toBeDefined();
    expect(anyWarn!.tag).toBe('WARN');
  });

  it('any 반환 타입도 WARN으로 태깅한다', () => {
    const file = makeSemanticFile({
      functions: [
        makeFunction({
          name: 'unsafeReturn',
          params: [],
          returnType: 'any',
        }),
      ],
    });

    const result = analyzeComplexity([file]);
    const anyWarn = result.find((a) => a.message.includes('any'));
    expect(anyWarn).toBeDefined();
  });

  it('클래스 메서드도 분석한다', () => {
    const file = makeSemanticFile({
      classes: [
        {
          name: 'MyClass',
          kind: 'class',
          line: 1,
          exported: true,
          methods: [
            makeFunction({
              name: 'riskyMethod',
              kind: 'method',
              params: [
                { name: 'a', type: 'any', optional: false },
                { name: 'b', type: 'string', optional: false },
                { name: 'c', type: 'number', optional: false },
                { name: 'd', type: 'boolean', optional: false },
                { name: 'e', type: 'object', optional: false },
              ],
            }),
          ],
          properties: [],
        },
      ],
    });

    const result = analyzeComplexity([file]);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const methodWarn = result.find((a) => a.symbolName === 'riskyMethod');
    expect(methodWarn).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// @MX:TODO — TODO/FIXME 스캔 (파일 시스템 의존 — 단위 테스트 범위 밖)
// ────────────────────────────────────────────────────────────────────────────

describe('@MX:TODO — scanTodoComments', () => {
  it('존재하지 않는 파일은 건너뛴다', () => {
    const file = makeSemanticFile({ path: '/nonexistent/file.ts' });
    const result = scanTodoComments([file], '/nonexistent');
    expect(result).toEqual([]);
  });
});

describe('@MX:NOTE — scanExistingAnnotations', () => {
  it('존재하지 않는 파일은 건너뛴다', () => {
    const file = makeSemanticFile({ path: '/nonexistent/file.ts' });
    const result = scanExistingAnnotations([file], '/nonexistent');
    expect(result).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// generateAnnotations — 통합 분석
// ────────────────────────────────────────────────────────────────────────────

describe('generateAnnotations — 통합 분석', () => {
  it('AnnotationResult 구조를 올바르게 반환한다', () => {
    const semantics = makeSemanticsLayer({
      files: [
        makeSemanticFile({
          path: '/project/src/config.ts',
          exports: [{ name: 'loadConfig', kind: 'function', line: 10, exported: true }],
          imports: [],
          functions: [
            makeFunction({
              name: 'loadConfig',
              line: 10,
              params: [
                { name: 'a', type: 'any', optional: false },
                { name: 'b', type: 'string', optional: false },
                { name: 'c', type: 'number', optional: false },
                { name: 'd', type: 'boolean', optional: false },
                { name: 'e', type: 'object', optional: false },
              ],
            }),
          ],
        }),
        makeSemanticFile({
          path: '/project/src/a.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
        makeSemanticFile({
          path: '/project/src/b.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
        makeSemanticFile({
          path: '/project/src/c.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
      ],
      symbols: {
        byName: {
          loadConfig: [{ file: '/project/src/config.ts', line: 10, kind: 'function' }],
        },
        exportedCount: 1,
        totalCount: 1,
      },
    });

    const result = generateAnnotations(semantics, '/project');

    // 구조 검증
    expect(result).toHaveProperty('byFile');
    expect(result).toHaveProperty('summary');
    expect(result.summary).toHaveProperty('total');
    expect(result.summary).toHaveProperty('byTag');
    expect(result.summary).toHaveProperty('topAnchors');
    expect(result.summary).toHaveProperty('warnings');

    // ANCHOR가 감지되어야 함 (fan_in=3)
    expect(result.summary.byTag['ANCHOR']).toBeGreaterThanOrEqual(1);

    // WARN도 감지되어야 함 (매개변수 5개 + any 타입)
    expect(result.summary.byTag['WARN']).toBeGreaterThanOrEqual(1);

    // total은 ANCHOR + WARN + NOTE + TODO 합
    expect(result.summary.total).toBeGreaterThanOrEqual(2);
  });

  it('어노테이션이 없으면 빈 결과를 반환한다', () => {
    const semantics = makeSemanticsLayer({
      files: [
        makeSemanticFile({
          path: '/project/src/simple.ts',
          functions: [makeFunction({ name: 'simpleFn', params: [] })],
        }),
      ],
      symbols: {
        byName: {
          simpleFn: [{ file: '/project/src/simple.ts', line: 1, kind: 'function' }],
        },
        exportedCount: 1,
        totalCount: 1,
      },
    });

    const result = generateAnnotations(semantics, '/project');
    expect(result.summary.total).toBe(0);
    expect(result.summary.byTag).toEqual({});
    expect(result.summary.topAnchors).toEqual([]);
    expect(result.summary.warnings).toEqual([]);
  });

  it('SemanticFile.annotations에 어노테이션을 부착한다', () => {
    const configFile = makeSemanticFile({
      path: '/project/src/config.ts',
      exports: [{ name: 'loadConfig', kind: 'function', line: 10, exported: true }],
      imports: [],
      functions: [
        makeFunction({
          name: 'loadConfig',
          line: 10,
          params: [{ name: 'data', type: 'any', optional: false }],
        }),
      ],
    });

    const semantics = makeSemanticsLayer({
      files: [
        configFile,
        makeSemanticFile({
          path: '/project/src/a.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
        makeSemanticFile({
          path: '/project/src/b.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
        makeSemanticFile({
          path: '/project/src/c.ts',
          imports: [{ source: '../config.js', specifiers: ['loadConfig'], isTypeOnly: false, isDefault: false }],
        }),
      ],
      symbols: {
        byName: {
          loadConfig: [{ file: '/project/src/config.ts', line: 10, kind: 'function' }],
        },
        exportedCount: 1,
        totalCount: 1,
      },
    });

    generateAnnotations(semantics, '/project');

    // configFile에 annotations가 부착되어야 함
    expect(configFile.annotations).toBeDefined();
    expect(configFile.annotations!.length).toBeGreaterThan(0);
  });

  it('topAnchors가 fan_in 내림차순으로 정렬된다', () => {
    const semantics = makeSemanticsLayer({
      files: [
        makeSemanticFile({
          path: '/project/src/a.ts',
          exports: [
            { name: 'fnA', kind: 'function', line: 1, exported: true },
            { name: 'fnB', kind: 'function', line: 10, exported: true },
          ],
          imports: [],
        }),
        makeSemanticFile({
          path: '/project/src/b.ts',
          imports: [
            { source: './a.js', specifiers: ['fnA', 'fnB'], isTypeOnly: false, isDefault: false },
          ],
        }),
        makeSemanticFile({
          path: '/project/src/c.ts',
          imports: [
            { source: './a.js', specifiers: ['fnA', 'fnB'], isTypeOnly: false, isDefault: false },
          ],
        }),
        makeSemanticFile({
          path: '/project/src/d.ts',
          imports: [
            { source: './a.js', specifiers: ['fnA', 'fnB'], isTypeOnly: false, isDefault: false },
          ],
        }),
        makeSemanticFile({
          path: '/project/src/e.ts',
          imports: [
            { source: './a.js', specifiers: ['fnA'], isTypeOnly: false, isDefault: false },
          ],
        }),
      ],
      symbols: {
        byName: {
          fnA: [{ file: '/project/src/a.ts', line: 1, kind: 'function' }],
          fnB: [{ file: '/project/src/a.ts', line: 10, kind: 'function' }],
        },
        exportedCount: 2,
        totalCount: 2,
      },
    });

    const result = generateAnnotations(semantics, '/project');

    // fnA는 4개 파일, fnB는 3개 파일이 참조
    expect(result.summary.topAnchors.length).toBe(2);
    expect(result.summary.topAnchors[0].symbol).toBe('fnA');
    expect(result.summary.topAnchors[0].fanIn).toBe(4);
    expect(result.summary.topAnchors[1].symbol).toBe('fnB');
    expect(result.summary.topAnchors[1].fanIn).toBe(3);
  });
});
