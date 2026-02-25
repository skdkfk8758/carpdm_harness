import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseHookInput,
  outputResult,
  loadActiveWorkflowFromFiles,
} from './hook-utils.js';
import type { StepData } from './hook-utils.js';

interface SubagentStopInput {
  cwd?: string;
  session_id?: string;
  subagent_name?: string;
  subagent_type?: string;
  subagent_result?: string;
  [key: string]: unknown;
}

function main(): void {
  let input: SubagentStopInput | null;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = parseHookInput<SubagentStopInput>(raw);
  } catch {
    outputResult('continue');
    return;
  }

  if (!input) {
    outputResult('continue');
    return;
  }

  const cwd = input.cwd || process.cwd();

  // 활성 워크플로우 확인
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (!instance || !instance.status || instance.status === 'completed' || instance.status === 'aborted') {
    outputResult('continue');
    return;
  }

  const subagentName = input.subagent_name || input.subagent_type || '';
  const sessionId = input.session_id || 'unknown';

  // 현재 단계 정보
  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps?.[currentStepIndex];

  if (!currentStep) {
    outputResult('continue');
    return;
  }

  // 서브에이전트 이름과 현재 단계 매칭
  const isMatched = matchSubagent(subagentName, currentStep);

  if (isMatched) {
    // 매칭 시 이벤트 JSONL 기록
    logSubagentEvent(cwd, sessionId, {
      type: 'subagent_complete',
      subagent: subagentName,
      workflowId: instance.id ?? 'unknown',
      step: instance.currentStep ?? 0,
      agent: currentStep.agent ?? '',
      action: currentStep.action ?? '',
    });

    // 다음 단계 힌트 주입
    const contextLines: string[] = [];
    contextLines.push(`[harness-workflow] 서브에이전트 완료: ${subagentName} (${currentStep.agent} — ${currentStep.action})`);

    if (currentStep.checkpoint) {
      contextLines.push(`체크포인트 승인이 필요합니다: ${currentStep.checkpoint}`);
      contextLines.push(`harness_workflow({ action: "approve" }) 또는 harness_workflow({ action: "reject" })`);
    } else {
      contextLines.push(`다음 단계로 진행하세요: harness_workflow({ action: "advance" })`);
    }

    // 다음 단계 정보
    const nextStepIndex = currentStepIndex + 1;
    if (instance.steps && nextStepIndex < instance.steps.length) {
      const nextStep = instance.steps[nextStepIndex];
      const skillHint = nextStep.omcSkill ? ` -> ${nextStep.omcSkill}` : '';
      contextLines.push(`다음 단계: ${nextStep.agent ?? '?'} (${nextStep.action ?? '?'})${skillHint}`);
    } else {
      contextLines.push(`마지막 단계입니다. advance 후 워크플로우가 완료됩니다.`);
    }

    outputResult('continue', contextLines.join('\n'));
  } else {
    // 비매칭: 기록 없이 진행
    outputResult('continue');
  }
}

/**
 * 서브에이전트 이름과 현재 단계 에이전트를 매칭합니다.
 */
function matchSubagent(subagentName: string, step: StepData): boolean {
  if (!subagentName || !step.agent) return false;

  const normalizedSubagent = subagentName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedAgent = step.agent.toLowerCase().replace(/[^a-z0-9]/g, '');

  return normalizedSubagent.includes(normalizedAgent) || normalizedAgent.includes(normalizedSubagent);
}

/**
 * 서브에이전트 이벤트를 JSONL 파일에 기록합니다.
 */
function logSubagentEvent(cwd: string, sessionId: string, data: Record<string, unknown>): void {
  const eventsDir = join(cwd, '.harness', 'events');

  try {
    mkdirSync(eventsDir, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      ...data,
      session: sessionId,
    };
    appendFileSync(join(eventsDir, `${sessionId}.jsonl`), JSON.stringify(entry) + '\n');
  } catch {
    // 기록 실패는 무시
  }
}

main();
