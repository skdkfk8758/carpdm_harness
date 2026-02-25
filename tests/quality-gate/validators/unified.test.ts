import { describe, it, expect } from 'vitest';
import { UnifiedValidator } from '../../../src/core/quality-gate/validators/unified.js';
import type { ValidationContext } from '../../../src/types/quality-gate.js';
import { resolve, join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '../../..');
const TEMP_DIR = join(ROOT, '.test-temp-unified');

function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    projectRoot: ROOT,
    targetFiles: [],
    config: { mode: 'warn' },
    ...overrides,
  };
}

describe('UnifiedValidator', () => {
  const validator = new UnifiedValidator();

  it('criterion이 unified이다', () => {
    expect(validator.criterion).toBe('unified');
  });

  it('빈 파일 목록에서 기본 결과를 반환한다', async () => {
    const result = await validator.validate(makeContext({ targetFiles: [] }));
    expect(result.criterion).toBe('unified');
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('임포트 순서가 올바른 파일을 통과시킨다', async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    const goodImportPath = join(TEMP_DIR, 'good-imports.ts');
    writeFileSync(goodImportPath, [
      "import { readFileSync } from 'node:fs';",
      "import { z } from 'zod';",
      "import { something } from '../utils/helper.js';",
      '',
      'export const x = 1;',
    ].join('\n'));

    try {
      const result = await validator.validate(makeContext({
        targetFiles: [goodImportPath],
      }));
      const importCheck = result.checks.find(c => c.name === '임포트 순서');
      expect(importCheck).toBeDefined();
      expect(importCheck!.passed).toBe(true);
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  it('임포트 순서가 잘못된 파일을 감지한다', async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    const badImportPath = join(TEMP_DIR, 'bad-imports.ts');
    writeFileSync(badImportPath, [
      "import { something } from '../utils/helper.js';",
      "import { readFileSync } from 'node:fs';",
      "import { z } from 'zod';",
      '',
      'export const x = 1;',
    ].join('\n'));

    try {
      const result = await validator.validate(makeContext({
        targetFiles: [badImportPath],
      }));
      const importCheck = result.checks.find(c => c.name === '임포트 순서');
      expect(importCheck).toBeDefined();
      expect(importCheck!.passed).toBe(false);
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  it('포맷터 미설치 시 graceful skip한다', async () => {
    const result = await validator.validate(makeContext({
      projectRoot: '/tmp/nonexistent-project-for-test',
      targetFiles: ['src/test.ts'],
    }));
    const formatCheck = result.checks.find(c => c.name === '포맷팅 일관성');
    expect(formatCheck).toBeDefined();
    expect(formatCheck!.severity).toBe('info');
  });

  it('score가 0-100 범위이다', async () => {
    const result = await validator.validate(makeContext());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
