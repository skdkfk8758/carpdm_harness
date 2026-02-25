import { describe, it, expect } from 'vitest';
import { TrackableValidator } from '../../../src/core/quality-gate/validators/trackable.js';
import type { ValidationContext } from '../../../src/types/quality-gate.js';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');

function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    projectRoot: ROOT,
    targetFiles: [],
    config: { mode: 'warn' },
    ...overrides,
  };
}

describe('TrackableValidator', () => {
  const validator = new TrackableValidator();

  it('criterion이 trackable이다', () => {
    expect(validator.criterion).toBe('trackable');
  });

  it('git 레포지토리에서 실행 시 커밋 메시지를 검증한다', async () => {
    const result = await validator.validate(makeContext());
    expect(result.criterion).toBe('trackable');
    // git repo이므로 커밋 메시지 검증 항목이 있어야 함
    const commitCheck = result.checks.find(c => c.name === '커밋 메시지 컨벤션');
    expect(commitCheck).toBeDefined();
  });

  it('브랜치 네이밍 검증이 포함된다', async () => {
    const result = await validator.validate(makeContext());
    const branchCheck = result.checks.find(c => c.name === '브랜치 네이밍');
    expect(branchCheck).toBeDefined();
  });

  it('이슈 참조 검증이 포함된다', async () => {
    const result = await validator.validate(makeContext());
    const issueCheck = result.checks.find(c => c.name === '이슈 참조');
    expect(issueCheck).toBeDefined();
  });

  it('변경 로그 검증이 포함된다', async () => {
    const result = await validator.validate(makeContext());
    const changeLogCheck = result.checks.find(c => c.name === '변경 로그');
    expect(changeLogCheck).toBeDefined();
  });

  it('score가 0-100 범위이다', async () => {
    const result = await validator.validate(makeContext());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
