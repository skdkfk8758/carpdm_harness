import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  generateWorkflowId,
  getWorkflowDir,
  saveActiveWorkflowId,
  loadActiveWorkflowId,
  clearActiveWorkflow,
  saveWorkflowInstance,
  loadWorkflowInstance,
  appendHistoryEvent,
  loadWorkflowHistory,
  listWorkflowDirs,
} from '../src/core/workflow-persistence.js';
import type { WorkflowInstance, WorkflowEvent } from '../src/types/workflow-engine.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'harness-persist-test-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('generateWorkflowId', () => {
  // 테스트 1: 형식 검증
  it('{type}-{YYYYMMDD}-{4chars} 형식을 반환한다', () => {
    const id = generateWorkflowId('feature');
    expect(id).toMatch(/^feature-\d{8}-[a-z0-9]{4}$/);
  });

  it('다른 워크플로우 타입도 올바른 형식을 반환한다', () => {
    const id = generateWorkflowId('bugfix');
    expect(id).toMatch(/^bugfix-\d{8}-[a-z0-9]{4}$/);
  });
});

describe('saveWorkflowInstance + loadWorkflowInstance', () => {
  // 테스트 2: 라운드트립
  it('저장 후 읽으면 동일한 인스턴스를 반환한다', () => {
    const instance: WorkflowInstance = {
      id: 'feature-20260225-a1b2',
      workflowType: 'feature',
      status: 'running',
      currentStep: 1,
      totalSteps: 7,
      context: { description: '테스트 워크플로우' },
      steps: [
        { order: 1, agent: 'analyst', action: '요구사항 분석', status: 'running' },
        { order: 2, agent: 'planner', action: '구현 계획', status: 'pending' },
      ],
      config: { guardLevel: 'warn', autoAdvance: false, syncToOmc: true, maxRetries: 3, historyEnabled: true },
      createdAt: '2026-02-25T10:00:00Z',
      updatedAt: '2026-02-25T10:00:00Z',
    };

    saveWorkflowInstance(projectRoot, instance);
    const loaded = loadWorkflowInstance(projectRoot, instance.id);

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(instance.id);
    expect(loaded!.workflowType).toBe(instance.workflowType);
    expect(loaded!.status).toBe(instance.status);
    expect(loaded!.steps.length).toBe(2);
    expect(loaded!.context.description).toBe('테스트 워크플로우');
  });
});

describe('appendHistoryEvent', () => {
  // 테스트 3: 기존 이벤트에 추가
  it('기존 이벤트에 새 이벤트를 추가한다', () => {
    const workflowId = 'feature-20260225-a1b2';

    const event1: WorkflowEvent = {
      type: 'start',
      timestamp: '2026-02-25T10:00:00Z',
      data: { workflowType: 'feature' },
    };
    appendHistoryEvent(projectRoot, workflowId, event1);

    let history = loadWorkflowHistory(projectRoot, workflowId);
    expect(history).not.toBeNull();
    expect(history!.events.length).toBe(1);

    const event2: WorkflowEvent = {
      type: 'complete_step',
      timestamp: '2026-02-25T10:05:00Z',
      data: { stepOrder: 1 },
    };
    appendHistoryEvent(projectRoot, workflowId, event2);

    history = loadWorkflowHistory(projectRoot, workflowId);
    expect(history!.events.length).toBe(2);
    expect(history!.events[0].type).toBe('start');
    expect(history!.events[1].type).toBe('complete_step');
  });
});

describe('saveActiveWorkflowId + loadActiveWorkflowId', () => {
  // 테스트 4: 라운드트립
  it('저장 후 읽으면 동일한 ID를 반환한다', () => {
    const id = 'feature-20260225-x1y2';
    saveActiveWorkflowId(projectRoot, id);

    const loaded = loadActiveWorkflowId(projectRoot);
    expect(loaded).toBe(id);
  });
});

describe('clearActiveWorkflow', () => {
  // 테스트 5: active.json 초기화
  it('activeWorkflowId를 null로 초기화한다', () => {
    saveActiveWorkflowId(projectRoot, 'feature-20260225-x1y2');
    expect(loadActiveWorkflowId(projectRoot)).not.toBeNull();

    clearActiveWorkflow(projectRoot);
    expect(loadActiveWorkflowId(projectRoot)).toBeNull();
  });
});

describe('listWorkflowDirs', () => {
  // 테스트 6: 시간 역순 정렬
  it('디렉토리를 시간 역순으로 정렬한다', async () => {
    // 워크플로우 인스턴스 3개 생성 (시간차 부여)
    const ids = ['feature-20260225-aaaa', 'bugfix-20260225-bbbb', 'refactor-20260225-cccc'];

    for (const id of ids) {
      const instance: WorkflowInstance = {
        id,
        workflowType: id.split('-')[0],
        status: 'completed',
        currentStep: 1,
        totalSteps: 1,
        context: {},
        steps: [],
        config: { guardLevel: 'warn', autoAdvance: false, syncToOmc: true, maxRetries: 3, historyEnabled: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveWorkflowInstance(projectRoot, instance);
      // 약간의 시간차
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const dirs = listWorkflowDirs(projectRoot, 10);
    expect(dirs.length).toBe(3);
    // 마지막에 생성된 것이 첫 번째
    expect(dirs[0]).toBe('refactor-20260225-cccc');
  });
});

describe('존재하지 않는 워크플로우', () => {
  // 테스트 7: null 반환, 에러 없음
  it('존재하지 않는 워크플로우 로드 시 null을 반환한다', () => {
    const instance = loadWorkflowInstance(projectRoot, 'nonexistent-12345678-abcd');
    expect(instance).toBeNull();
  });

  it('존재하지 않는 히스토리 로드 시 null을 반환한다', () => {
    const history = loadWorkflowHistory(projectRoot, 'nonexistent-12345678-abcd');
    expect(history).toBeNull();
  });

  it('활성 워크플로우 없을 때 null을 반환한다', () => {
    const id = loadActiveWorkflowId(projectRoot);
    expect(id).toBeNull();
  });
});
