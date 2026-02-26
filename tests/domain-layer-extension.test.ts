import { describe, it, expect } from 'vitest';
import { renderDomainMarkdown } from '../src/core/ontology/markdown-renderer.js';
import type {
  DomainLayer,
  OntologyMetadata,
  DDDInsight,
  TestMaturityInsight,
  SchemaConsistencyInsight,
} from '../src/types/ontology.js';

// ── 테스트용 fixture ──

function makeMetadata(): OntologyMetadata {
  return {
    projectName: 'test-project',
    generatedAt: '2026-02-26T00:00:00.000Z',
    harnessVersion: '4.2.0',
    layerStatus: {
      structure: { enabled: true, lastBuilt: '2026-02-26T00:00:00.000Z', lastError: null, fileCount: 10 },
      semantics: { enabled: true, lastBuilt: '2026-02-26T00:00:00.000Z', lastError: null, fileCount: 10 },
      domain: { enabled: true, lastBuilt: '2026-02-26T00:00:00.000Z', lastError: null, fileCount: 0 },
    },
  };
}

function makeBaseDomainLayer(): DomainLayer {
  return {
    projectSummary: 'A test project.',
    architecture: { style: 'layered', layers: ['tools', 'core'], keyDecisions: [], entryPoints: [] },
    patterns: [],
    conventions: [],
    glossary: [],
  };
}

function makeDDDInsight(): DDDInsight {
  return {
    boundedContexts: [
      { name: 'OrderManagement', modules: ['src/order/', 'src/payment/'], description: '주문 관리 컨텍스트' },
    ],
    aggregateRoots: [
      { name: 'Order', file: 'src/order/order.ts', entities: ['OrderItem'], valueObjects: ['Money'] },
    ],
    domainServices: ['OrderService'],
    repositories: ['OrderRepository'],
    valueObjects: ['Money', 'Address'],
    domainEvents: ['OrderPlaced', 'OrderCancelled'],
  };
}

function makeTestMaturityInsight(): TestMaturityInsight {
  return {
    overallLevel: 'moderate',
    testFramework: 'vitest',
    testPatterns: ['describe/it blocks', 'temp directory isolation'],
    coverage: {
      testedModules: ['src/core/config.ts', 'src/core/workflow-engine.ts'],
      untestedModules: ['src/core/ontology/domain-builder.ts'],
      ratio: '2/3 modules',
    },
    gaps: [
      { area: 'ontology', description: 'Domain builder lacks test coverage', priority: 'high' },
    ],
    recommendations: ['Add integration tests for ontology pipeline'],
  };
}

function makeSchemaConsistencyInsight(): SchemaConsistencyInsight {
  return {
    typeStrategy: 'strict',
    sharedTypes: ['HarnessConfig', 'WorkflowInstance'],
    inconsistencies: [
      {
        type: 'naming-mismatch',
        description: 'Config vs Configuration naming inconsistency',
        files: ['src/types/config.ts', 'src/core/settings.ts'],
        severity: 'warning',
      },
    ],
    recommendations: ['Standardize type naming to use Config suffix'],
  };
}

// ── 테스트 ──

describe('Domain Layer Extension — 타입 호환성', () => {
  it('should accept DomainLayer without new optional fields (하위호환)', () => {
    const layer = makeBaseDomainLayer();
    // optional 필드 없이도 DomainLayer로 사용 가능
    expect(layer.ddd).toBeUndefined();
    expect(layer.testMaturity).toBeUndefined();
    expect(layer.schemaConsistency).toBeUndefined();
  });

  it('should accept DomainLayer with all new fields', () => {
    const layer: DomainLayer = {
      ...makeBaseDomainLayer(),
      ddd: makeDDDInsight(),
      testMaturity: makeTestMaturityInsight(),
      schemaConsistency: makeSchemaConsistencyInsight(),
    };
    expect(layer.ddd?.boundedContexts).toHaveLength(1);
    expect(layer.testMaturity?.overallLevel).toBe('moderate');
    expect(layer.schemaConsistency?.typeStrategy).toBe('strict');
  });
});

describe('renderDomainMarkdown — 기존 섹션 유지', () => {
  it('should render base sections without new fields', () => {
    const md = renderDomainMarkdown(makeBaseDomainLayer(), makeMetadata());
    expect(md).toContain('# ONTOLOGY-DOMAIN');
    expect(md).toContain('## Project Summary');
    expect(md).toContain('## Architecture');
    expect(md).toContain('## Glossary');
    // 새 섹션은 없어야 함
    expect(md).not.toContain('## DDD Structure');
    expect(md).not.toContain('## Test Maturity');
    expect(md).not.toContain('## Schema Consistency');
  });
});

describe('renderDomainMarkdown — DDD 섹션 (Step 5)', () => {
  it('should render DDD section with full data', () => {
    const layer: DomainLayer = { ...makeBaseDomainLayer(), ddd: makeDDDInsight() };
    const md = renderDomainMarkdown(layer, makeMetadata());

    expect(md).toContain('## DDD Structure');
    expect(md).toContain('### Bounded Contexts');
    expect(md).toContain('OrderManagement');
    expect(md).toContain('### Aggregate Roots');
    expect(md).toContain('Order');
    expect(md).toContain('OrderItem');
    expect(md).toContain('### Domain Services');
    expect(md).toContain('OrderService');
    expect(md).toContain('### Repositories');
    expect(md).toContain('OrderRepository');
    expect(md).toContain('### Value Objects');
    expect(md).toContain('Money');
    expect(md).toContain('### Domain Events');
    expect(md).toContain('OrderPlaced');
  });

  it('should render empty DDD message when no patterns detected', () => {
    const emptyDDD: DDDInsight = {
      boundedContexts: [], aggregateRoots: [], domainServices: [],
      repositories: [], valueObjects: [], domainEvents: [],
    };
    const layer: DomainLayer = { ...makeBaseDomainLayer(), ddd: emptyDDD };
    const md = renderDomainMarkdown(layer, makeMetadata());

    expect(md).toContain('## DDD Structure');
    expect(md).toContain('DDD 패턴이 감지되지 않았습니다');
  });
});

describe('renderDomainMarkdown — Test Maturity 섹션 (Step 6)', () => {
  it('should render test maturity section with full data', () => {
    const layer: DomainLayer = { ...makeBaseDomainLayer(), testMaturity: makeTestMaturityInsight() };
    const md = renderDomainMarkdown(layer, makeMetadata());

    expect(md).toContain('## Test Maturity');
    expect(md).toContain('**Moderate**');
    expect(md).toContain('vitest');
    expect(md).toContain('2/3 modules');
    expect(md).toContain('### 테스트 패턴');
    expect(md).toContain('describe/it blocks');
    expect(md).toContain('### 테스트 갭');
    expect(md).toContain('ontology');
    expect(md).toContain('### 권장 사항');
    expect(md).toContain('integration tests');
  });

  it('should render none level with null framework', () => {
    const tm: TestMaturityInsight = {
      overallLevel: 'none', testFramework: null, testPatterns: [],
      coverage: { testedModules: [], untestedModules: [], ratio: '0/0' },
      gaps: [], recommendations: [],
    };
    const layer: DomainLayer = { ...makeBaseDomainLayer(), testMaturity: tm };
    const md = renderDomainMarkdown(layer, makeMetadata());

    expect(md).toContain('**None**');
    expect(md).toContain('_(없음)_');
  });
});

describe('renderDomainMarkdown — Schema Consistency 섹션 (Step 7)', () => {
  it('should render schema consistency section with full data', () => {
    const layer: DomainLayer = { ...makeBaseDomainLayer(), schemaConsistency: makeSchemaConsistencyInsight() };
    const md = renderDomainMarkdown(layer, makeMetadata());

    expect(md).toContain('## Schema Consistency');
    expect(md).toContain('strict');
    expect(md).toContain('### 공유 타입');
    expect(md).toContain('HarnessConfig');
    expect(md).toContain('### 불일치 항목');
    expect(md).toContain('naming-mismatch');
    expect(md).toContain('### 권장 사항');
    expect(md).toContain('Standardize');
  });

  it('should render empty schema message when no data', () => {
    const sc: SchemaConsistencyInsight = {
      typeStrategy: 'unknown', sharedTypes: [], inconsistencies: [], recommendations: [],
    };
    const layer: DomainLayer = { ...makeBaseDomainLayer(), schemaConsistency: sc };
    const md = renderDomainMarkdown(layer, makeMetadata());

    expect(md).toContain('## Schema Consistency');
    expect(md).toContain('스키마 분석 결과 없음');
  });
});

describe('renderDomainMarkdown — 전체 통합', () => {
  it('should render all 3 new sections together', () => {
    const layer: DomainLayer = {
      ...makeBaseDomainLayer(),
      ddd: makeDDDInsight(),
      testMaturity: makeTestMaturityInsight(),
      schemaConsistency: makeSchemaConsistencyInsight(),
    };
    const md = renderDomainMarkdown(layer, makeMetadata());

    // 기존 섹션
    expect(md).toContain('## Project Summary');
    expect(md).toContain('## Architecture');
    expect(md).toContain('## Glossary');

    // 새 섹션 — 순서 확인 (DDD → Test → Schema)
    const dddIdx = md.indexOf('## DDD Structure');
    const testIdx = md.indexOf('## Test Maturity');
    const schemaIdx = md.indexOf('## Schema Consistency');

    expect(dddIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeGreaterThan(dddIdx);
    expect(schemaIdx).toBeGreaterThan(testIdx);
  });
});
