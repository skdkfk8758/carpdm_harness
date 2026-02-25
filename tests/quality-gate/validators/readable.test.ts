import { describe, it, expect } from 'vitest';
import { ReadableValidator } from '../../../src/core/quality-gate/validators/readable.js';
import type { ValidationContext } from '../../../src/types/quality-gate.js';
import { resolve, join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '../../..');
const TEMP_DIR = join(ROOT, '.test-temp-readable');

function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    projectRoot: ROOT,
    targetFiles: [],
    config: { mode: 'warn' },
    ...overrides,
  };
}

describe('ReadableValidator', () => {
  const validator = new ReadableValidator();

  it('criterion이 readable이다', () => {
    expect(validator.criterion).toBe('readable');
  });

  it('빈 파일 목록에서 기본 결과를 반환한다', async () => {
    const result = await validator.validate(makeContext({ targetFiles: [] }));
    expect(result.criterion).toBe('readable');
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('300줄 초과 파일에 경고를 생성한다', async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    const longFilePath = join(TEMP_DIR, 'long-file.ts');
    const lines = Array.from({ length: 350 }, (_, i) => `const line${i} = ${i};`);
    writeFileSync(longFilePath, lines.join('\n'));

    try {
      const result = await validator.validate(makeContext({
        targetFiles: [longFilePath],
      }));
      const lengthCheck = result.checks.find(c => c.name === '파일 길이');
      expect(lengthCheck).toBeDefined();
      expect(lengthCheck!.passed).toBe(false);
      expect(lengthCheck!.message).toContain('300줄 초과');
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  it('TODO/FIXME 주석 마커를 카운트한다', async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    const todoPath = join(TEMP_DIR, 'todo-file.ts');
    writeFileSync(todoPath, '// TODO: fix this\n// FIXME: broken\n// HACK: workaround\nconst x = 1;\n');

    try {
      const result = await validator.validate(makeContext({
        targetFiles: [todoPath],
      }));
      const todoCheck = result.checks.find(c => c.name === 'TODO/FIXME/HACK');
      expect(todoCheck).toBeDefined();
      expect(todoCheck!.passed).toBe(false);
      expect(todoCheck!.message).toContain('3개');
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  it('린트 도구 미설치 시 graceful skip한다', async () => {
    // 존재하지 않는 projectRoot로 테스트
    const result = await validator.validate(makeContext({
      projectRoot: '/tmp/nonexistent-project-for-test',
      targetFiles: ['src/test.ts'],
    }));
    const lintCheck = result.checks.find(c => c.name === '린트 검사');
    expect(lintCheck).toBeDefined();
    // 린트 도구 미설치이므로 info 심각도
    expect(lintCheck!.severity).toBe('info');
  });

  it('score가 0-100 범위이다', async () => {
    const result = await validator.validate(makeContext());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
