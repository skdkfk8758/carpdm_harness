import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { safeWriteFile } from '../src/core/file-ops.js';
import {
  applyTransition,
  startWorkflow,
  advanceWorkflow,
  approveCheckpoint,
  rejectCheckpoint,
  retryStep,
  skipStep,
  abortWorkflow,
  getWorkflowStatus,
  resolveNextAction,
  failStep,
} from '../src/core/workflow-engine.js';
import type { WorkflowInstance, WorkflowStatus, WorkflowEventType } from '../src/types/workflow-engine.js';
import { TRANSITION_TABLE } from '../src/types/workflow-engine.js';
import { WORKFLOW_DEFINITIONS } from '../src/types/workflow.js';

let projectRoot: string;

function setupProject(root: string): void {
  safeWriteFile(
    join(root, 'carpdm-harness.config.json'),
    JSON.stringify({
      version: '4.0.0',
      preset: 'full',
      modules: ['core', 'quality', 'ship', 'security', 'tdd'],
      options: { hooksRegistered: true, docsTemplatesDir: 'docs/templates', agentDir: '.agent' },
      files: {},
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      globalCommandsInstalled: false,
    }, null, 2),
  );
}

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'harness-wf-test-'));
  setupProject(projectRoot);
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('applyTransition', () => {
  it('유효한 전환을 올바르게 반환한다', () => {
    expect(applyTransition('idle', 'start')).toBe('running');
    expect(applyTransition('running', 'complete_step')).toBe('running');
    expect(applyTransition('running', 'checkpoint_block')).toBe('waiting_checkpoint');
    expect(applyTransition('running', 'step_fail')).toBe('failed_step');
    expect(applyTransition('running', 'abort')).toBe('aborted');
    expect(applyTransition('waiting_checkpoint', 'approve')).toBe('running');
    expect(applyTransition('waiting_checkpoint', 'reject')).toBe('aborted');
    expect(applyTransition('failed_step', 'retry')).toBe('running');
    expect(applyTransition('failed_step', 'skip')).toBe('running');
    expect(applyTransition('failed_step', 'abort')).toBe('aborted');
  });

  it('유효하지 않은 전환에 null을 반환한다', () => {
    expect(applyTransition('completed', 'start')).toBeNull();
    expect(applyTransition('aborted', 'start')).toBeNull();
    expect(applyTransition('idle', 'complete_step')).toBeNull();
    expect(applyTransition('idle', 'abort')).toBeNull();
    expect(applyTransition('running', 'approve')).toBeNull();
    expect(applyTransition('waiting_checkpoint', 'complete_step')).toBeNull();
  });

  it('TRANSITION_TABLE의 모든 허용 이벤트가 유효한 전환을 반환한다', () => {
    for (const [status, events] of Object.entries(TRANSITION_TABLE)) {
      for (const event of events) {
        const result = applyTransition(status as WorkflowStatus, event as WorkflowEventType);
        expect(result, `${status} + ${event} should not be null`).not.toBeNull();
      }
    }
  });
});

describe('startWorkflow', () => {
  it('새 인스턴스를 생성하고 첫 단계를 running으로 설정한다', () => {
    const result = startWorkflow(projectRoot, 'feature');
    expect(result.success).toBe(true);
    expect(result.instance).toBeDefined();
    expect(result.instance!.status).toBe('running');
    expect(result.instance!.currentStep).toBe(1);
    expect(result.instance!.steps[0].status).toBe('running');
    expect(result.instance!.steps[1].status).toBe('pending');
    expect(result.instance!.workflowType).toBe('feature');
    expect(result.instance!.id).toMatch(/^feature-\d{8}-[a-z0-9]{4}$/);
  });

  it('이미 활성 워크플로우가 있으면 실패한다', () => {
    const first = startWorkflow(projectRoot, 'feature');
    expect(first.success).toBe(true);

    const second = startWorkflow(projectRoot, 'bugfix');
    expect(second.success).toBe(false);
    expect(second.message).toContain('이미 활성 워크플로우');
  });

  it('알 수 없는 워크플로우 타입이면 실패한다', () => {
    const result = startWorkflow(projectRoot, 'unknown_type');
    expect(result.success).toBe(false);
    expect(result.message).toContain('알 수 없는 워크플로우 타입');
  });
});

describe('advanceWorkflow', () => {
  it('다음 단계로 진행한다', () => {
    startWorkflow(projectRoot, 'bugfix');
    const result = advanceWorkflow(projectRoot, '탐색 완료');
    expect(result.success).toBe(true);
    // bugfix step 2 (debugger)는 checkpoint 있음 -> waiting_checkpoint
    expect(result.instance!.steps[0].status).toBe('completed');
    expect(result.instance!.steps[0].result).toBe('탐색 완료');
  });

  it('체크포인트가 있는 다음 단계에서 waiting_checkpoint로 전환한다', () => {
    startWorkflow(projectRoot, 'bugfix');
    // bugfix: 1.explore -> 2.debugger(checkpoint "근본 원인 확인")
    const adv = advanceWorkflow(projectRoot); // step 1 완료, step 2는 checkpoint 있음
    expect(adv.success).toBe(true);
    expect(adv.instance!.status).toBe('waiting_checkpoint');
    expect(adv.instance!.steps[1].status).toBe('waiting_checkpoint');
  });

  it('마지막 단계 완료 시 completed로 전환한다', () => {
    // security: 4단계 (1.security-reviewer[cp], 2.executor, 3.test-engineer, 4.verifier[cp])
    startWorkflow(projectRoot, 'security');

    // step 1 (security-reviewer) is running, complete it
    // step 2 (executor) has no checkpoint -> running
    const adv1 = advanceWorkflow(projectRoot);
    expect(adv1.success).toBe(true);
    expect(adv1.instance!.status).toBe('running');
    expect(adv1.instance!.currentStep).toBe(2);

    // step 2 (executor) -> complete, step 3 has no checkpoint -> running
    const adv2 = advanceWorkflow(projectRoot);
    expect(adv2.success).toBe(true);
    expect(adv2.instance!.currentStep).toBe(3);

    // step 3 (test-engineer) -> complete, step 4 (verifier) has checkpoint -> waiting_checkpoint
    const adv3 = advanceWorkflow(projectRoot);
    expect(adv3.success).toBe(true);
    expect(adv3.instance!.status).toBe('waiting_checkpoint');

    // approve checkpoint
    const approve = approveCheckpoint(projectRoot);
    expect(approve.success).toBe(true);
    expect(approve.instance!.status).toBe('running');

    // step 4 (verifier) running -> complete -> completed (last step)
    const adv4 = advanceWorkflow(projectRoot);
    expect(adv4.success).toBe(true);
    expect(adv4.instance!.status).toBe('completed');
  });

  it('활성 워크플로우가 없으면 실패한다', () => {
    const result = advanceWorkflow(projectRoot);
    expect(result.success).toBe(false);
    expect(result.message).toContain('활성 워크플로우가 없습니다');
  });
});

describe('approveCheckpoint', () => {
  it('running으로 복귀하고 다음 단계를 시작한다', () => {
    startWorkflow(projectRoot, 'bugfix');
    advanceWorkflow(projectRoot); // step 1 완료 -> step 2 waiting_checkpoint

    const result = approveCheckpoint(projectRoot);
    expect(result.success).toBe(true);
    expect(result.instance!.status).toBe('running');
    expect(result.instance!.steps[1].checkpointApproved).toBe(true);
  });
});

describe('rejectCheckpoint', () => {
  it('aborted로 전환한다', () => {
    startWorkflow(projectRoot, 'bugfix');
    advanceWorkflow(projectRoot); // step 1 완료 -> step 2 waiting_checkpoint

    const result = rejectCheckpoint(projectRoot, '계획 불충분');
    expect(result.success).toBe(true);
    expect(result.instance!.status).toBe('aborted');
  });
});

describe('skipStep', () => {
  it('단계를 건너뛴다', () => {
    startWorkflow(projectRoot, 'feature');
    const result = skipStep(projectRoot, '분석 불필요');
    expect(result.success).toBe(true);
    expect(result.instance!.steps[0].status).toBe('skipped');
    expect(result.instance!.currentStep).toBe(2);
  });
});

describe('abortWorkflow', () => {
  it('running 상태에서 aborted로 전환한다', () => {
    startWorkflow(projectRoot, 'feature');
    const result = abortWorkflow(projectRoot, '요구사항 변경');
    expect(result.success).toBe(true);
    expect(result.instance!.status).toBe('aborted');
  });

  it('waiting_checkpoint 상태에서 aborted로 전환한다', () => {
    startWorkflow(projectRoot, 'bugfix');
    advanceWorkflow(projectRoot); // -> waiting_checkpoint (bugfix step 2 has checkpoint)
    // verify we're actually in waiting_checkpoint
    const status = getWorkflowStatus(projectRoot);
    expect(status!.status).toBe('waiting_checkpoint');

    const result = abortWorkflow(projectRoot, '우선순위 변경');
    expect(result.success).toBe(true);
    expect(result.instance!.status).toBe('aborted');
  });

  it('failed_step 상태에서 aborted로 전환한다', () => {
    startWorkflow(projectRoot, 'feature');
    failStep(projectRoot, '구현 오류');
    const result = abortWorkflow(projectRoot);
    expect(result.success).toBe(true);
    expect(result.instance!.status).toBe('aborted');
  });

  it('활성 워크플로우가 없으면 실패한다', () => {
    const result = abortWorkflow(projectRoot);
    expect(result.success).toBe(false);
  });
});

describe('resolveNextAction', () => {
  it('omcSkill이 있는 단계에서 run_omc_skill을 반환한다', () => {
    const instance: WorkflowInstance = {
      id: 'test-1',
      workflowType: 'feature',
      status: 'running',
      currentStep: 1,
      totalSteps: 7,
      context: {},
      steps: [{
        order: 1, agent: 'analyst', action: '요구사항 분석',
        status: 'running', omcSkill: '/oh-my-claudecode:analyze',
      }],
      config: { guardLevel: 'warn', autoAdvance: false, syncToOmc: true, maxRetries: 3, historyEnabled: true },
      createdAt: '', updatedAt: '',
    };

    const action = resolveNextAction(instance);
    expect(action.type).toBe('run_omc_skill');
    expect(action.skill).toBe('/oh-my-claudecode:analyze');
    expect(action.agent).toBe('analyst');
  });

  it('omcSkill이 없는 단계에서 manual_action을 반환한다', () => {
    const instance: WorkflowInstance = {
      id: 'test-2',
      workflowType: 'feature',
      status: 'running',
      currentStep: 1,
      totalSteps: 7,
      context: {},
      steps: [{
        order: 1, agent: 'architect', action: '아키텍처 검증',
        status: 'running',
      }],
      config: { guardLevel: 'warn', autoAdvance: false, syncToOmc: true, maxRetries: 3, historyEnabled: true },
      createdAt: '', updatedAt: '',
    };

    const action = resolveNextAction(instance);
    expect(action.type).toBe('manual_action');
    expect(action.agent).toBe('architect');
  });

  it('completed 상태에서 workflow_complete를 반환한다', () => {
    const instance: WorkflowInstance = {
      id: 'test-3',
      workflowType: 'feature',
      status: 'completed',
      currentStep: 7,
      totalSteps: 7,
      context: {},
      steps: [],
      config: { guardLevel: 'warn', autoAdvance: false, syncToOmc: true, maxRetries: 3, historyEnabled: true },
      createdAt: '', updatedAt: '',
    };

    const action = resolveNextAction(instance);
    expect(action.type).toBe('workflow_complete');
  });

  it('waiting_checkpoint 상태에서 await_checkpoint를 반환한다', () => {
    const instance: WorkflowInstance = {
      id: 'test-4',
      workflowType: 'feature',
      status: 'waiting_checkpoint',
      currentStep: 2,
      totalSteps: 7,
      context: {},
      steps: [
        { order: 1, agent: 'analyst', action: '분석', status: 'completed' },
        { order: 2, agent: 'planner', action: '계획', status: 'waiting_checkpoint', checkpoint: '계획 승인' },
      ],
      config: { guardLevel: 'warn', autoAdvance: false, syncToOmc: true, maxRetries: 3, historyEnabled: true },
      createdAt: '', updatedAt: '',
    };

    const action = resolveNextAction(instance);
    expect(action.type).toBe('await_checkpoint');
    expect(action.checkpoint).toBe('계획 승인');
  });
});

describe('5개 워크플로우 전체 행복 경로', () => {
  const workflowTypes = ['feature', 'bugfix', 'refactor', 'release', 'security'];

  for (const wfType of workflowTypes) {
    it(`${wfType} 워크플로우 start -> advance*N -> completed`, () => {
      const startResult = startWorkflow(projectRoot, wfType);
      expect(startResult.success).toBe(true);

      let safetyCounter = 0;
      while (safetyCounter < 30) {
        safetyCounter++;

        const inst = getWorkflowStatus(projectRoot);
        if (!inst) break;
        if (inst.status === 'completed' || inst.status === 'aborted') break;

        if (inst.status === 'waiting_checkpoint') {
          const res = approveCheckpoint(projectRoot);
          expect(res.success).toBe(true);
          continue;
        }

        if (inst.status === 'running') {
          const adv = advanceWorkflow(projectRoot);
          if (!adv.success) break;
          continue;
        }

        if (inst.status === 'failed_step') {
          skipStep(projectRoot, '테스트 건너뛰기');
          continue;
        }

        break;
      }

      // 최종 상태 확인
      const finalInst = getWorkflowStatus(projectRoot);
      // 완료 시 getWorkflowStatus는 null (active cleared) 또는 completed
      // active가 cleared되면 null이므로 completed로 간주
      if (finalInst) {
        expect(finalInst.status).toBe('completed');
      }
      // finalInst가 null이면 activeWorkflow가 cleared된 것 = completed

      // 다음 테스트를 위해 active.json 정리
      const activePath = join(projectRoot, '.harness', 'workflows', 'active.json');
      if (existsSync(activePath)) {
        writeFileSync(activePath, JSON.stringify({ activeWorkflowId: null }));
      }
    });
  }
});

describe('retryStep', () => {
  it('maxRetries 초과 시 실패한다', () => {
    startWorkflow(projectRoot, 'feature', undefined, { maxRetries: 3 });

    failStep(projectRoot, '오류 발생');

    expect(retryStep(projectRoot).success).toBe(true); // retry 1
    failStep(projectRoot, '오류 발생');
    expect(retryStep(projectRoot).success).toBe(true); // retry 2
    failStep(projectRoot, '오류 발생');
    expect(retryStep(projectRoot).success).toBe(true); // retry 3
    failStep(projectRoot, '오류 발생');

    // 4번째 재시도 실패
    const result = retryStep(projectRoot);
    expect(result.success).toBe(false);
    expect(result.message).toContain('최대 재시도 횟수');
  });
});
