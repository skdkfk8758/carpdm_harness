import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scanDocFiles,
  parseDocLocally,
  inferDocType,
  buildCrossReferences,
} from '../src/core/ontology/domain-builder.js';
import { renderDomainMarkdown } from '../src/core/ontology/markdown-renderer.js';
import type {
  DomainLayer,
  OntologyMetadata,
  DocumentationIndex,
  SemanticsLayer,
} from '../src/types/ontology.js';

// ── fixture ──

function makeMetadata(): OntologyMetadata {
  return {
    projectName: 'test-project',
    generatedAt: '2026-02-26T00:00:00.000Z',
    harnessVersion: '4.2.0',
    layerStatus: {
      structure: { enabled: true, lastBuilt: null, lastError: null, fileCount: 0 },
      semantics: { enabled: true, lastBuilt: null, lastError: null, fileCount: 0 },
      domain: { enabled: true, lastBuilt: null, lastError: null, fileCount: 0 },
    },
  };
}

function makeBaseDomainLayer(): DomainLayer {
  return {
    projectSummary: 'Test project.',
    architecture: { style: 'layered', layers: [], keyDecisions: [], entryPoints: [] },
    patterns: [],
    conventions: [],
    glossary: [],
  };
}

function makeSemanticsLayer(): SemanticsLayer {
  return {
    files: [],
    symbols: {
      byName: {
        OrderService: [{ file: 'src/services/order.ts', line: 10, kind: 'class' }],
        UserRepository: [{ file: 'src/repos/user.ts', line: 5, kind: 'class' }],
        PaymentGateway: [{ file: 'src/services/payment.ts', line: 1, kind: 'interface' }],
      },
      exportedCount: 3,
      totalCount: 3,
    },
    dependencies: { internal: [], external: [] },
  };
}

// ── scanDocFiles ──

describe('scanDocFiles', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-doc-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should find docs/ directory and scan .md files', () => {
    mkdirSync(join(testDir, 'docs'));
    writeFileSync(join(testDir, 'docs', 'api.md'), '# API Guide');
    writeFileSync(join(testDir, 'docs', 'schema.md'), '# DB Schema');

    const result = scanDocFiles(testDir);
    expect(result.docsRoot).toBe('docs');
    expect(result.files).toHaveLength(2);
    expect(result.files).toContain('docs/api.md');
    expect(result.files).toContain('docs/schema.md');
  });

  it('should find doc/ if docs/ does not exist', () => {
    mkdirSync(join(testDir, 'doc'));
    writeFileSync(join(testDir, 'doc', 'readme.md'), '# Readme');

    const result = scanDocFiles(testDir);
    expect(result.docsRoot).toBe('doc');
    expect(result.files).toHaveLength(1);
  });

  it('should return empty when no doc directory exists', () => {
    const result = scanDocFiles(testDir);
    expect(result.docsRoot).toBe('');
    expect(result.files).toHaveLength(0);
  });

  it('should scan nested directories up to max depth', () => {
    mkdirSync(join(testDir, 'docs', 'api'), { recursive: true });
    writeFileSync(join(testDir, 'docs', 'overview.md'), '# Overview');
    writeFileSync(join(testDir, 'docs', 'api', 'endpoints.md'), '# Endpoints');

    const result = scanDocFiles(testDir);
    expect(result.files).toHaveLength(2);
    expect(result.files).toContain('docs/api/endpoints.md');
  });

  it('should include yaml and txt files', () => {
    mkdirSync(join(testDir, 'docs'));
    writeFileSync(join(testDir, 'docs', 'config.yaml'), 'key: value');
    writeFileSync(join(testDir, 'docs', 'notes.txt'), 'Some notes');
    writeFileSync(join(testDir, 'docs', 'image.png'), 'binary');  // 제외

    const result = scanDocFiles(testDir);
    expect(result.files).toHaveLength(2);
    expect(result.files).not.toContain('docs/image.png');
  });
});

// ── inferDocType ──

describe('inferDocType', () => {
  it('should detect schema from SQL content', () => {
    expect(inferDocType('CREATE TABLE users (id INT)', 'schema.md')).toBe('schema');
    expect(inferDocType('ALTER TABLE orders ADD COLUMN', 'db.md')).toBe('schema');
  });

  it('should detect api-spec from OpenAPI content', () => {
    expect(inferDocType('openapi: 3.0.0\ninfo:', 'api.yaml')).toBe('api-spec');
    expect(inferDocType('swagger: "2.0"', 'spec.yml')).toBe('api-spec');
  });

  it('should detect adr from filename or content', () => {
    expect(inferDocType('Some content', 'adr-001.md')).toBe('adr');
    expect(inferDocType('## Decision\nUse PostgreSQL', 'choice.md')).toBe('adr');
  });

  it('should detect runbook from filename or content', () => {
    expect(inferDocType('Steps to deploy', 'runbook-deploy.md')).toBe('runbook');
    expect(inferDocType('## Procedure\n1. SSH into server', 'deploy.md')).toBe('runbook');
  });

  it('should detect guide from filename', () => {
    expect(inferDocType('How to get started', 'getting-started-guide.md')).toBe('guide');
  });

  it('should detect reference from filename', () => {
    expect(inferDocType('API endpoints list', 'api-reference.md')).toBe('reference');
  });

  it('should detect config from yaml/json extensions', () => {
    expect(inferDocType('key: value', 'settings.yaml')).toBe('config');
    expect(inferDocType('key: value', 'config.yml')).toBe('config');
  });

  it('should return other for unrecognized content', () => {
    expect(inferDocType('Some random notes', 'notes.md')).toBe('other');
  });
});

// ── parseDocLocally ──

describe('parseDocLocally', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-doc-parse-'));
    mkdirSync(join(testDir, 'docs'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should extract title from H1', () => {
    writeFileSync(join(testDir, 'docs', 'guide.md'), '# My Guide\n\nContent here');
    const result = parseDocLocally(testDir, 'docs/guide.md');
    expect(result.title).toBe('My Guide');
  });

  it('should fallback to filename when no H1', () => {
    writeFileSync(join(testDir, 'docs', 'notes.md'), 'Just some text');
    const result = parseDocLocally(testDir, 'docs/notes.md');
    expect(result.title).toBe('notes');
  });

  it('should extract headings', () => {
    writeFileSync(join(testDir, 'docs', 'guide.md'), '# Title\n## Section 1\n### Sub 1\n## Section 2');
    const result = parseDocLocally(testDir, 'docs/guide.md');
    expect(result.headings).toHaveLength(4);
    expect(result.headings[1]).toBe('## Section 1');
  });

  it('should extract code block languages', () => {
    writeFileSync(join(testDir, 'docs', 'example.md'), '# Example\n```sql\nSELECT 1\n```\n```typescript\nconst x = 1;\n```');
    const result = parseDocLocally(testDir, 'docs/example.md');
    expect(result.codeBlockLanguages).toContain('sql');
    expect(result.codeBlockLanguages).toContain('typescript');
  });

  it('should infer docType from content', () => {
    writeFileSync(join(testDir, 'docs', 'db.md'), '# Schema\n\nCREATE TABLE users (id INT)');
    const result = parseDocLocally(testDir, 'docs/db.md');
    expect(result.docType).toBe('schema');
  });

  it('should handle missing file gracefully', () => {
    const result = parseDocLocally(testDir, 'docs/nonexistent.md');
    expect(result.title).toBe('nonexistent');
    expect(result.docType).toBe('other');
    expect(result.headings).toHaveLength(0);
  });
});

// ── buildCrossReferences ──

describe('buildCrossReferences', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-doc-xref-'));
    mkdirSync(join(testDir, 'docs'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should find symbol references in document content', () => {
    writeFileSync(join(testDir, 'docs', 'architecture.md'), '# Architecture\n\nThe OrderService handles all order operations.');

    const refs = buildCrossReferences(testDir, ['docs/architecture.md'], makeSemanticsLayer());
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs.some((r) => r.symbolName === 'OrderService')).toBe(true);
    expect(refs[0].confidence).toBe('high');
  });

  it('should not match partial words', () => {
    writeFileSync(join(testDir, 'docs', 'notes.md'), '# Notes\n\nThe order is important.');

    const refs = buildCrossReferences(testDir, ['docs/notes.md'], makeSemanticsLayer());
    // "order" should not match "OrderService"
    expect(refs.some((r) => r.symbolName === 'OrderService')).toBe(false);
  });

  it('should return empty when semanticsLayer is null', () => {
    writeFileSync(join(testDir, 'docs', 'test.md'), 'OrderService usage');
    const refs = buildCrossReferences(testDir, ['docs/test.md'], null);
    expect(refs).toHaveLength(0);
  });

  it('should skip symbols shorter than 3 characters', () => {
    const semantics = makeSemanticsLayer();
    semantics.symbols.byName['id'] = [{ file: 'src/types.ts', line: 1, kind: 'variable' }];
    writeFileSync(join(testDir, 'docs', 'test.md'), 'The id field is important.');

    const refs = buildCrossReferences(testDir, ['docs/test.md'], semantics);
    expect(refs.some((r) => r.symbolName === 'id')).toBe(false);
  });
});

// ── renderDomainMarkdown — Documentation Index ──

describe('renderDomainMarkdown — Documentation Index (Step 8)', () => {
  it('should not render section when documentationIndex is undefined', () => {
    const md = renderDomainMarkdown(makeBaseDomainLayer(), makeMetadata());
    expect(md).not.toContain('## Documentation Index');
  });

  it('should render documentation index with full data', () => {
    const index: DocumentationIndex = {
      docsRoot: 'docs',
      totalFiles: 2,
      documents: [
        {
          path: 'docs/api.md', title: 'API Guide', docType: 'guide',
          summary: 'API 사용법을 설명합니다.',
          keyConcepts: ['REST', 'authentication'],
          relatedSymbols: ['OrderService'],
          codeBlockLanguages: ['typescript'], headings: ['# API Guide'],
        },
        {
          path: 'docs/schema.md', title: 'DB Schema', docType: 'schema',
          summary: 'Database schema definition.',
          keyConcepts: ['users', 'orders'],
          relatedSymbols: ['UserRepository'],
          codeBlockLanguages: ['sql'], headings: ['# DB Schema'],
        },
      ],
      crossReferences: [
        { docPath: 'docs/api.md', symbolName: 'OrderService', symbolFile: 'src/services/order.ts', confidence: 'high' },
      ],
    };

    const layer: DomainLayer = { ...makeBaseDomainLayer(), documentationIndex: index };
    const md = renderDomainMarkdown(layer, makeMetadata());

    expect(md).toContain('## Documentation Index');
    expect(md).toContain('2개 문서');
    expect(md).toContain('### 문서 목록');
    expect(md).toContain('docs/api.md');
    expect(md).toContain('guide');
    expect(md).toContain('REST, authentication');
    expect(md).toContain('### 문서 요약');
    expect(md).toContain('API 사용법을 설명합니다.');
    expect(md).toContain('`OrderService`');
    expect(md).toContain('### 코드 크로스레퍼런스');
    expect(md).toContain('high');
  });

  it('should render section without summaries when AI was not available', () => {
    const index: DocumentationIndex = {
      docsRoot: 'docs',
      totalFiles: 1,
      documents: [{
        path: 'docs/notes.md', title: 'Notes', docType: 'other',
        summary: '', keyConcepts: [], relatedSymbols: [],
        codeBlockLanguages: [], headings: ['# Notes'],
      }],
      crossReferences: [],
    };

    const layer: DomainLayer = { ...makeBaseDomainLayer(), documentationIndex: index };
    const md = renderDomainMarkdown(layer, makeMetadata());

    expect(md).toContain('## Documentation Index');
    expect(md).toContain('### 문서 목록');
    expect(md).not.toContain('### 문서 요약');
    expect(md).not.toContain('### 코드 크로스레퍼런스');
  });
});
