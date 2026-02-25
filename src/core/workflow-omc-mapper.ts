import type { StepState, WorkflowInstance } from '../types/workflow-engine.js';
import { writeOmcProjectMemory, readOmcProjectMemory } from './omc-bridge.js';

export interface OmcAction {
  skill?: string;
  agent: string;
  description: string;
  capabilities?: string[];
}

const AGENT_SKILL_MAP: Record<string, { skill?: string; model: string }> = {
  analyst:              { skill: '/oh-my-claudecode:analyze',          model: 'opus' },
  planner:              { skill: '/oh-my-claudecode:plan',             model: 'opus' },
  architect:            { skill: undefined,                            model: 'opus' },
  executor:             { skill: '/oh-my-claudecode:autopilot',        model: 'sonnet' },
  'deep-executor':      { skill: '/oh-my-claudecode:autopilot',        model: 'opus' },
  'test-engineer':      { skill: '/oh-my-claudecode:tdd',              model: 'sonnet' },
  verifier:             { skill: undefined,                            model: 'sonnet' },
  'git-master':         { skill: '/oh-my-claudecode:git-master',       model: 'sonnet' },
  explore:              { skill: '/oh-my-claudecode:deepsearch',        model: 'haiku' },
  debugger:             { skill: '/oh-my-claudecode:analyze',          model: 'sonnet' },
  'quality-reviewer':   { skill: '/oh-my-claudecode:code-review',      model: 'sonnet' },
  'security-reviewer':  { skill: '/oh-my-claudecode:security-review',  model: 'sonnet' },
  'qa-tester':          { skill: undefined,                            model: 'sonnet' },
};

/**
 * 파이프라인 단계에 대응하는 OMC 액션을 결정합니다.
 */
export function resolveOmcAction(step: StepState): OmcAction {
  // step.omcSkill이 있으면 해당 스킬 사용
  if (step.omcSkill) {
    return {
      skill: step.omcSkill,
      agent: step.agent,
      description: step.action,
    };
  }

  // AGENT_SKILL_MAP에서 조회
  const mapping = AGENT_SKILL_MAP[step.agent];
  if (mapping?.skill) {
    return {
      skill: mapping.skill,
      agent: step.agent,
      description: step.action,
    };
  }

  // 스킬이 없는 에이전트는 수동 액션
  return {
    agent: step.agent,
    description: step.action,
  };
}

/**
 * 워크플로우 인스턴스 상태를 OMC project-memory에 동기화합니다.
 */
export function syncWorkflowStateToOmc(
  projectRoot: string,
  instance: WorkflowInstance,
): void {
  try {
    const omcMemory = readOmcProjectMemory(projectRoot) ?? {};
    const existingNotes = (omcMemory.notes as string) ?? '';

    // [workflow] 접두사가 붙은 기존 노트 제거
    const noteLines = existingNotes.split('\n').filter(Boolean);
    const filteredNotes = noteLines.filter(
      (line) => !line.startsWith('[workflow] '),
    );

    // 현재 상태를 새 노트로 추가
    const currentStep = instance.steps[instance.currentStep - 1];
    const statusNote = `[workflow] ${instance.workflowType}: step ${instance.currentStep}/${instance.totalSteps} ${instance.status} - ${currentStep?.agent ?? '?'} ${currentStep?.action ?? '?'}`;
    filteredNotes.push(statusNote);

    // 완료/중단 시 최종 상태 기록
    if (instance.status === 'completed') {
      // 기존 [workflow-completed] 항목은 최대 5개 유지
      const completedNotes = filteredNotes.filter((line) =>
        line.startsWith('[workflow-completed]') || line.startsWith('[workflow-aborted]'),
      );
      const otherNotes = filteredNotes.filter((line) =>
        !line.startsWith('[workflow-completed]') && !line.startsWith('[workflow-aborted]'),
      );

      // 5개 초과 시 오래된 것 제거
      while (completedNotes.length >= 5) {
        completedNotes.shift();
      }

      completedNotes.push(`[workflow-completed] ${instance.workflowType} (${instance.id}): ${instance.totalSteps}단계 완료`);

      // [workflow] 현재 상태는 제거 (완료됨)
      const finalNotes = [
        ...otherNotes.filter((line) => !line.startsWith('[workflow] ')),
        ...completedNotes,
      ];

      omcMemory.notes = finalNotes.filter(Boolean).join('\n');
    } else if (instance.status === 'aborted') {
      const completedNotes = filteredNotes.filter((line) =>
        line.startsWith('[workflow-completed]') || line.startsWith('[workflow-aborted]'),
      );
      const otherNotes = filteredNotes.filter((line) =>
        !line.startsWith('[workflow-completed]') && !line.startsWith('[workflow-aborted]'),
      );

      while (completedNotes.length >= 5) {
        completedNotes.shift();
      }

      completedNotes.push(`[workflow-aborted] ${instance.workflowType} (${instance.id}): 단계 ${instance.currentStep}에서 중단`);

      const finalNotes = [
        ...otherNotes.filter((line) => !line.startsWith('[workflow] ')),
        ...completedNotes,
      ];

      omcMemory.notes = finalNotes.filter(Boolean).join('\n');
    } else {
      omcMemory.notes = filteredNotes.filter(Boolean).join('\n');
    }

    writeOmcProjectMemory(projectRoot, omcMemory);
  } catch {
    // OMC 동기화 실패는 무시
  }
}

/**
 * OMC 에이전트 힌트 문자열을 생성합니다.
 */
export function buildOmcAgentHint(
  step: StepState,
  workflowType: string,
): string {
  const omcAction = resolveOmcAction(step);
  const lines: string[] = [];

  lines.push(`[harness-workflow] 활성 워크플로우: ${workflowType}`);
  lines.push(`현재 단계: ${step.order} - ${step.agent} (${step.action})`);

  if (omcAction.skill) {
    lines.push(`OMC 스킬: ${omcAction.skill}`);
  } else {
    lines.push(`수동 실행: ${step.agent} 에이전트에게 위임하세요`);
  }

  if (step.checkpoint) {
    lines.push(`체크포인트: ${step.checkpoint}`);
  }

  lines.push(`단계 완료 시: harness_workflow({ action: "advance" })`);

  return lines.join('\n');
}
