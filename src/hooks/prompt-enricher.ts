import { readFileSync } from 'node:fs';
import {
  parseHookInput,
  outputResult,
  loadActiveWorkflowFromFiles,
  detectOmcMode,
} from './hook-utils.js';
import type { WorkflowStateData } from './hook-utils.js';

interface PromptEnricherInput {
  cwd?: string;
  [key: string]: unknown;
}

function main(): void {
  let input: PromptEnricherInput | null;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = parseHookInput<PromptEnricherInput>(raw);
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

  const contextLines: string[] = [];

  // 1. 워크플로우 상태 요약
  contextLines.push(`[harness-workflow] ${instance.workflowType ?? '?'} (${instance.id ?? '?'})`);
  contextLines.push(`진행: ${instance.currentStep ?? '?'}/${instance.totalSteps ?? '?'} | 상태: ${instance.status}`);

  // 현재 단계 정보
  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps?.[currentStepIndex];
  if (currentStep) {
    contextLines.push(`현재: ${currentStep.agent ?? '?'} — ${currentStep.action ?? '?'}`);

    // 다음 액션 힌트
    if (instance.status === 'waiting_checkpoint') {
      contextLines.push(`[ACTION] 체크포인트 승인 대기: ${currentStep.checkpoint ?? '?'} -> harness_workflow({ action: "approve" })`);
    } else if (instance.status === 'failed_step') {
      contextLines.push(`[ACTION] 단계 실패 -> harness_workflow({ action: "retry" }) 또는 harness_workflow({ action: "skip" })`);
    } else {
      // 다음 단계 힌트
      const nextStepIndex = currentStepIndex + 1;
      if (instance.steps && nextStepIndex < instance.steps.length) {
        const nextStep = instance.steps[nextStepIndex];
        const skillHint = nextStep.omcSkill ? ` (${nextStep.omcSkill})` : '';
        contextLines.push(`다음: ${nextStep.agent ?? '?'} — ${nextStep.action ?? '?'}${skillHint}`);
      }
      contextLines.push(`단계 완료 시: harness_workflow({ action: "advance" })`);
    }
  }

  // 2. 미해결 체크포인트/실패 단계 경고
  const warnings = buildStepWarnings(instance);
  if (warnings.length > 0) {
    contextLines.push(...warnings);
  }

  // 3. OMC 활성 모드 감지
  const omcMode = detectOmcMode(cwd);
  if (omcMode) {
    contextLines.push(`OMC 모드: ${omcMode}`);
  }

  outputResult('continue', contextLines.join('\n'));
}

/**
 * 미해결 체크포인트나 실패 단계에 대한 경고를 생성합니다.
 */
function buildStepWarnings(instance: WorkflowStateData): string[] {
  const warnings: string[] = [];

  if (!instance.steps) return warnings;

  for (const step of instance.steps) {
    if (step.status === 'waiting_checkpoint') {
      warnings.push(`[WARN] 체크포인트 대기 중: 단계 ${step.order} (${step.agent}) — ${step.checkpoint ?? '?'}`);
    }
    if (step.status === 'failed') {
      warnings.push(`[WARN] 실패 단계: 단계 ${step.order} (${step.agent}) — ${step.action}`);
    }
  }

  return warnings;
}

main();
