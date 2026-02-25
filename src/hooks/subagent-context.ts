import { readFileSync } from 'node:fs';
import {
  parseHookInput,
  outputResult,
  loadActiveWorkflowFromFiles,
  detectOmcMode,
  buildWorkflowSummary,
} from './hook-utils.js';
import type { WorkflowStateData, StepData } from './hook-utils.js';

interface SubagentStartInput {
  cwd?: string;
  session_id?: string;
  subagent_name?: string;
  subagent_type?: string;
  [key: string]: unknown;
}

function main(): void {
  let input: SubagentStartInput | null;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = parseHookInput<SubagentStartInput>(raw);
  } catch {
    outputResult('continue');
    return;
  }

  if (!input) {
    outputResult('continue');
    return;
  }

  const cwd = input.cwd || process.cwd();

  // 활성 워크플로우 로드
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (!instance || !instance.status || instance.status === 'completed' || instance.status === 'aborted') {
    outputResult('continue');
    return;
  }

  // OMC 모드 감지 - team/swarm/autopilot 모드에서는 가드 완화
  const omcMode = detectOmcMode(cwd);
  const relaxedModes = ['team', 'swarm', 'autopilot', 'ultrapilot', 'ralph', 'ultrawork'];
  const isRelaxed = omcMode !== null && relaxedModes.includes(omcMode);

  // 서브에이전트 이름 추출
  const subagentName = input.subagent_name || input.subagent_type || '';

  // 현재 단계 정보
  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps?.[currentStepIndex];

  if (!currentStep) {
    // 단계 정보 없으면 요약만 주입
    outputResult('continue', buildWorkflowSummary(instance));
    return;
  }

  // 서브에이전트와 현재 단계 에이전트 매칭
  const isMatched = matchSubagent(subagentName, currentStep);

  if (isMatched) {
    // 매칭: 상세 가이드 주입
    const context = buildDetailedGuide(instance, currentStep, omcMode, isRelaxed);
    outputResult('continue', context);
  } else {
    // 비매칭: 워크플로우 요약만 주입
    const summary = buildWorkflowSummary(instance);
    const omcHint = omcMode ? ` | OMC 모드: ${omcMode}` : '';
    outputResult('continue', summary + omcHint);
  }
}

/**
 * 서브에이전트 이름과 현재 단계 에이전트를 매칭합니다.
 */
function matchSubagent(subagentName: string, step: StepData): boolean {
  if (!subagentName || !step.agent) return false;

  const normalizedSubagent = subagentName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedAgent = step.agent.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 정확히 일치하거나 포함 관계
  return normalizedSubagent.includes(normalizedAgent) || normalizedAgent.includes(normalizedSubagent);
}

/**
 * 매칭된 서브에이전트를 위한 상세 가이드를 생성합니다.
 */
function buildDetailedGuide(
  instance: WorkflowStateData,
  step: StepData,
  omcMode: string | null,
  isRelaxed: boolean,
): string {
  const lines: string[] = [];

  lines.push(`[harness-workflow] 활성 워크플로우: ${instance.workflowType ?? '?'} (${instance.id ?? '?'})`);
  lines.push(`현재 단계: ${instance.currentStep}/${instance.totalSteps} - ${step.agent ?? '?'}`);
  lines.push(`작업: ${step.action ?? '?'}`);

  if (step.checkpoint) {
    lines.push(`체크포인트: ${step.checkpoint}`);
  }

  if (step.omcSkill) {
    lines.push(`OMC 스킬: ${step.omcSkill}`);
  }

  // 다음 단계 힌트
  const nextStepIndex = (instance.currentStep ?? 1);
  if (instance.steps && nextStepIndex < instance.steps.length) {
    const nextStep = instance.steps[nextStepIndex];
    const skillHint = nextStep.omcSkill ? ` -> ${nextStep.omcSkill}` : '';
    lines.push(`다음 단계: ${nextStep.agent ?? '?'} (${nextStep.action ?? '?'})${skillHint}`);
  }

  if (instance.status === 'waiting_checkpoint') {
    lines.push(`체크포인트 승인 대기: harness_workflow({ action: "approve" })`);
  } else if (instance.status === 'failed_step') {
    lines.push(`단계 실패 - 재시도: harness_workflow({ action: "retry" })`);
  } else {
    lines.push(`단계 완료 시: harness_workflow({ action: "advance" })`);
  }

  if (omcMode) {
    lines.push(`OMC 모드: ${omcMode}${isRelaxed ? ' (가드 완화)' : ''}`);
  }

  return lines.join('\n');
}

main();
