import { describe, it, expect } from 'vitest';
import { TestedValidator } from '../../../src/core/quality-gate/validators/tested.js';
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

describe('TestedValidator', () => {
  const validator = new TestedValidator();

  it('criterion이 tested이다', () => {
    expect(validator.criterion).toBe('tested');
  });

  it('빈 파일 목록으로 실행 시 기본 통과한다', async () => {
    const result = await validator.validate(makeContext({ targetFiles: [] }));
    expect(result.criterion).toBe('tested');
    expect(result.passed).toBe(true);
  });

  it('테스트 파일이 있는 소스 파일을 감지한다', async () => {
    // src/server.ts는 테스트가 없을 수 있으므로, 실제 프로젝트 구조 기반으로 검증
    const result = await validator.validate(makeContext({
      targetFiles: ['src/server.ts'],
    }));
    expect(result.criterion).toBe('tested');
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('package.json의 test 스크립트를 감지한다', async () => {
    const result = await validator.validate(makeContext({
      targetFiles: ['src/server.ts'],
    }));
    const testCmdCheck = result.checks.find(c => c.name === '테스트 명령어');
    expect(testCmdCheck).toBeDefined();
    // 이 프로젝트에는 vitest가 있으므로 test script가 존재해야 함
    expect(testCmdCheck!.passed).toBe(true);
  });

  it('설정 파일은 소스 파일로 취급하지 않는다', async () => {
    const result = await validator.validate(makeContext({
      targetFiles: ['tsup.config.ts', 'package.json'],
    }));
    // .config. 파일과 .json 파일은 소스 파일이 아니므로 테스트 파일 존재 체크 안 함
    const testFileChecks = result.checks.filter(c => c.name === '테스트 파일 존재');
    expect(testFileChecks.length).toBe(0);
  });
});
