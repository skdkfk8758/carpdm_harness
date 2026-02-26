import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadGitignorePatterns,
  mergeExcludePatterns,
  buildStructureLayer,
} from '../src/core/ontology/structure-builder.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../src/types/ontology.js';

// ── loadGitignorePatterns ──

describe('loadGitignorePatterns', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-gitignore-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return empty array when .gitignore does not exist', () => {
    expect(loadGitignorePatterns(testDir)).toEqual([]);
  });

  it('should return empty array for empty .gitignore', () => {
    writeFileSync(join(testDir, '.gitignore'), '');
    expect(loadGitignorePatterns(testDir)).toEqual([]);
  });

  it('should extract simple directory names', () => {
    writeFileSync(join(testDir, '.gitignore'), '.venv\nnode_modules\n__pycache__\n');
    const result = loadGitignorePatterns(testDir);
    expect(result).toContain('.venv');
    expect(result).toContain('node_modules');
    expect(result).toContain('__pycache__');
  });

  it('should strip trailing slash from directory markers', () => {
    writeFileSync(join(testDir, '.gitignore'), '.venv/\ndist/\n');
    const result = loadGitignorePatterns(testDir);
    expect(result).toContain('.venv');
    expect(result).toContain('dist');
  });

  it('should skip comments and empty lines', () => {
    writeFileSync(join(testDir, '.gitignore'), '# comment\n\n.venv\n  \n');
    const result = loadGitignorePatterns(testDir);
    expect(result).toEqual(['.venv']);
  });

  it('should skip negation patterns', () => {
    writeFileSync(join(testDir, '.gitignore'), '.venv\n!important\n');
    const result = loadGitignorePatterns(testDir);
    expect(result).toEqual(['.venv']);
    expect(result).not.toContain('important');
  });

  it('should skip glob patterns', () => {
    writeFileSync(join(testDir, '.gitignore'), '*.pyc\nlog?\n[Bb]uild\n.venv\n');
    const result = loadGitignorePatterns(testDir);
    expect(result).toEqual(['.venv']);
  });

  it('should skip path patterns with slashes', () => {
    writeFileSync(join(testDir, '.gitignore'), 'src/dist\n/root-only\n.venv\n');
    const result = loadGitignorePatterns(testDir);
    expect(result).toEqual(['.venv']);
  });
});

// ── mergeExcludePatterns ──

describe('mergeExcludePatterns', () => {
  it('should merge multiple sources and deduplicate', () => {
    const result = mergeExcludePatterns(
      ['node_modules', '.git', 'dist'],
      ['dist', '.venv', '__pycache__'],
    );
    expect(result).toHaveLength(5);
    expect(result).toContain('node_modules');
    expect(result).toContain('.venv');
    expect(result).toContain('__pycache__');
  });

  it('should handle empty arrays', () => {
    const result = mergeExcludePatterns([], ['dist']);
    expect(result).toEqual(['dist']);
  });

  it('should handle all empty arrays', () => {
    const result = mergeExcludePatterns([], []);
    expect(result).toEqual([]);
  });
});

// ── buildStructureLayer .gitignore 통합 ──

describe('buildStructureLayer with .gitignore', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-structure-'));
    // 프로젝트 구조 생성
    mkdirSync(join(testDir, 'src'));
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export const x = 1;');
    mkdirSync(join(testDir, '.venv'));
    writeFileSync(join(testDir, '.venv', 'pyvenv.cfg'), 'home = /usr/bin');
    mkdirSync(join(testDir, '__pycache__'));
    writeFileSync(join(testDir, '__pycache__', 'mod.cpython-311.pyc'), 'binary');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should exclude .venv via .gitignore even without explicit excludePatterns', () => {
    writeFileSync(join(testDir, '.gitignore'), '.venv\n__pycache__\n');

    const config = { enabled: true, maxDepth: 5, excludePatterns: ['.git'] };
    const layer = buildStructureLayer(testDir, config);

    const childNames = layer.tree.children?.map((c) => c.name) ?? [];
    expect(childNames).toContain('src');
    expect(childNames).not.toContain('.venv');
    expect(childNames).not.toContain('__pycache__');
  });

  it('should merge .gitignore patterns with config excludePatterns', () => {
    writeFileSync(join(testDir, '.gitignore'), '.venv\n');

    const config = { enabled: true, maxDepth: 5, excludePatterns: ['__pycache__'] };
    const layer = buildStructureLayer(testDir, config);

    const childNames = layer.tree.children?.map((c) => c.name) ?? [];
    expect(childNames).toContain('src');
    expect(childNames).not.toContain('.venv');
    expect(childNames).not.toContain('__pycache__');
  });

  it('should work without .gitignore', () => {
    // .gitignore 없음 — excludePatterns만 사용
    const config = { enabled: true, maxDepth: 5, excludePatterns: ['.venv', '__pycache__'] };
    const layer = buildStructureLayer(testDir, config);

    const childNames = layer.tree.children?.map((c) => c.name) ?? [];
    expect(childNames).toContain('src');
    expect(childNames).not.toContain('.venv');
    expect(childNames).not.toContain('__pycache__');
  });
});

// ── DEFAULT_ONTOLOGY_CONFIG 패턴 확장 검증 ──

describe('DEFAULT_ONTOLOGY_CONFIG excludePatterns', () => {
  const patterns = DEFAULT_ONTOLOGY_CONFIG.layers.structure.excludePatterns;

  it('should include Python-specific patterns', () => {
    expect(patterns).toContain('.venv');
    expect(patterns).toContain('venv');
    expect(patterns).toContain('__pycache__');
    expect(patterns).toContain('.mypy_cache');
    expect(patterns).toContain('.pytest_cache');
  });

  it('should include Java/Kotlin patterns', () => {
    expect(patterns).toContain('target');
    expect(patterns).toContain('.gradle');
  });

  it('should include core patterns', () => {
    expect(patterns).toContain('node_modules');
    expect(patterns).toContain('.git');
    expect(patterns).toContain('dist');
    expect(patterns).toContain('build');
    expect(patterns).toContain('coverage');
  });

  it('should include agent/tool patterns', () => {
    expect(patterns).toContain('.omc');
    expect(patterns).toContain('.serena');
    expect(patterns).toContain('.agent');
    expect(patterns).toContain('.harness');
  });
});
