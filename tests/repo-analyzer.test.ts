import { describe, it, expect } from 'vitest';
import {
  parseRepoUrl,
  compareDeps,
  calculateIntegrationScore,
  detectStructure,
  detectPatterns,
} from '../src/core/repo-analyzer.js';
import type { RepoInfo, RepoPackageJson, RepoStructure } from '../src/types/repo-analyzer.js';

describe('parseRepoUrl', () => {
  it('should parse owner/repo shorthand', () => {
    const result = parseRepoUrl('facebook/react');
    expect(result).toEqual({
      owner: 'facebook',
      repo: 'react',
      fullName: 'facebook/react',
      hosting: 'github',
    });
  });

  it('should parse full GitHub URL', () => {
    const result = parseRepoUrl('https://github.com/vercel/next.js');
    expect(result).toEqual({
      owner: 'vercel',
      repo: 'next.js',
      fullName: 'vercel/next.js',
      hosting: 'github',
    });
  });

  it('should parse GitHub URL with trailing slash', () => {
    const result = parseRepoUrl('https://github.com/vercel/next.js/');
    expect(result).toEqual({
      owner: 'vercel',
      repo: 'next.js',
      fullName: 'vercel/next.js',
      hosting: 'github',
    });
  });

  it('should parse GitHub URL with .git suffix', () => {
    const result = parseRepoUrl('https://github.com/vercel/next.js.git');
    expect(result).toEqual({
      owner: 'vercel',
      repo: 'next.js',
      fullName: 'vercel/next.js',
      hosting: 'github',
    });
  });

  it('should parse github.com URL with http scheme', () => {
    const result = parseRepoUrl('http://github.com/owner/repo');
    expect(result.hosting).toBe('github');
    expect(result.fullName).toBe('owner/repo');
  });

  it('should detect GitLab hosting', () => {
    const result = parseRepoUrl('https://gitlab.com/owner/repo');
    expect(result.hosting).toBe('gitlab');
  });

  it('should detect Bitbucket hosting', () => {
    const result = parseRepoUrl('https://bitbucket.org/owner/repo');
    expect(result.hosting).toBe('bitbucket');
  });

  it('should return null for invalid input', () => {
    expect(parseRepoUrl('')).toBeNull();
    expect(parseRepoUrl('not-valid')).toBeNull();
    expect(parseRepoUrl('https://example.com')).toBeNull();
  });

  it('should handle URL with extra path segments', () => {
    const result = parseRepoUrl('https://github.com/owner/repo/tree/main/src');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      fullName: 'owner/repo',
      hosting: 'github',
    });
  });
});

describe('compareDeps', () => {
  it('should identify shared dependencies with same version', () => {
    const targetDeps = { zod: '^3.25.0', typescript: '^5.9.0' };
    const localDeps = { zod: '^3.25.0', vitest: '^3.2.0' };
    const result = compareDeps(targetDeps, localDeps);

    const zodEntry = result.shared.find((d) => d.name === 'zod');
    expect(zodEntry).toBeDefined();
    expect(zodEntry!.status).toBe('same');
  });

  it('should detect compatible versions (same major)', () => {
    const targetDeps = { zod: '^3.20.0' };
    const localDeps = { zod: '^3.25.0' };
    const result = compareDeps(targetDeps, localDeps);

    const zodEntry = result.shared.find((d) => d.name === 'zod');
    expect(zodEntry!.status).toBe('compatible');
  });

  it('should detect incompatible versions (different major)', () => {
    const targetDeps = { zod: '^4.0.0' };
    const localDeps = { zod: '^3.25.0' };
    const result = compareDeps(targetDeps, localDeps);

    const zodEntry = result.shared.find((d) => d.name === 'zod');
    expect(zodEntry!.status).toBe('incompatible');
    expect(result.incompatibleCount).toBe(1);
  });

  it('should list dependencies only in target', () => {
    const targetDeps = { lodash: '^4.0.0' };
    const localDeps = { zod: '^3.25.0' };
    const result = compareDeps(targetDeps, localDeps);

    expect(result.onlyInTarget).toContain('lodash');
  });

  it('should list dependencies only in local', () => {
    const targetDeps = { lodash: '^4.0.0' };
    const localDeps = { zod: '^3.25.0' };
    const result = compareDeps(targetDeps, localDeps);

    expect(result.onlyInLocal).toContain('zod');
  });

  it('should handle empty dependencies gracefully', () => {
    const result = compareDeps({}, {});
    expect(result.shared).toEqual([]);
    expect(result.onlyInTarget).toEqual([]);
    expect(result.onlyInLocal).toEqual([]);
    expect(result.conflictCount).toBe(0);
  });

  it('should count total conflicts (incompatible)', () => {
    const targetDeps = { a: '^2.0.0', b: '^3.0.0', c: '^1.0.0' };
    const localDeps = { a: '^1.0.0', b: '^3.5.0', c: '^1.2.0' };
    const result = compareDeps(targetDeps, localDeps);

    // a: incompatible (major 2 vs 1), b: compatible (same major 3), c: compatible (same major 1)
    expect(result.incompatibleCount).toBe(1);
  });
});

describe('calculateIntegrationScore', () => {
  const baseRepoInfo: RepoInfo = {
    fullName: 'test/repo',
    description: 'Test',
    language: 'TypeScript',
    languages: { TypeScript: 80, JavaScript: 20 },
    stars: 100,
    forks: 10,
    openIssues: 5,
    license: 'MIT',
    defaultBranch: 'main',
    isArchived: false,
    isFork: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    pushedAt: '2024-06-01T00:00:00Z',
    size: 1000,
    topics: [],
  };

  const baseStructure: RepoStructure = {
    hasPackageJson: true,
    hasTsConfig: true,
    hasTests: true,
    hasCi: true,
    hasDockerfile: false,
    moduleSystem: 'esm',
    entryDirs: ['src'],
    configFiles: ['tsconfig.json'],
  };

  it('should start with base score of 50', () => {
    const result = calculateIntegrationScore(
      { ...baseRepoInfo, language: null, languages: {} },
      { ...baseStructure, moduleSystem: 'unknown' },
      null,
    );
    expect(result.score).toBe(50);
  });

  it('should add +15 for same language (TypeScript)', () => {
    const result = calculateIntegrationScore(baseRepoInfo, baseStructure, null);
    const langFactor = result.factors.find((f) => f.name === 'language');
    expect(langFactor).toBeDefined();
    expect(langFactor!.impact).toBeGreaterThan(0);
  });

  it('should add +5 for ESM module system', () => {
    const result = calculateIntegrationScore(baseRepoInfo, baseStructure, null);
    const esmFactor = result.factors.find((f) => f.name === 'module-system');
    expect(esmFactor).toBeDefined();
    expect(esmFactor!.impact).toBe(5);
  });

  it('should subtract -5 for CJS module system', () => {
    const result = calculateIntegrationScore(
      baseRepoInfo,
      { ...baseStructure, moduleSystem: 'cjs' },
      null,
    );
    const cjsFactor = result.factors.find((f) => f.name === 'module-system');
    expect(cjsFactor!.impact).toBe(-5);
  });

  it('should subtract -10 for archived repo', () => {
    const result = calculateIntegrationScore(
      { ...baseRepoInfo, isArchived: true },
      baseStructure,
      null,
    );
    const archivedFactor = result.factors.find((f) => f.name === 'archived');
    expect(archivedFactor).toBeDefined();
    expect(archivedFactor!.impact).toBe(-10);
  });

  it('should add +10 for zero dependency conflicts', () => {
    const depComparison = {
      shared: [],
      onlyInTarget: [],
      onlyInLocal: [],
      conflictCount: 0,
      incompatibleCount: 0,
    };
    const result = calculateIntegrationScore(baseRepoInfo, baseStructure, depComparison);
    const depFactor = result.factors.find((f) => f.name === 'dep-conflicts');
    expect(depFactor!.impact).toBe(10);
  });

  it('should subtract -5 per incompatible dependency', () => {
    const depComparison = {
      shared: [],
      onlyInTarget: [],
      onlyInLocal: [],
      conflictCount: 3,
      incompatibleCount: 3,
    };
    const result = calculateIntegrationScore(baseRepoInfo, baseStructure, depComparison);
    const depFactor = result.factors.find((f) => f.name === 'dep-conflicts');
    expect(depFactor!.impact).toBe(-15); // 3 * -5
  });

  it('should classify score >= 75 as easy', () => {
    // TypeScript (+15) + ESM (+5) + no conflicts (+10) = 50 + 30 = 80
    const depComparison = {
      shared: [],
      onlyInTarget: [],
      onlyInLocal: [],
      conflictCount: 0,
      incompatibleCount: 0,
    };
    const result = calculateIntegrationScore(baseRepoInfo, baseStructure, depComparison);
    expect(result.level).toBe('easy');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('should classify score 50-74 as moderate', () => {
    const result = calculateIntegrationScore(
      { ...baseRepoInfo, language: null, languages: {} },
      { ...baseStructure, moduleSystem: 'unknown' },
      null,
    );
    expect(result.level).toBe('moderate');
  });

  it('should classify score 25-49 as hard', () => {
    // Rust(-20) + 1 conflict(-5) = 50 - 25 = 25 → hard
    const result = calculateIntegrationScore(
      { ...baseRepoInfo, language: 'Rust', languages: { Rust: 100 } },
      { ...baseStructure, moduleSystem: 'unknown' },
      { shared: [], onlyInTarget: [], onlyInLocal: [], conflictCount: 1, incompatibleCount: 1 },
    );
    expect(result.level).toBe('hard');
  });

  it('should clamp score between 0 and 100', () => {
    // Lots of negatives
    const result = calculateIntegrationScore(
      { ...baseRepoInfo, language: 'Rust', languages: { Rust: 100 }, isArchived: true },
      { ...baseStructure, moduleSystem: 'cjs' },
      { shared: [], onlyInTarget: [], onlyInLocal: [], conflictCount: 10, incompatibleCount: 10 },
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('detectStructure', () => {
  it('should detect ESM from package.json type field', () => {
    const pkg: RepoPackageJson = { type: 'module' };
    const files = ['src/index.ts', 'tsconfig.json', 'package.json'];
    const result = detectStructure(pkg, files);
    expect(result.moduleSystem).toBe('esm');
    expect(result.hasPackageJson).toBe(true);
    expect(result.hasTsConfig).toBe(true);
  });

  it('should detect CJS from package.json type field', () => {
    const pkg: RepoPackageJson = { type: 'commonjs' };
    const result = detectStructure(pkg, ['package.json']);
    expect(result.moduleSystem).toBe('cjs');
  });

  it('should detect CI from .github/workflows path', () => {
    const result = detectStructure(null, ['.github/workflows/ci.yml']);
    expect(result.hasCi).toBe(true);
  });

  it('should detect tests directory', () => {
    const result = detectStructure(null, ['tests/unit.test.ts', '__tests__/foo.ts']);
    expect(result.hasTests).toBe(true);
  });

  it('should detect Dockerfile', () => {
    const result = detectStructure(null, ['Dockerfile']);
    expect(result.hasDockerfile).toBe(true);
  });

  it('should detect entry directories', () => {
    const result = detectStructure(null, ['src/index.ts', 'lib/utils.ts', 'app/main.ts']);
    expect(result.entryDirs).toContain('src');
    expect(result.entryDirs).toContain('lib');
    expect(result.entryDirs).toContain('app');
  });
});

describe('detectPatterns', () => {
  it('should detect build tools from config files', () => {
    const files = ['tsup.config.ts', 'vite.config.ts'];
    const pkg: RepoPackageJson = { devDependencies: { tsup: '^8.0.0', vite: '^5.0.0' } };
    const result = detectPatterns(pkg, files);
    expect(result.buildTools).toContain('tsup');
    expect(result.buildTools).toContain('vite');
  });

  it('should detect test frameworks', () => {
    const pkg: RepoPackageJson = { devDependencies: { vitest: '^3.0.0' } };
    const result = detectPatterns(pkg, []);
    expect(result.testFrameworks).toContain('vitest');
  });

  it('should detect conventions from config files', () => {
    const files = ['.eslintrc.js', '.prettierrc'];
    const result = detectPatterns(null, files);
    expect(result.conventions).toContain('eslint');
    expect(result.conventions).toContain('prettier');
  });

  it('should detect monorepo architecture', () => {
    const files = ['packages/a/package.json', 'packages/b/package.json', 'lerna.json'];
    const pkg: RepoPackageJson = { devDependencies: { lerna: '^7.0.0' } };
    const result = detectPatterns(pkg, files);
    expect(result.architecture).toContain('monorepo');
  });

  it('should handle null package.json', () => {
    const result = detectPatterns(null, []);
    expect(result.buildTools).toEqual([]);
    expect(result.testFrameworks).toEqual([]);
  });
});
