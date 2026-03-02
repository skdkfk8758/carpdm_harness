import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WorkflowInstance, WorkflowContext } from '../src/types/workflow-engine.js';
import {
  generatePlanFromWorkflow,
  generateTodoFromWorkflow,
  syncTodoProgress,
  initKnowledgeBranch,
} from '../src/core/workflow-agent-sync.js';

function makeInstance(overrides?: Partial<WorkflowInstance>): WorkflowInstance {
  return {
    id: 'feature-20260302-abc1',
    workflowType: 'feature',
    status: 'running',
    currentStep: 1,
    totalSteps: 3,
    context: { description: '로그인 기능 구현' },
    steps: [
      { order: 1, agent: 'analyst', action: '요구사항 분석', status: 'running' },
      { order: 2, agent: 'planner', action: '구현 계획 수립', status: 'pending', checkpoint: '계획 승인' },
      { order: 3, agent: 'executor', action: '구현', status: 'pending' },
    ],
    config: {
      guardLevel: 'warn',
      autoAdvance: false,
      autoDispatch: false,
      syncToOmc: false,
      maxRetries: 3,
      historyEnabled: true,
    },
    createdAt: '2026-03-02T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z',
    ...overrides,
  };
}

// ─── generatePlanFromWorkflow ───

describe('generatePlanFromWorkflow', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'sync-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should .agent/plan.md를 DRAFT 상태로 생성한다', () => {
    const instance = makeInstance();
    const result = generatePlanFromWorkflow(testDir, instance, { description: '로그인 기능' });

    expect(result.created).toBe(true);
    const content = readFileSync(join(testDir, '.agent', 'plan.md'), 'utf-8');
    expect(content).toContain('DRAFT');
    expect(content).toContain('로그인 기능');
    expect(content).toContain('feature');
  });

  it('should 워크플로우 파이프라인 단계를 포함한다', () => {
    const instance = makeInstance();
    const result = generatePlanFromWorkflow(testDir, instance);

    expect(result.created).toBe(true);
    const content = readFileSync(result.path, 'utf-8');
    expect(content).toContain('analyst');
    expect(content).toContain('요구사항 분석');
    expect(content).toContain('analyst');
    expect(content).toContain('요구사항 분석');
  });

  it('should 이미 plan.md가 있으면 덮어쓰지 않는다', () => {
    mkdirSync(join(testDir, '.agent'), { recursive: true });
    writeFileSync(join(testDir, '.agent', 'plan.md'), '# 기존 계획\n상태: APPROVED');

    const result = generatePlanFromWorkflow(testDir, makeInstance());

    expect(result.created).toBe(false);
    const content = readFileSync(join(testDir, '.agent', 'plan.md'), 'utf-8');
    expect(content).toContain('기존 계획');
    expect(content).toContain('APPROVED');
  });

  it('should .agent/ 디렉토리가 없어도 자동 생성한다', () => {
    const result = generatePlanFromWorkflow(testDir, makeInstance());

    expect(result.created).toBe(true);
    expect(existsSync(join(testDir, '.agent', 'plan.md'))).toBe(true);
  });
});

// ─── generateTodoFromWorkflow ───

describe('generateTodoFromWorkflow', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'sync-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should .agent/todo.md를 파이프라인 기반으로 생성한다', () => {
    const result = generateTodoFromWorkflow(testDir, makeInstance());

    expect(result.created).toBe(true);
    const content = readFileSync(join(testDir, '.agent', 'todo.md'), 'utf-8');
    expect(content).toContain('Step 1: analyst');
    expect(content).toContain('Step 2: planner');
    expect(content).toContain('Step 3: executor');
  });

  it('should 첫 번째 단계에 ← CURRENT 마커를 추가한다', () => {
    generateTodoFromWorkflow(testDir, makeInstance());
    const content = readFileSync(join(testDir, '.agent', 'todo.md'), 'utf-8');

    expect(content).toContain('Step 1: analyst — 요구사항 분석 ← CURRENT');
    expect(content).not.toMatch(/Step 2:.*← CURRENT/);
  });

  it('should checkpoint가 있는 단계를 표시한다', () => {
    generateTodoFromWorkflow(testDir, makeInstance());
    const content = readFileSync(join(testDir, '.agent', 'todo.md'), 'utf-8');

    // analyst 단계에는 checkpoint가 없으므로 planner의 checkpoint만 확인
    expect(content).toContain('→ checkpoint: 계획 승인');
    // Step 3에는 checkpoint가 없음
    expect(content).not.toMatch(/Step 3:.*checkpoint/);
  });

  it('should 이미 todo.md가 있으면 덮어쓰지 않는다', () => {
    mkdirSync(join(testDir, '.agent'), { recursive: true });
    writeFileSync(join(testDir, '.agent', 'todo.md'), '# 기존 할 일');

    const result = generateTodoFromWorkflow(testDir, makeInstance());

    expect(result.created).toBe(false);
    expect(readFileSync(join(testDir, '.agent', 'todo.md'), 'utf-8')).toContain('기존 할 일');
  });
});

// ─── syncTodoProgress ───

describe('syncTodoProgress', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'sync-test-'));
    mkdirSync(join(testDir, '.agent'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const sampleTodo = `# Todo — feature
> 워크플로우: feature-20260302-abc1

- [ ] Step 1: analyst — 요구사항 분석 ← CURRENT
- [ ] Step 2: planner — 구현 계획 수립
- [ ] Step 3: executor — 구현
`;

  it('should 완료된 단계를 [x]로 변환한다', () => {
    writeFileSync(join(testDir, '.agent', 'todo.md'), sampleTodo);

    const result = syncTodoProgress(testDir, 1, 2);

    expect(result.synced).toBe(true);
    const content = readFileSync(join(testDir, '.agent', 'todo.md'), 'utf-8');
    expect(content).toContain('- [x] Step 1: analyst');
    expect(content).toContain('- [ ] Step 2: planner');
  });

  it('should ← CURRENT 마커를 다음 단계로 이동한다', () => {
    writeFileSync(join(testDir, '.agent', 'todo.md'), sampleTodo);

    syncTodoProgress(testDir, 1, 2);
    const content = readFileSync(join(testDir, '.agent', 'todo.md'), 'utf-8');

    expect(content).not.toMatch(/Step 1:.*← CURRENT/);
    expect(content).toContain('Step 2: planner — 구현 계획 수립 ← CURRENT');
  });

  it('should 연속 진행 시 누적으로 체크한다', () => {
    writeFileSync(join(testDir, '.agent', 'todo.md'), sampleTodo);

    syncTodoProgress(testDir, 1, 2);
    syncTodoProgress(testDir, 2, 3);
    const content = readFileSync(join(testDir, '.agent', 'todo.md'), 'utf-8');

    expect(content).toContain('- [x] Step 1:');
    expect(content).toContain('- [x] Step 2:');
    expect(content).toContain('- [ ] Step 3: executor — 구현 ← CURRENT');
  });

  it('should 모든 단계 완료 시 COMPLETED 상태를 추가한다', () => {
    writeFileSync(join(testDir, '.agent', 'todo.md'), sampleTodo);

    syncTodoProgress(testDir, 1, 2);
    syncTodoProgress(testDir, 2, 3);
    syncTodoProgress(testDir, 3, undefined);
    const content = readFileSync(join(testDir, '.agent', 'todo.md'), 'utf-8');

    expect(content).toContain('- [x] Step 1:');
    expect(content).toContain('- [x] Step 2:');
    expect(content).toContain('- [x] Step 3:');
    expect(content).toContain('> 상태: COMPLETED');
    expect(content).not.toContain('← CURRENT');
  });

  it('should todo.md가 없으면 synced=false를 반환한다', () => {
    const result = syncTodoProgress(testDir, 1, 2);
    expect(result.synced).toBe(false);
  });

  it('should Step 패턴이 매칭되지 않으면 synced=false를 반환한다', () => {
    writeFileSync(join(testDir, '.agent', 'todo.md'), '# 수동 작성 todo\n- [ ] 뭔가 하기');

    const result = syncTodoProgress(testDir, 1, 2);
    expect(result.synced).toBe(false);
  });
});

// ─── initKnowledgeBranch ───

describe('initKnowledgeBranch', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'sync-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should .knowledge/ 디렉토리가 없으면 건너뛴다', () => {
    const result = initKnowledgeBranch(testDir, 'feat/login');
    expect(result.created).toBe(false);
  });

  it('should .knowledge/ 존재 시 브랜치 문서를 생성한다', () => {
    mkdirSync(join(testDir, '.knowledge', 'branches'), { recursive: true });

    const result = initKnowledgeBranch(testDir, 'feat/login');

    expect(result.created).toBe(true);
    expect(existsSync(join(testDir, '.knowledge', 'branches', 'feat-login'))).toBe(true);
  });
});
