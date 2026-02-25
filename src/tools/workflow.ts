import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../core/config.js';
import { getCachedCapabilities, detectCapabilities } from '../core/capability-detector.js';
import { getActiveOmcMode } from '../core/omc-bridge.js';
import { WORKFLOW_DEFINITIONS } from '../types/workflow.js';
import type { WorkflowDefinition } from '../types/workflow.js';
import type { WorkflowContext, WorkflowInstance } from '../types/workflow-engine.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';
import {
  startWorkflow,
  advanceWorkflow,
  approveCheckpoint,
  rejectCheckpoint,
  retryStep,
  skipStep,
  abortWorkflow,
  getWorkflowStatus,
  listRecentWorkflows,
  resolveNextAction,
} from '../core/workflow-engine.js';
import { loadWorkflowHistory, loadActiveWorkflowId } from '../core/workflow-persistence.js';
import { syncWorkflowToOmc } from '../core/state-sync.js';

type WorkflowAction = 'guide' | 'start' | 'advance' | 'status' | 'approve' | 'reject' | 'retry' | 'skip' | 'abort' | 'list' | 'history';

export function registerWorkflowTool(server: McpServer): void {
  server.tool(
    'harness_workflow',
    '워크플로우 오케스트레이션 — 가이드, 시작, 진행, 상태 조회, 승인/거부, 재시도, 건너뛰기, 중단',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      action: z.enum(['guide', 'start', 'advance', 'status', 'approve', 'reject', 'retry', 'skip', 'abort', 'list', 'history'])
        .optional()
        .default('guide')
        .describe('실행할 액션'),
      workflow: z.string().optional().describe('워크플로우 타입 (feature|bugfix|refactor|release|security)'),
      result: z.string().optional().describe('단계 완료 결과 메시지 (advance 시)'),
      reason: z.string().optional().describe('중단/거부/스킵 사유'),
      context: z.string().optional().describe('워크플로우 컨텍스트 JSON (start 시)'),
      guardLevel: z.enum(['block', 'warn', 'off']).optional().describe('가드 레벨 오버라이드'),
      autoDispatch: z.boolean().optional().describe('자동 위임 힌트 생성 (advance 시 dispatchHint 포함)'),
      teamMode: z.string().optional().describe('OMC 팀 실행 모드 오버라이드 (ralph|autopilot|team 등)'),
    },
    async (params) => {
      try {
        const pRoot = params.projectRoot as string;
        const action = (params.action ?? 'guide') as WorkflowAction;

        const config = loadConfig(pRoot);
        if (!config) {
          return errorResult('carpdm-harness가 설치되어 있지 않습니다. harness_setup을 먼저 실행하세요.');
        }

        switch (action) {
          case 'guide':
            return handleGuide(pRoot, params.workflow as string | undefined, config);
          case 'start':
            return handleStart(pRoot, params.workflow as string | undefined, params.context as string | undefined, params.guardLevel as string | undefined, params.autoDispatch === true, params.teamMode as string | undefined);
          case 'advance':
            return handleAdvance(pRoot, params.result as string | undefined, params.autoDispatch === true);
          case 'status':
            return handleStatus(pRoot);
          case 'approve':
            return handleApprove(pRoot);
          case 'reject':
            return handleReject(pRoot, params.reason as string | undefined);
          case 'retry':
            return handleRetry(pRoot);
          case 'skip':
            return handleSkip(pRoot, params.reason as string | undefined);
          case 'abort':
            return handleAbort(pRoot, params.reason as string | undefined);
          case 'list':
            return handleList(pRoot);
          case 'history':
            return handleHistory(pRoot);
          default:
            return errorResult(`알 수 없는 액션: ${action}`);
        }
      } catch (err) {
        return errorResult(`워크플로우 실패: ${String(err)}`);
      }
    },
  );
}

// === Guide (기존 동작 유지) ===

function handleGuide(
  pRoot: string,
  workflow: string | undefined,
  config: { modules: string[] },
) {
  const res = new McpResponseBuilder();

  if (!workflow) {
    res.header('사용 가능한 워크플로우');
    res.blank();

    for (const [key, def] of Object.entries(WORKFLOW_DEFINITIONS)) {
      const moduleOk = def.requiredModules.every((m) => config.modules.includes(m));
      const status = moduleOk ? '✓' : '✗';
      res.line(`  ${status} ${key} — ${def.description}`);
      if (!moduleOk) {
        const missing = def.requiredModules.filter((m) => !config.modules.includes(m));
        res.line(`    필요 모듈 누락: ${missing.join(', ')}`);
      }
    }

    res.blank();
    res.info('사용법: harness_workflow({ projectRoot: "...", workflow: "feature" })');
    res.info('실행 엔진: harness_workflow({ projectRoot: "...", action: "start", workflow: "feature" })');
    return res.toResult();
  }

  const def: WorkflowDefinition | undefined = WORKFLOW_DEFINITIONS[workflow];
  if (!def) {
    return errorResult(`알 수 없는 워크플로우: ${workflow}. 사용 가능: ${Object.keys(WORKFLOW_DEFINITIONS).join(', ')}`);
  }

  const missingModules = def.requiredModules.filter((m) => !config.modules.includes(m));
  if (missingModules.length > 0) {
    res.warn(`필요 모듈 누락: ${missingModules.join(', ')} — 일부 단계가 제한될 수 있습니다.`);
    res.blank();
  }

  const capabilities = getCachedCapabilities(pRoot) ?? detectCapabilities(pRoot);

  const activeMode = getActiveOmcMode(pRoot);
  if (activeMode) {
    res.warn(`OMC 활성 모드 감지: ${activeMode} — 워크플로우 실행 시 충돌할 수 있습니다.`);
    res.blank();
  }

  res.header(`워크플로우: ${def.name} (${def.description})`);
  res.blank();
  res.info(`파이프라인 (${def.pipeline.length}단계)`);

  for (const step of def.pipeline) {
    const optionalTag = step.optional ? ' (선택)' : '';
    const checkpointTag = step.checkpoint ? ` <- 체크포인트: ${step.checkpoint}` : '';
    const skillTag = step.omcSkill ? ` -> ${step.omcSkill}` : '';
    const toolHints: string[] = [];
    if (capabilities.tools.codex.detected && ['quality-reviewer', 'security-reviewer'].includes(step.agent)) {
      toolHints.push('Codex 활용 가능');
    }
    if (capabilities.tools.serena.detected && ['architect', 'verifier'].includes(step.agent)) {
      toolHints.push('Serena LSP 활용 가능');
    }
    const hintTag = toolHints.length > 0 ? ` (${toolHints.join(', ')})` : '';
    res.line(`  ${step.order}. [${step.agent}] ${step.action}${optionalTag}${skillTag}${hintTag}${checkpointTag}`);
  }

  const detectedTools: string[] = [];
  if (capabilities.tools.serena.detected) detectedTools.push('serena');
  if (capabilities.tools.context7.detected) detectedTools.push('context7');
  if (capabilities.tools.codex.detected) detectedTools.push('codex');
  if (capabilities.tools.gemini.detected) detectedTools.push('gemini');

  if (detectedTools.length > 0) {
    res.blank();
    res.info('감지된 도구 활용');

    const toolHintMap: Record<string, string> = {
      serena: 'LSP 기반 코드 분석으로 architect/verifier 단계 강화',
      context7: '문서 참조로 planner/analyst 단계 보강',
      codex: 'AI 리뷰로 quality-reviewer/security-reviewer 단계 강화',
      gemini: '대규모 컨텍스트 분석으로 architect 단계 보강',
    };

    for (const tool of detectedTools) {
      const recommended = def.recommendedCapabilities?.includes(tool);
      const mark = recommended ? '✓' : '-';
      res.line(`  ${mark} ${tool[0].toUpperCase() + tool.slice(1)}: ${toolHintMap[tool]}`);
    }
  }

  res.blank();
  res.info('OMC 단계별 실행 가이드');
  for (const step of def.pipeline) {
    if (step.omcSkill) {
      const cpTag = step.checkpoint ? `  [체크포인트: ${step.checkpoint}]` : '';
      res.line(`  ${step.order}. ${step.omcSkill} — ${step.action}${cpTag}`);
    } else {
      res.line(`  ${step.order}. (수동) ${step.agent} — ${step.action}`);
    }
  }
  res.blank();
  res.line('  추천 자동 모드: /oh-my-claudecode:autopilot (전체 파이프라인 자동 실행)');
  res.line('  또는 위 순서대로 하나씩 수동 실행');
  res.blank();
  res.info('실행 엔진으로 시작하려면:');
  res.line(`  harness_workflow({ projectRoot: "${pRoot}", action: "start", workflow: "${def.name}" })`);

  return res.toResult();
}

// === Start ===

function handleStart(
  pRoot: string,
  workflow: string | undefined,
  contextJson: string | undefined,
  guardLevel: string | undefined,
  autoDispatch?: boolean,
  teamMode?: string,
) {
  if (!workflow) {
    return errorResult('workflow 파라미터가 필요합니다. 예: workflow: "feature"');
  }

  let context: WorkflowContext | undefined;
  if (contextJson) {
    try {
      context = JSON.parse(contextJson) as WorkflowContext;
    } catch {
      return errorResult('context JSON 파싱 실패. 올바른 JSON을 입력하세요.');
    }
  }

  const configOverrides: Record<string, unknown> = {};
  if (guardLevel) {
    configOverrides.guardLevel = guardLevel;
  }
  if (autoDispatch) {
    configOverrides.autoDispatch = true;
  }
  // teamMode: 명시적 오버라이드 > 워크플로우 정의 기본값
  const def = WORKFLOW_DEFINITIONS[workflow];
  const effectiveTeamMode = teamMode ?? def?.teamMode;
  if (effectiveTeamMode) {
    configOverrides.teamMode = effectiveTeamMode;
  }

  const engineResult = startWorkflow(pRoot, workflow, context, configOverrides);

  if (!engineResult.success) {
    return errorResult(engineResult.message);
  }

  const instance = engineResult.instance!;
  const res = new McpResponseBuilder();

  res.header(`워크플로우 시작: ${instance.workflowType} (${WORKFLOW_DEFINITIONS[instance.workflowType]?.description ?? ''})`);
  res.blank();
  res.ok(`워크플로우 ID: ${instance.id}`);
  res.info(`파이프라인: ${instance.totalSteps}단계`);
  if (instance.config.autoDispatch) {
    res.info('autoDispatch: 활성화 (각 단계에 위임 힌트 포함)');
  }
  if (instance.config.teamMode) {
    res.info(`teamMode: ${instance.config.teamMode}`);
  }
  res.blank();

  const currentStep = instance.steps[instance.currentStep - 1];
  if (currentStep) {
    res.line(`  현재 단계: ${instance.currentStep}/${instance.totalSteps}`);
    res.line(`  에이전트: ${currentStep.agent}`);
    res.line(`  작업: ${currentStep.action}`);
    if (currentStep.omcSkill) {
      res.line(`  OMC 스킬: ${currentStep.omcSkill}`);
    }
  }

  res.blank();
  res.info('다음 액션');
  res.line(`  harness_workflow({ projectRoot: "${pRoot}", action: "advance" }) -- 단계 완료 시`);
  res.line(`  harness_workflow({ projectRoot: "${pRoot}", action: "skip" }) -- 건너뛸 때`);
  res.line(`  harness_workflow({ projectRoot: "${pRoot}", action: "abort" }) -- 중단할 때`);

  // OMC 동기화
  if (instance.config.syncToOmc) {
    syncWorkflowToOmc(pRoot);
  }

  return res.toResult();
}

// === Advance ===

function handleAdvance(pRoot: string, result: string | undefined, autoDispatch?: boolean) {
  // autoDispatch 파라미터로 일시적 오버라이드 가능
  if (autoDispatch) {
    const instance = getWorkflowStatus(pRoot);
    if (instance && !instance.config.autoDispatch) {
      instance.config.autoDispatch = true;
    }
  }

  const engineResult = advanceWorkflow(pRoot, result);

  if (!engineResult.success) {
    return errorResult(engineResult.message);
  }

  const instance = engineResult.instance!;
  const res = new McpResponseBuilder();

  res.header(`워크플로우 진행: ${instance.workflowType} (${instance.id})`);
  res.blank();

  if (instance.status === 'completed') {
    res.ok('워크플로우 완료!');
    renderStepSummary(res, instance);
  } else {
    const prevStep = instance.steps[instance.currentStep - 2];
    if (prevStep) {
      res.ok(`단계 ${prevStep.order} 완료: ${prevStep.agent} — ${prevStep.action}`);
    }
    res.blank();

    const currentStep = instance.steps[instance.currentStep - 1];
    if (currentStep) {
      res.line(`  다음 단계: ${instance.currentStep}/${instance.totalSteps}`);
      res.line(`  에이전트: ${currentStep.agent}`);
      res.line(`  작업: ${currentStep.action}`);
      if (currentStep.omcSkill) {
        res.line(`  OMC 스킬: ${currentStep.omcSkill}`);
      }
      if (currentStep.checkpoint) {
        res.blank();
        res.warn(`이 단계는 체크포인트가 있습니다: ${currentStep.checkpoint}`);
        res.line(`  완료 후 harness_workflow({ action: "approve" })로 승인하세요.`);
      }

      // autoDispatch 힌트 출력
      const nextAction = engineResult.nextAction;
      if (nextAction?.dispatchHint) {
        const hint = nextAction.dispatchHint;
        res.blank();
        res.info('autoDispatch 힌트');
        res.line(`  agentType: ${hint.agentType}`);
        res.line(`  model: ${hint.model}`);
        if (hint.skill) res.line(`  skill: ${hint.skill}`);
        res.line(`  prompt: ${hint.prompt}`);
      }
    }
  }

  // OMC 동기화
  if (instance.config.syncToOmc) {
    syncWorkflowToOmc(pRoot);
  }

  return res.toResult();
}

// === Status ===

function handleStatus(pRoot: string) {
  const instance = getWorkflowStatus(pRoot);

  if (!instance) {
    const res = new McpResponseBuilder();
    res.info('활성 워크플로우가 없습니다.');
    res.blank();
    res.info('시작: harness_workflow({ action: "start", workflow: "feature" })');
    res.info('최근 목록: harness_workflow({ action: "list" })');
    return res.toResult();
  }

  const res = new McpResponseBuilder();
  res.header(`워크플로우 상태: ${instance.workflowType} (${instance.id})`);
  res.blank();
  res.info(`상태: ${instance.status} | 진행: ${instance.currentStep}/${instance.totalSteps}`);
  res.blank();

  renderStepSummary(res, instance);

  const nextAction = resolveNextAction(instance);
  if (nextAction.type !== 'workflow_complete') {
    res.blank();
    res.info('다음 액션');
    if (nextAction.type === 'await_checkpoint') {
      res.line(`  harness_workflow({ action: "approve" }) -- 체크포인트 승인`);
      res.line(`  harness_workflow({ action: "reject" }) -- 체크포인트 거부`);
    } else if (instance.status === 'failed_step') {
      res.line(`  harness_workflow({ action: "retry" }) -- 재시도`);
      res.line(`  harness_workflow({ action: "skip" }) -- 건너뛰기`);
      res.line(`  harness_workflow({ action: "abort" }) -- 중단`);
    } else {
      res.line(`  harness_workflow({ action: "advance" }) -- 단계 완료`);
      res.line(`  harness_workflow({ action: "skip" }) -- 건너뛰기`);
      res.line(`  harness_workflow({ action: "abort" }) -- 중단`);
    }
  }

  return res.toResult();
}

// === Approve ===

function handleApprove(pRoot: string) {
  const engineResult = approveCheckpoint(pRoot);

  if (!engineResult.success) {
    return errorResult(engineResult.message);
  }

  const instance = engineResult.instance!;
  const res = new McpResponseBuilder();
  res.header(`체크포인트 승인: ${instance.workflowType} (${instance.id})`);
  res.blank();
  res.ok(engineResult.message);

  const currentStep = instance.steps[instance.currentStep - 1];
  if (currentStep) {
    res.blank();
    res.line(`  현재 단계: ${instance.currentStep}/${instance.totalSteps}`);
    res.line(`  에이전트: ${currentStep.agent}`);
    res.line(`  작업: ${currentStep.action}`);
    if (currentStep.omcSkill) {
      res.line(`  OMC 스킬: ${currentStep.omcSkill}`);
    }
  }

  if (instance.config.syncToOmc) {
    syncWorkflowToOmc(pRoot);
  }

  return res.toResult();
}

// === Reject ===

function handleReject(pRoot: string, reason: string | undefined) {
  const engineResult = rejectCheckpoint(pRoot, reason);

  if (!engineResult.success) {
    return errorResult(engineResult.message);
  }

  const res = new McpResponseBuilder();
  res.header('체크포인트 거부');
  res.blank();
  res.warn(engineResult.message);

  if (engineResult.instance?.config.syncToOmc) {
    syncWorkflowToOmc(pRoot);
  }

  return res.toResult();
}

// === Retry ===

function handleRetry(pRoot: string) {
  const engineResult = retryStep(pRoot);

  if (!engineResult.success) {
    return errorResult(engineResult.message);
  }

  const instance = engineResult.instance!;
  const res = new McpResponseBuilder();
  res.header(`단계 재시도: ${instance.workflowType} (${instance.id})`);
  res.blank();
  res.ok(engineResult.message);

  const currentStep = instance.steps[instance.currentStep - 1];
  if (currentStep) {
    res.blank();
    res.line(`  에이전트: ${currentStep.agent}`);
    res.line(`  작업: ${currentStep.action}`);
    if (currentStep.omcSkill) {
      res.line(`  OMC 스킬: ${currentStep.omcSkill}`);
    }
  }

  if (instance.config.syncToOmc) {
    syncWorkflowToOmc(pRoot);
  }

  return res.toResult();
}

// === Skip ===

function handleSkip(pRoot: string, reason: string | undefined) {
  const engineResult = skipStep(pRoot, reason);

  if (!engineResult.success) {
    return errorResult(engineResult.message);
  }

  const instance = engineResult.instance!;
  const res = new McpResponseBuilder();
  res.header(`단계 건너뛰기: ${instance.workflowType} (${instance.id})`);
  res.blank();
  res.ok(engineResult.message);

  if (instance.status !== 'completed') {
    const currentStep = instance.steps[instance.currentStep - 1];
    if (currentStep) {
      res.blank();
      res.line(`  다음 단계: ${instance.currentStep}/${instance.totalSteps}`);
      res.line(`  에이전트: ${currentStep.agent}`);
      res.line(`  작업: ${currentStep.action}`);
    }
  }

  if (instance.config.syncToOmc) {
    syncWorkflowToOmc(pRoot);
  }

  return res.toResult();
}

// === Abort ===

function handleAbort(pRoot: string, reason: string | undefined) {
  const engineResult = abortWorkflow(pRoot, reason);

  if (!engineResult.success) {
    return errorResult(engineResult.message);
  }

  const res = new McpResponseBuilder();
  res.header('워크플로우 중단');
  res.blank();
  res.warn(engineResult.message);

  if (engineResult.instance?.config.syncToOmc) {
    syncWorkflowToOmc(pRoot);
  }

  return res.toResult();
}

// === List ===

function handleList(pRoot: string) {
  const instances = listRecentWorkflows(pRoot);
  const res = new McpResponseBuilder();

  res.header('최근 워크플로우');
  res.blank();

  if (instances.length === 0) {
    res.info('워크플로우 이력이 없습니다.');
    res.blank();
    res.info('시작: harness_workflow({ action: "start", workflow: "feature" })');
    return res.toResult();
  }

  for (const inst of instances) {
    const statusTag = inst.status === 'completed' ? '[완료]'
      : inst.status === 'aborted' ? '[중단]'
      : inst.status === 'running' ? '[실행중]'
      : `[${inst.status}]`;
    res.line(`  ${statusTag} ${inst.id} — ${inst.workflowType} (${inst.currentStep}/${inst.totalSteps})`);
  }

  return res.toResult();
}

// === History ===

function handleHistory(pRoot: string) {
  const activeId = loadActiveWorkflowId(pRoot);
  if (!activeId) {
    return errorResult('활성 워크플로우가 없습니다.');
  }

  const history = loadWorkflowHistory(pRoot, activeId);
  const res = new McpResponseBuilder();

  res.header(`워크플로우 히스토리: ${activeId}`);
  res.blank();

  if (!history || history.events.length === 0) {
    res.info('이벤트 히스토리가 없습니다.');
    return res.toResult();
  }

  for (const event of history.events) {
    const time = event.timestamp.split('T')[1]?.split('.')[0] ?? event.timestamp;
    const dataStr = Object.entries(event.data)
      .filter(([, v]) => v !== '' && v !== undefined && (typeof v !== 'object' || Object.keys(v as Record<string, unknown>).length > 0))
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(', ');
    res.line(`  [${time}] ${event.type}${dataStr ? ` (${dataStr})` : ''}`);
  }

  return res.toResult();
}

// === 유틸 ===

function renderStepSummary(res: McpResponseBuilder, instance: WorkflowInstance): void {
  for (const step of instance.steps) {
    const statusIcon = step.status === 'completed' ? '완료'
      : step.status === 'running' ? '실행중'
      : step.status === 'failed' ? '실패'
      : step.status === 'skipped' ? '건너뜀'
      : step.status === 'waiting_checkpoint' ? '승인대기'
      : '대기';
    const optionalTag = step.optional ? ' (선택)' : '';
    const cpTag = step.checkpointApproved === true ? ' <- 체크포인트 승인됨'
      : step.checkpoint && step.status === 'waiting_checkpoint' ? ` <- 체크포인트: ${step.checkpoint}`
      : '';
    res.line(`  ${step.order}. [${statusIcon}] ${step.agent} — ${step.action}${optionalTag}${cpTag}`);
  }
}
