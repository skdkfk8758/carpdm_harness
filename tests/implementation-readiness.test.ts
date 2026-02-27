import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkImplementationReadiness,
  getPlanStatus,
  getTodoStatus,
  hasImplementationIntent,
} from '../src/core/implementation-readiness.js';

describe('hasImplementationIntent', () => {
  it('should detect "implement the plan"', () => {
    expect(hasImplementationIntent('implement the plan')).toBe(true);
  });

  it('should detect "implement the following plan"', () => {
    expect(hasImplementationIntent('implement the following plan')).toBe(true);
  });

  it('should detect "execute the plan"', () => {
    expect(hasImplementationIntent('execute the plan')).toBe(true);
  });

  it('should detect Korean "계획을 구현"', () => {
    expect(hasImplementationIntent('계획을 구현해주세요')).toBe(true);
  });

  it('should detect Korean "플랜대로"', () => {
    expect(hasImplementationIntent('플랜대로 진행해주세요')).toBe(true);
  });

  it('should detect "plan 실행"', () => {
    expect(hasImplementationIntent('plan을 실행해줘')).toBe(true);
  });

  it('should not detect unrelated prompts', () => {
    expect(hasImplementationIntent('fix the bug in login')).toBe(false);
    expect(hasImplementationIntent('add a new feature')).toBe(false);
    expect(hasImplementationIntent('refactor the module')).toBe(false);
  });
});

describe('getPlanStatus', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'readiness-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return NONE when no plan.md exists', () => {
    expect(getPlanStatus(testDir)).toBe('NONE');
  });

  it('should return DRAFT when plan.md contains DRAFT', () => {
    writeFileSync(join(testDir, 'plan.md'), '# Plan\n상태: DRAFT\n내용...');
    expect(getPlanStatus(testDir)).toBe('DRAFT');
  });

  it('should return APPROVED when plan.md contains APPROVED', () => {
    writeFileSync(join(testDir, 'plan.md'), '# Plan\n상태: APPROVED\n내용...');
    expect(getPlanStatus(testDir)).toBe('APPROVED');
  });

  it('should return EXISTS when plan.md has no status marker', () => {
    writeFileSync(join(testDir, 'plan.md'), '# Plan\n내용만 있음');
    expect(getPlanStatus(testDir)).toBe('EXISTS');
  });

  it('should prefer .agent/plan.md over root plan.md', () => {
    mkdirSync(join(testDir, '.agent'), { recursive: true });
    writeFileSync(join(testDir, '.agent', 'plan.md'), '# Plan\n상태: APPROVED');
    writeFileSync(join(testDir, 'plan.md'), '# Plan\n상태: DRAFT');
    expect(getPlanStatus(testDir)).toBe('APPROVED');
  });
});

describe('getTodoStatus', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'readiness-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return exists=false when no todo.md', () => {
    const status = getTodoStatus(testDir);
    expect(status.exists).toBe(false);
  });

  it('should count done and remaining items', () => {
    writeFileSync(join(testDir, 'todo.md'), '- [x] Done 1\n- [x] Done 2\n- [ ] Todo 1\n- [ ] Todo 2');
    const status = getTodoStatus(testDir);
    expect(status.exists).toBe(true);
    expect(status.doneCount).toBe(2);
    expect(status.totalCount).toBe(4);
    expect(status.allDone).toBe(false);
  });

  it('should detect all done', () => {
    writeFileSync(join(testDir, 'todo.md'), '- [x] Done 1\n- [x] Done 2\n- [X] Done 3');
    const status = getTodoStatus(testDir);
    expect(status.allDone).toBe(true);
    expect(status.doneCount).toBe(3);
    expect(status.totalCount).toBe(3);
  });

  it('should treat empty todo (no checkboxes) as exists but not allDone', () => {
    writeFileSync(join(testDir, 'todo.md'), '# Todo\n아직 항목 없음');
    const status = getTodoStatus(testDir);
    expect(status.exists).toBe(true);
    expect(status.allDone).toBe(false);
    expect(status.totalCount).toBe(0);
  });
});

describe('checkImplementationReadiness', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'readiness-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should force plan-gate when no plan.md exists', () => {
    writeFileSync(join(testDir, 'carpdm-harness.config.json'), '{}');
    const result = checkImplementationReadiness('implement the plan', testDir);
    expect(result.status).toBe('force-plan-gate');
  });

  it('should warn when plan.md is DRAFT', () => {
    writeFileSync(join(testDir, 'carpdm-harness.config.json'), '{}');
    writeFileSync(join(testDir, 'plan.md'), '# Plan\n상태: DRAFT');
    const result = checkImplementationReadiness('implement the plan', testDir);
    expect(result.status).toBe('plan-not-approved');
    expect(result.message).toContain('PLAN NOT APPROVED');
  });

  it('should require todo.md when plan is APPROVED', () => {
    writeFileSync(join(testDir, 'carpdm-harness.config.json'), '{}');
    writeFileSync(join(testDir, 'plan.md'), '# Plan\n상태: APPROVED');
    const result = checkImplementationReadiness('implement the plan', testDir);
    expect(result.status).toBe('todo-required');
    expect(result.message).toContain('TODO REQUIRED');
  });

  it('should detect stale todo.md (all items done)', () => {
    writeFileSync(join(testDir, 'carpdm-harness.config.json'), '{}');
    writeFileSync(join(testDir, 'plan.md'), '# Plan\n상태: APPROVED');
    writeFileSync(join(testDir, 'todo.md'), '- [x] Done 1\n- [x] Done 2');
    const result = checkImplementationReadiness('implement the plan', testDir);
    expect(result.status).toBe('todo-stale');
    expect(result.message).toContain('TODO STALE');
  });

  it('should pass when plan and active todo exist', () => {
    writeFileSync(join(testDir, 'carpdm-harness.config.json'), '{}');
    writeFileSync(join(testDir, 'plan.md'), '# Plan\n상태: APPROVED');
    writeFileSync(join(testDir, 'todo.md'), '- [x] Done 1\n- [ ] Todo 1');
    const result = checkImplementationReadiness('implement the plan', testDir);
    expect(result.status).toBe('pass');
  });

  it('should skip when carpdm-harness.config.json not found', () => {
    const result = checkImplementationReadiness('implement the plan', testDir);
    expect(result.status).toBe('pass');
  });

  it('should skip when no implementation intent detected', () => {
    writeFileSync(join(testDir, 'carpdm-harness.config.json'), '{}');
    const result = checkImplementationReadiness('fix the bug in login', testDir);
    expect(result.status).toBe('pass');
  });

  it('should not trigger on code block content (pre-sanitized)', () => {
    writeFileSync(join(testDir, 'carpdm-harness.config.json'), '{}');
    // 프롬프트가 sanitizeForKeywordDetection()을 거친 후 전달되므로
    // 코드블록 내용이 제거된 상태를 시뮬레이션
    const sanitizedPrompt = 'fix this function'; // 코드블록 제거 후 남은 텍스트
    const result = checkImplementationReadiness(sanitizedPrompt, testDir);
    expect(result.status).toBe('pass');
  });
});
