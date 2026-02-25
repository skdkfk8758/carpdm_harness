import { describe, it, expect } from 'vitest';
import { SecuredValidator } from '../../../src/core/quality-gate/validators/secured.js';
import type { ValidationContext } from '../../../src/types/quality-gate.js';
import { resolve, join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '../../..');
const TEMP_DIR = join(ROOT, '.test-temp-secured');

function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    projectRoot: ROOT,
    targetFiles: [],
    config: { mode: 'warn' },
    ...overrides,
  };
}

describe('SecuredValidator', () => {
  const validator = new SecuredValidator();

  it('criterion이 secured이다', () => {
    expect(validator.criterion).toBe('secured');
  });

  it('시크릿이 없는 코드는 passed=true이다', async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    const safePath = join(TEMP_DIR, 'safe.ts');
    writeFileSync(safePath, 'const greeting = "hello world";\nexport default greeting;\n');

    try {
      const result = await validator.validate(makeContext({
        targetFiles: [safePath],
      }));
      const secretCheck = result.checks.find(c => c.name === '시크릿 스캔');
      expect(secretCheck).toBeDefined();
      expect(secretCheck!.passed).toBe(true);
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  it('API 키 패턴을 감지한다', async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    const unsafePath = join(TEMP_DIR, 'unsafe.ts');
    const fakeKey = ['sk', 'live', 'abcdef1234567890abcdef1234'].join('_');
    writeFileSync(unsafePath, `const api_key = "${fakeKey}";\n`);

    try {
      const result = await validator.validate(makeContext({
        targetFiles: [unsafePath],
      }));
      const secretCheck = result.checks.find(c => c.name === '시크릿 스캔');
      expect(secretCheck).toBeDefined();
      expect(secretCheck!.passed).toBe(false);
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  it('eval() 사용을 감지한다', async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    const evalPath = join(TEMP_DIR, 'eval-usage.ts');
    writeFileSync(evalPath, 'const userInput = "alert(1)";\nconst result = eval(userInput);\n');

    try {
      const result = await validator.validate(makeContext({
        targetFiles: [evalPath],
      }));
      const evalCheck = result.checks.find(c => c.name === 'eval/exec 사용');
      expect(evalCheck).toBeDefined();
      expect(evalCheck!.passed).toBe(false);
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  it('SQL 인젝션 패턴을 감지한다', async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    const sqlPath = join(TEMP_DIR, 'sql-inject.ts');
    writeFileSync(sqlPath, 'const query = "SELECT * FROM users WHERE id = " + userId;\n');

    try {
      const result = await validator.validate(makeContext({
        targetFiles: [sqlPath],
      }));
      const sqlCheck = result.checks.find(c => c.name === 'SQL 인젝션');
      expect(sqlCheck).toBeDefined();
      expect(sqlCheck!.passed).toBe(false);
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  it('빈 파일 목록에서 기본 통과한다', async () => {
    const result = await validator.validate(makeContext({ targetFiles: [] }));
    expect(result.criterion).toBe('secured');
    // error 심각도 항목 중 실패 없으면 passed
    const errorChecks = result.checks.filter(c => c.severity === 'error');
    const allErrorsPassed = errorChecks.every(c => c.passed);
    expect(allErrorsPassed).toBe(true);
  });
});
