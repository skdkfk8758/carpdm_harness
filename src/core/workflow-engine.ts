import type {
  WorkflowStatus,
  WorkflowEventType,
  WorkflowInstance,
  WorkflowContext,
  WorkflowEngineConfig,
  EngineResult,
  NextAction,
  StepState,
  ActiveWorkflow,
  DispatchHint,
} from '../types/workflow-engine.js';
import { TRANSITION_TABLE, DEFAULT_ENGINE_CONFIG } from '../types/workflow-engine.js';
import { WORKFLOW_DEFINITIONS } from '../types/workflow.js';
import type { PipelineStep } from '../types/workflow.js';
import { OMC_AGENT_PREFIX, AGENT_SKILL_MAP } from './omc-compat.js';
import {
  loadActiveWorkflowId,
  saveActiveWorkflowId,
  clearActiveWorkflow,
  loadWorkflowInstance,
  saveWorkflowInstance,
  appendHistoryEvent,
  generateWorkflowId,
  listWorkflowDirs,
} from './workflow-persistence.js';

// === 전환 로직 ===

/**
 * 상태 전환을 적용합니다.
 * 유효하지 않은 전환이면 null 반환.
 */
export function applyTransition(
  current: WorkflowStatus,
  event: WorkflowEventType,
): WorkflowStatus | null {
  const allowed = TRANSITION_TABLE[current];
  if (!allowed.includes(event)) return null;

  const transitionMap: Record<WorkflowStatus, Partial<Record<WorkflowEventType, WorkflowStatus>>> = {
    idle:                { start: 'running' },
    running:             { complete_step: 'running', checkpoint_block: 'waiting_checkpoint', step_fail: 'failed_step', abort: 'aborted' },
    waiting_checkpoint:  { approve: 'running', reject: 'aborted', abort: 'aborted' },
    failed_step:         { retry: 'running', skip: 'running', abort: 'aborted' },
    completed:           {},
    aborted:             {},
  };

  return transitionMap[current][event] ?? null;
}

/**
 * 현재 인스턴스 상태를 기반으로 다음 액션을 결정합니다.
 */
export function resolveNextAction(instance: WorkflowInstance): NextAction {
  if (instance.status === 'completed') {
    return { type: 'workflow_complete', action: '워크플로우가 완료되었습니다.' };
  }

  if (instance.status === 'waiting_checkpoint') {
    const currentStep = instance.steps[instance.currentStep - 1];
    return {
      type: 'await_checkpoint',
      agent: currentStep?.agent,
      action: currentStep?.action,
      checkpoint: currentStep?.checkpoint,
    };
  }

  if (instance.status === 'aborted') {
    return { type: 'workflow_complete', action: '워크플로우가 중단되었습니다.' };
  }

  // running 또는 failed_step
  const currentStep = instance.steps[instance.currentStep - 1];
  if (!currentStep) {
    return { type: 'workflow_complete', action: '워크플로우가 완료되었습니다.' };
  }

  const hint = instance.config.autoDispatch
    ? generateDispatchHint(currentStep, instance.context)
    : undefined;

  if (currentStep.omcSkill) {
    return {
      type: 'run_omc_skill',
      skill: currentStep.omcSkill,
      agent: currentStep.agent,
      action: currentStep.action,
      dispatchHint: hint,
    };
  }

  return {
    type: 'manual_action',
    agent: currentStep.agent,
    action: currentStep.action,
    dispatchHint: hint,
  };
}

/**
 * autoDispatch 힌트를 생성합니다.
 * 현재 단계의 에이전트를 기반으로 OMC 에이전트 타입, 스킬, 모델, 프롬프트를 결정합니다.
 */
export function generateDispatchHint(
  step: StepState,
  context?: WorkflowContext,
): DispatchHint {
  const mapping = AGENT_SKILL_MAP[step.agent];
  const model = mapping?.model ?? 'sonnet';
  const skill = step.omcSkill ?? mapping?.skill;
  const agentType = `${OMC_AGENT_PREFIX}${step.agent}`;

  // 프롬프트 구성: 액션 + 컨텍스트
  const parts: string[] = [`작업: ${step.action}`];
  if (context?.description) {
    parts.push(`설명: ${context.description}`);
  }
  if (context?.branch) {
    parts.push(`브랜치: ${context.branch}`);
  }
  if (context?.relatedIssue) {
    parts.push(`관련 이슈: ${context.relatedIssue}`);
  }
  if (step.checkpoint) {
    parts.push(`체크포인트: ${step.checkpoint}`);
  }

  return {
    agentType,
    skill: skill ?? undefined,
    model,
    prompt: parts.join('\n'),
  };
}

// === 워크플로우 생명주기 ===

/**
 * 워크플로우를 시작합니다.
 */
export function startWorkflow(
  projectRoot: string,
  workflowType: string,
  context?: WorkflowContext,
  configOverrides?: Partial<WorkflowEngineConfig>,
): EngineResult {
  // 이미 활성 워크플로우가 있는지 확인
  const activeId = loadActiveWorkflowId(projectRoot);
  if (activeId) {
    const existing = loadWorkflowInstance(projectRoot, activeId);
    if (existing && existing.status !== 'completed' && existing.status !== 'aborted') {
      return {
        success: false,
        message: `이미 활성 워크플로우가 있습니다: ${activeId} (${existing.workflowType}, 상태: ${existing.status})`,
      };
    }
  }

  // 워크플로우 정의 조회
  const def = WORKFLOW_DEFINITIONS[workflowType];
  if (!def) {
    return {
      success: false,
      message: `알 수 없는 워크플로우 타입: ${workflowType}. 사용 가능: ${Object.keys(WORKFLOW_DEFINITIONS).join(', ')}`,
    };
  }

  const config: WorkflowEngineConfig = { ...DEFAULT_ENGINE_CONFIG, ...configOverrides };
  const id = generateWorkflowId(workflowType);
  const now = new Date().toISOString();

  // 파이프라인 단계를 StepState로 변환
  const steps: StepState[] = def.pipeline.map((step: PipelineStep) => ({
    order: step.order,
    agent: step.agent,
    action: step.action,
    status: step.order === 1 ? 'running' as const : 'pending' as const,
    optional: step.optional,
    checkpoint: step.checkpoint,
    omcSkill: step.omcSkill,
    harnessTool: step.harnessTool,
    startedAt: step.order === 1 ? now : undefined,
    retryCount: 0,
  }));

  const instance: WorkflowInstance = {
    id,
    workflowType,
    status: 'running',
    currentStep: 1,
    totalSteps: steps.length,
    context: context ?? {},
    steps,
    config,
    createdAt: now,
    updatedAt: now,
  };

  // 영속화
  saveActiveWorkflowId(projectRoot, id);
  saveWorkflowInstance(projectRoot, instance);

  if (config.historyEnabled) {
    appendHistoryEvent(projectRoot, id, {
      type: 'start',
      timestamp: now,
      data: { workflowType, context: context ?? {} },
    });
  }

  return {
    success: true,
    instance,
    message: `워크플로우 시작: ${workflowType} (${id})`,
    nextAction: resolveNextAction(instance),
  };
}

/**
 * 현재 단계를 완료하고 다음 단계로 진행합니다.
 */
export function advanceWorkflow(
  projectRoot: string,
  result?: string,
  artifacts?: Record<string, unknown>,
): EngineResult {
  const activeId = loadActiveWorkflowId(projectRoot);
  if (!activeId) {
    return { success: false, message: '활성 워크플로우가 없습니다.' };
  }

  const instance = loadWorkflowInstance(projectRoot, activeId);
  if (!instance) {
    return { success: false, message: `워크플로우 인스턴스를 찾을 수 없습니다: ${activeId}` };
  }

  if (instance.status !== 'running') {
    return { success: false, message: `현재 상태에서 진행할 수 없습니다: ${instance.status}` };
  }

  const currentStep = instance.steps[instance.currentStep - 1];
  if (!currentStep || currentStep.status !== 'running') {
    return { success: false, message: '현재 실행 중인 단계가 없습니다.' };
  }

  const now = new Date().toISOString();

  // 현재 단계 완료 처리
  currentStep.status = 'completed';
  currentStep.completedAt = now;
  if (result) currentStep.result = result;
  if (artifacts) currentStep.artifacts = artifacts;

  // 히스토리 기록
  if (instance.config.historyEnabled) {
    appendHistoryEvent(projectRoot, instance.id, {
      type: 'complete_step',
      timestamp: now,
      data: { stepOrder: currentStep.order, result: result ?? '', artifacts: artifacts ?? {} },
    });
  }

  // 다음 단계 결정
  const nextStepIndex = instance.currentStep; // 0-based for next step
  if (nextStepIndex >= instance.totalSteps) {
    // 마지막 단계 완료
    instance.status = 'completed';
    instance.updatedAt = now;
    saveWorkflowInstance(projectRoot, instance);
    clearActiveWorkflow(projectRoot);

    return {
      success: true,
      instance,
      message: `워크플로우 완료: ${instance.workflowType} (${instance.id})`,
      nextAction: resolveNextAction(instance),
    };
  }

  // 다음 단계에 체크포인트가 있는지 확인
  const nextStep = instance.steps[nextStepIndex];
  if (nextStep.checkpoint) {
    // 현재 단계 완료 후 다음 단계를 waiting_checkpoint로
    nextStep.status = 'waiting_checkpoint';
    nextStep.startedAt = now;
    instance.currentStep = nextStepIndex + 1;
    instance.status = 'waiting_checkpoint';
    instance.updatedAt = now;

    if (instance.config.historyEnabled) {
      appendHistoryEvent(projectRoot, instance.id, {
        type: 'checkpoint_block',
        timestamp: now,
        data: { stepOrder: nextStep.order, checkpoint: nextStep.checkpoint },
      });
    }

    saveWorkflowInstance(projectRoot, instance);

    return {
      success: true,
      instance,
      message: `체크포인트 대기: ${nextStep.checkpoint} (단계 ${nextStep.order})`,
      nextAction: resolveNextAction(instance),
    };
  }

  // 체크포인트 없으면 다음 단계 시작
  nextStep.status = 'running';
  nextStep.startedAt = now;
  instance.currentStep = nextStepIndex + 1;
  instance.updatedAt = now;
  saveWorkflowInstance(projectRoot, instance);

  return {
    success: true,
    instance,
    message: `단계 ${currentStep.order} 완료, 다음 단계: ${nextStep.order}/${instance.totalSteps} (${nextStep.agent} - ${nextStep.action})`,
    nextAction: resolveNextAction(instance),
  };
}

/**
 * 체크포인트를 승인합니다.
 */
export function approveCheckpoint(
  projectRoot: string,
  approver?: string,
): EngineResult {
  const activeId = loadActiveWorkflowId(projectRoot);
  if (!activeId) {
    return { success: false, message: '활성 워크플로우가 없습니다.' };
  }

  const instance = loadWorkflowInstance(projectRoot, activeId);
  if (!instance) {
    return { success: false, message: `워크플로우 인스턴스를 찾을 수 없습니다: ${activeId}` };
  }

  const newStatus = applyTransition(instance.status, 'approve');
  if (!newStatus) {
    return { success: false, message: `현재 상태(${instance.status})에서 승인할 수 없습니다.` };
  }

  const now = new Date().toISOString();
  const currentStep = instance.steps[instance.currentStep - 1];

  if (currentStep) {
    currentStep.checkpointApproved = true;
    currentStep.status = 'running';
  }

  instance.status = newStatus;
  instance.updatedAt = now;

  if (instance.config.historyEnabled) {
    appendHistoryEvent(projectRoot, instance.id, {
      type: 'approve',
      timestamp: now,
      data: { stepOrder: instance.currentStep, approver: approver ?? '' },
    });
  }

  saveWorkflowInstance(projectRoot, instance);

  return {
    success: true,
    instance,
    message: `체크포인트 승인됨: 단계 ${instance.currentStep} (${currentStep?.checkpoint ?? ''})`,
    nextAction: resolveNextAction(instance),
  };
}

/**
 * 체크포인트를 거부합니다.
 */
export function rejectCheckpoint(
  projectRoot: string,
  reason?: string,
): EngineResult {
  const activeId = loadActiveWorkflowId(projectRoot);
  if (!activeId) {
    return { success: false, message: '활성 워크플로우가 없습니다.' };
  }

  const instance = loadWorkflowInstance(projectRoot, activeId);
  if (!instance) {
    return { success: false, message: `워크플로우 인스턴스를 찾을 수 없습니다: ${activeId}` };
  }

  const newStatus = applyTransition(instance.status, 'reject');
  if (!newStatus) {
    return { success: false, message: `현재 상태(${instance.status})에서 거부할 수 없습니다.` };
  }

  const now = new Date().toISOString();
  const currentStep = instance.steps[instance.currentStep - 1];

  if (currentStep) {
    currentStep.checkpointApproved = false;
    currentStep.status = 'failed';
    currentStep.error = reason ?? '체크포인트 거부됨';
  }

  instance.status = newStatus;
  instance.updatedAt = now;

  if (instance.config.historyEnabled) {
    appendHistoryEvent(projectRoot, instance.id, {
      type: 'reject',
      timestamp: now,
      data: { stepOrder: instance.currentStep, reason: reason ?? '' },
    });
  }

  saveWorkflowInstance(projectRoot, instance);
  clearActiveWorkflow(projectRoot);

  return {
    success: true,
    instance,
    message: `체크포인트 거부됨: ${reason ?? '사유 없음'}. 워크플로우가 중단되었습니다.`,
    nextAction: resolveNextAction(instance),
  };
}

/**
 * 실패한 단계를 재시도합니다.
 */
export function retryStep(projectRoot: string): EngineResult {
  const activeId = loadActiveWorkflowId(projectRoot);
  if (!activeId) {
    return { success: false, message: '활성 워크플로우가 없습니다.' };
  }

  const instance = loadWorkflowInstance(projectRoot, activeId);
  if (!instance) {
    return { success: false, message: `워크플로우 인스턴스를 찾을 수 없습니다: ${activeId}` };
  }

  const newStatus = applyTransition(instance.status, 'retry');
  if (!newStatus) {
    return { success: false, message: `현재 상태(${instance.status})에서 재시도할 수 없습니다.` };
  }

  const currentStep = instance.steps[instance.currentStep - 1];
  if (!currentStep) {
    return { success: false, message: '현재 단계를 찾을 수 없습니다.' };
  }

  const retryCount = (currentStep.retryCount ?? 0) + 1;
  if (retryCount > instance.config.maxRetries) {
    return {
      success: false,
      message: `최대 재시도 횟수(${instance.config.maxRetries})를 초과했습니다. skip 또는 abort를 사용하세요.`,
    };
  }

  const now = new Date().toISOString();
  currentStep.status = 'running';
  currentStep.error = undefined;
  currentStep.retryCount = retryCount;
  currentStep.startedAt = now;

  instance.status = newStatus;
  instance.updatedAt = now;

  if (instance.config.historyEnabled) {
    appendHistoryEvent(projectRoot, instance.id, {
      type: 'retry',
      timestamp: now,
      data: { stepOrder: instance.currentStep, retryCount },
    });
  }

  saveWorkflowInstance(projectRoot, instance);

  return {
    success: true,
    instance,
    message: `단계 ${instance.currentStep} 재시도 (${retryCount}/${instance.config.maxRetries})`,
    nextAction: resolveNextAction(instance),
  };
}

/**
 * 현재 단계를 건너뜁니다.
 */
export function skipStep(projectRoot: string, reason?: string): EngineResult {
  const activeId = loadActiveWorkflowId(projectRoot);
  if (!activeId) {
    return { success: false, message: '활성 워크플로우가 없습니다.' };
  }

  const instance = loadWorkflowInstance(projectRoot, activeId);
  if (!instance) {
    return { success: false, message: `워크플로우 인스턴스를 찾을 수 없습니다: ${activeId}` };
  }

  // failed_step 또는 running 상태에서 skip 가능
  if (instance.status === 'failed_step') {
    const newStatus = applyTransition(instance.status, 'skip');
    if (!newStatus) {
      return { success: false, message: `현재 상태(${instance.status})에서 건너뛸 수 없습니다.` };
    }
    instance.status = newStatus;
  } else if (instance.status === 'running') {
    // running 상태에서도 skip 허용 (단, abort 전환은 아니므로 직접 처리)
  } else {
    return { success: false, message: `현재 상태(${instance.status})에서 건너뛸 수 없습니다.` };
  }

  const now = new Date().toISOString();
  const currentStep = instance.steps[instance.currentStep - 1];

  if (currentStep) {
    currentStep.status = 'skipped';
    currentStep.completedAt = now;
    if (reason) currentStep.result = `건너뜀: ${reason}`;
  }

  if (instance.config.historyEnabled) {
    appendHistoryEvent(projectRoot, instance.id, {
      type: 'skip',
      timestamp: now,
      data: { stepOrder: instance.currentStep, reason: reason ?? '' },
    });
  }

  // 다음 단계로 진행
  const nextStepIndex = instance.currentStep;
  if (nextStepIndex >= instance.totalSteps) {
    instance.status = 'completed';
    instance.updatedAt = now;
    saveWorkflowInstance(projectRoot, instance);
    clearActiveWorkflow(projectRoot);

    return {
      success: true,
      instance,
      message: `단계 ${instance.currentStep} 건너뜀. 워크플로우 완료.`,
      nextAction: resolveNextAction(instance),
    };
  }

  const nextStep = instance.steps[nextStepIndex];
  if (nextStep.checkpoint) {
    nextStep.status = 'waiting_checkpoint';
    nextStep.startedAt = now;
    instance.currentStep = nextStepIndex + 1;
    instance.status = 'waiting_checkpoint';
  } else {
    nextStep.status = 'running';
    nextStep.startedAt = now;
    instance.currentStep = nextStepIndex + 1;
    instance.status = 'running';
  }

  instance.updatedAt = now;
  saveWorkflowInstance(projectRoot, instance);

  return {
    success: true,
    instance,
    message: `단계 ${currentStep?.order ?? '?'} 건너뜀, 다음: ${nextStep.order}/${instance.totalSteps} (${nextStep.agent} - ${nextStep.action})`,
    nextAction: resolveNextAction(instance),
  };
}

/**
 * 워크플로우를 중단합니다.
 */
export function abortWorkflow(projectRoot: string, reason?: string): EngineResult {
  const activeId = loadActiveWorkflowId(projectRoot);
  if (!activeId) {
    return { success: false, message: '활성 워크플로우가 없습니다.' };
  }

  const instance = loadWorkflowInstance(projectRoot, activeId);
  if (!instance) {
    return { success: false, message: `워크플로우 인스턴스를 찾을 수 없습니다: ${activeId}` };
  }

  // idle, completed, aborted 상태에서는 abort 불가
  if (instance.status === 'idle' || instance.status === 'completed' || instance.status === 'aborted') {
    return { success: false, message: `현재 상태(${instance.status})에서 중단할 수 없습니다.` };
  }

  // running, waiting_checkpoint, failed_step에서 abort 가능
  const newStatus = applyTransition(instance.status, 'abort');
  if (!newStatus) {
    return { success: false, message: `현재 상태(${instance.status})에서 중단할 수 없습니다.` };
  }

  const now = new Date().toISOString();
  instance.status = newStatus;
  instance.updatedAt = now;

  // 현재 진행 중인 단계를 failed로 표시
  const currentStep = instance.steps[instance.currentStep - 1];
  if (currentStep && (currentStep.status === 'running' || currentStep.status === 'waiting_checkpoint')) {
    currentStep.status = 'failed';
    currentStep.error = reason ?? '워크플로우 중단됨';
    currentStep.completedAt = now;
  }

  if (instance.config.historyEnabled) {
    appendHistoryEvent(projectRoot, instance.id, {
      type: 'abort',
      timestamp: now,
      data: { reason: reason ?? '' },
    });
  }

  saveWorkflowInstance(projectRoot, instance);
  clearActiveWorkflow(projectRoot);

  return {
    success: true,
    instance,
    message: `워크플로우 중단됨: ${reason ?? '사유 없음'} (${instance.id})`,
    nextAction: resolveNextAction(instance),
  };
}

// === 조회 ===

/**
 * 현재 활성 워크플로우의 상태를 반환합니다.
 */
export function getWorkflowStatus(projectRoot: string): WorkflowInstance | null {
  const activeId = loadActiveWorkflowId(projectRoot);
  if (!activeId) return null;
  return loadWorkflowInstance(projectRoot, activeId);
}

/**
 * 활성 워크플로우 정보를 반환합니다.
 */
export function getActiveWorkflow(projectRoot: string): ActiveWorkflow {
  const activeId = loadActiveWorkflowId(projectRoot);
  if (!activeId) return { activeWorkflowId: null };

  const instance = loadWorkflowInstance(projectRoot, activeId);
  return {
    activeWorkflowId: activeId,
    startedAt: instance?.createdAt,
  };
}

/**
 * 최근 워크플로우 목록을 반환합니다.
 */
export function listRecentWorkflows(projectRoot: string): WorkflowInstance[] {
  const dirs = listWorkflowDirs(projectRoot, 10);
  const instances: WorkflowInstance[] = [];

  for (const dir of dirs) {
    const instance = loadWorkflowInstance(projectRoot, dir);
    if (instance) {
      instances.push(instance);
    }
  }

  return instances;
}

/**
 * 단계 실패를 기록합니다.
 */
export function failStep(projectRoot: string, error: string): EngineResult {
  const activeId = loadActiveWorkflowId(projectRoot);
  if (!activeId) {
    return { success: false, message: '활성 워크플로우가 없습니다.' };
  }

  const instance = loadWorkflowInstance(projectRoot, activeId);
  if (!instance) {
    return { success: false, message: `워크플로우 인스턴스를 찾을 수 없습니다: ${activeId}` };
  }

  const newStatus = applyTransition(instance.status, 'step_fail');
  if (!newStatus) {
    return { success: false, message: `현재 상태(${instance.status})에서 실패를 기록할 수 없습니다.` };
  }

  const now = new Date().toISOString();
  const currentStep = instance.steps[instance.currentStep - 1];

  if (currentStep) {
    currentStep.status = 'failed';
    currentStep.error = error;
  }

  instance.status = newStatus;
  instance.updatedAt = now;

  if (instance.config.historyEnabled) {
    appendHistoryEvent(projectRoot, instance.id, {
      type: 'step_fail',
      timestamp: now,
      data: { stepOrder: instance.currentStep, error },
    });
  }

  saveWorkflowInstance(projectRoot, instance);

  return {
    success: true,
    instance,
    message: `단계 ${instance.currentStep} 실패: ${error}`,
    nextAction: resolveNextAction(instance),
  };
}
