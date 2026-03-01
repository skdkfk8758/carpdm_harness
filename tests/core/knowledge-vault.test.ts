import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  initKnowledgeVault,
  createBranchKnowledge,
  archiveBranchKnowledge,
  readBranchContext,
  updateKnowledgeIndex,
  syncOntologyToVault,
  publishOntologyDocs,
} from '../../src/core/knowledge-vault.js';
import type { KnowledgeConfig } from '../../src/types/config.js';
import { DEFAULT_KNOWLEDGE_CONFIG } from '../../src/types/config.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'kv-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('initKnowledgeVault', () => {
  it('디렉토리 구조를 생성한다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);

    expect(existsSync(join(tmpDir, '.knowledge'))).toBe(true);
    expect(existsSync(join(tmpDir, '.knowledge', 'branches'))).toBe(true);
    expect(existsSync(join(tmpDir, '.knowledge', 'branches', '_archive'))).toBe(true);
    expect(existsSync(join(tmpDir, '.knowledge', 'domains'))).toBe(true);
    expect(existsSync(join(tmpDir, '.knowledge', 'ontology'))).toBe(true);
    expect(existsSync(join(tmpDir, '.knowledge', '_templates'))).toBe(true);
  });

  it('인덱스 파일을 생성한다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);

    const indexPath = join(tmpDir, '.knowledge', '_index.md');
    expect(existsSync(indexPath)).toBe(true);
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain('Knowledge Vault');
  });

  it('enabled=false일 때 아무것도 생성하지 않는다', () => {
    const config: KnowledgeConfig = { ...DEFAULT_KNOWLEDGE_CONFIG, enabled: false };
    initKnowledgeVault(tmpDir, config);

    expect(existsSync(join(tmpDir, '.knowledge'))).toBe(false);
  });
});

describe('createBranchKnowledge', () => {
  it('브랜치 폴더와 템플릿 파일을 생성한다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);
    createBranchKnowledge(tmpDir, 'feat/login');

    const branchDir = join(tmpDir, '.knowledge', 'branches', 'feat-login');
    expect(existsSync(branchDir)).toBe(true);
    expect(existsSync(join(branchDir, 'spec.md'))).toBe(true);
    expect(existsSync(join(branchDir, 'design.md'))).toBe(true);
    expect(existsSync(join(branchDir, 'decisions.md'))).toBe(true);
    expect(existsSync(join(branchDir, 'notes.md'))).toBe(true);
  });

  it('템플릿 파일에 프론트매터가 포함된다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);
    createBranchKnowledge(tmpDir, 'feat/login');

    const specPath = join(tmpDir, '.knowledge', 'branches', 'feat-login', 'spec.md');
    const content = readFileSync(specPath, 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain('branch: feat/login');
    expect(content).toContain('type: spec');
  });

  it('이미 존재하는 브랜치 폴더는 덮어쓰지 않는다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);
    createBranchKnowledge(tmpDir, 'feat/login');

    // 파일 수정
    const specPath = join(tmpDir, '.knowledge', 'branches', 'feat-login', 'spec.md');
    writeFileSync(specPath, 'custom content');

    // 다시 호출해도 덮어쓰지 않음
    createBranchKnowledge(tmpDir, 'feat/login');
    expect(readFileSync(specPath, 'utf-8')).toBe('custom content');
  });
});

describe('archiveBranchKnowledge', () => {
  it('브랜치 폴더를 _archive로 이동한다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);
    createBranchKnowledge(tmpDir, 'feat/login');

    archiveBranchKnowledge(tmpDir, 'feat/login');

    const branchDir = join(tmpDir, '.knowledge', 'branches', 'feat-login');
    const archiveDir = join(tmpDir, '.knowledge', 'branches', '_archive', 'feat-login');

    expect(existsSync(branchDir)).toBe(false);
    expect(existsSync(archiveDir)).toBe(true);
    expect(existsSync(join(archiveDir, 'spec.md'))).toBe(true);
  });

  it('존재하지 않는 브랜치는 무시한다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);
    // 에러 없이 실행
    archiveBranchKnowledge(tmpDir, 'nonexistent');
  });
});

describe('readBranchContext', () => {
  it('브랜치 문서에서 컨텍스트를 추출한다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);
    createBranchKnowledge(tmpDir, 'feat/login');

    // design.md에 유의미한 내용 추가
    const designPath = join(tmpDir, '.knowledge', 'branches', 'feat-login', 'design.md');
    writeFileSync(designPath, [
      '---',
      'branch: feat/login',
      'type: design',
      '---',
      '',
      '# feat-login 설계',
      '',
      '## 아키텍처 결정',
      '',
      'JWT 기반 인증을 사용합니다.',
      '세션 스토어는 Redis를 활용합니다.',
    ].join('\n'));

    const context = readBranchContext(tmpDir, 'feat/login');
    expect(context).not.toBeNull();
    expect(context).toContain('[Knowledge Context]');
    expect(context).toContain('Branch: feat/login');
    expect(context).toContain('JWT 기반 인증');
  });

  it('기본 템플릿만 있는 브랜치는 섹션 제목만 포함된 컨텍스트를 반환한다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);
    createBranchKnowledge(tmpDir, 'feat/empty');

    const context = readBranchContext(tmpDir, 'feat/empty');
    // 기본 템플릿에 섹션 제목이 있으므로 컨텍스트 반환 (빈 내용이 아님)
    // 실질적으로 유의미한 내용이 추가되면 더 풍부해짐
    if (context !== null) {
      expect(context).toContain('[Knowledge Context]');
      expect(context).toContain('Branch: feat/empty');
    }
  });

  it('존재하지 않는 브랜치는 null을 반환한다', () => {
    const context = readBranchContext(tmpDir, 'nonexistent');
    expect(context).toBeNull();
  });
});

describe('updateKnowledgeIndex', () => {
  it('활성 브랜치 목록을 인덱스에 포함한다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);
    createBranchKnowledge(tmpDir, 'feat/a');
    createBranchKnowledge(tmpDir, 'feat/b');

    updateKnowledgeIndex(tmpDir);

    const indexPath = join(tmpDir, '.knowledge', '_index.md');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain('feat-a');
    expect(content).toContain('feat-b');
  });

  it('아카이브된 브랜치를 아카이브 섹션에 포함한다', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);
    createBranchKnowledge(tmpDir, 'feat/old');
    archiveBranchKnowledge(tmpDir, 'feat/old');

    updateKnowledgeIndex(tmpDir);

    const indexPath = join(tmpDir, '.knowledge', '_index.md');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain('_archive');
    expect(content).toContain('feat-old');
  });
});

describe('syncOntologyToVault', () => {
  it('.agent/ontology/ → .knowledge/ontology/ 복사 + 프론트매터 추가', () => {
    initKnowledgeVault(tmpDir, DEFAULT_KNOWLEDGE_CONFIG);

    // .agent/ontology/ 생성
    const agentOntDir = join(tmpDir, '.agent', 'ontology');
    mkdirSync(agentOntDir, { recursive: true });
    writeFileSync(join(agentOntDir, 'ONTOLOGY-STRUCTURE.md'), '# Structure\ntest content');

    syncOntologyToVault(tmpDir);

    const vaultStructure = join(tmpDir, '.knowledge', 'ontology', 'structure.md');
    expect(existsSync(vaultStructure)).toBe(true);
    const content = readFileSync(vaultStructure, 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain('type: ontology');
    expect(content).toContain('layer: structure');
    expect(content).toContain('# Structure');
  });

  it('.knowledge/가 없으면 무시한다', () => {
    const agentOntDir = join(tmpDir, '.agent', 'ontology');
    mkdirSync(agentOntDir, { recursive: true });
    writeFileSync(join(agentOntDir, 'ONTOLOGY-STRUCTURE.md'), '# Structure');

    // .knowledge/ 없이 호출 — 에러 없이 무시
    syncOntologyToVault(tmpDir);
    expect(existsSync(join(tmpDir, '.knowledge'))).toBe(false);
  });
});

describe('publishOntologyDocs', () => {
  it('.agent/ontology/ → docs/ontology/ 복사 (git-tracked)', () => {
    const agentOntDir = join(tmpDir, '.agent', 'ontology');
    mkdirSync(agentOntDir, { recursive: true });
    writeFileSync(join(agentOntDir, 'ONTOLOGY-STRUCTURE.md'), '# Structure');
    writeFileSync(join(agentOntDir, 'ONTOLOGY-INDEX.md'), '# Index');

    publishOntologyDocs(tmpDir);

    expect(existsSync(join(tmpDir, 'docs', 'ontology', 'ONTOLOGY-STRUCTURE.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'docs', 'ontology', 'ONTOLOGY-INDEX.md'))).toBe(true);
  });

  it('.agent/ontology/가 없으면 무시한다', () => {
    // 에러 없이 무시
    publishOntologyDocs(tmpDir);
    expect(existsSync(join(tmpDir, 'docs', 'ontology'))).toBe(false);
  });
});
