import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// === 공통 인터페이스 ===

export interface HookOutput {
  result: 'continue' | 'block';
  additionalContext?: string;
}

export interface ActiveWorkflowData {
  activeWorkflowId?: string | null;
  startedAt?: string;
}

export interface StepData {
  order?: number;
  agent?: string;
  action?: string;
  status?: string;
  checkpoint?: string;
  omcSkill?: string;
  optional?: boolean;
}

export interface WorkflowStateData {
  id?: string;
  workflowType?: string;
  status?: string;
  currentStep?: number;
  totalSteps?: number;
  steps?: StepData[];
  config?: {
    guardLevel?: string;
    autoAdvance?: boolean;
    syncToOmc?: boolean;
  };
  context?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// === 공통 유틸 함수 ===

/**
 * stdin에서 JSON을 파싱합니다.
 */
export function parseHookInput<T = Record<string, unknown>>(stdin: string): T | null {
  try {
    return JSON.parse(stdin) as T;
  } catch {
    return null;
  }
}

/**
 * 훅 결과를 stdout으로 출력합니다.
 */
export function outputResult(result: 'continue' | 'block', additionalContext?: string): void {
  const output: HookOutput = { result };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}

/**
 * 활성 워크플로우와 인스턴스 상태를 파일에서 읽습니다.
 */
export function loadActiveWorkflowFromFiles(cwd: string): {
  active: ActiveWorkflowData | null;
  instance: WorkflowStateData | null;
} {
  const activePath = join(cwd, '.harness', 'workflows', 'active.json');
  if (!existsSync(activePath)) {
    return { active: null, instance: null };
  }

  let activeData: ActiveWorkflowData;
  try {
    activeData = JSON.parse(readFileSync(activePath, 'utf-8')) as ActiveWorkflowData;
  } catch {
    return { active: null, instance: null };
  }

  const activeId = activeData.activeWorkflowId;
  if (!activeId) {
    return { active: activeData, instance: null };
  }

  const statePath = join(cwd, '.harness', 'workflows', activeId, 'state.json');
  if (!existsSync(statePath)) {
    return { active: activeData, instance: null };
  }

  try {
    const instance = JSON.parse(readFileSync(statePath, 'utf-8')) as WorkflowStateData;
    return { active: activeData, instance };
  } catch {
    return { active: activeData, instance: null };
  }
}

/**
 * OMC 활성 모드를 감지합니다.
 */
export function detectOmcMode(cwd: string): string | null {
  const omcStateDir = join(cwd, '.omc', 'state');
  if (!existsSync(omcStateDir)) return null;

  try {
    const stateFiles = readdirSync(omcStateDir).filter(f => f.endsWith('-state.json'));
    for (const file of stateFiles) {
      try {
        const state = JSON.parse(readFileSync(join(omcStateDir, file), 'utf-8')) as { active?: boolean };
        if (state.active) {
          return file.replace('-state.json', '');
        }
      } catch {
        // 개별 파일 파싱 실패 무시
      }
    }
  } catch {
    // 디렉토리 읽기 실패 무시
  }

  return null;
}

/**
 * 팀 메모리에서 conventions를 읽습니다.
 */
export function readTeamMemoryConventions(cwd: string, limit = 5): string[] {
  const teamMemoryPath = join(cwd, '.harness', 'team-memory.json');
  if (!existsSync(teamMemoryPath)) return [];

  try {
    const teamMemory = JSON.parse(readFileSync(teamMemoryPath, 'utf-8'));
    if (!teamMemory.conventions || !Array.isArray(teamMemory.conventions)) return [];

    return teamMemory.conventions
      .slice(0, limit)
      .map((c: Record<string, unknown>) => String(c.title || c.content || ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * capabilities 캐시에서 감지된 도구 목록을 읽습니다.
 */
export function readDetectedCapabilities(cwd: string): string[] {
  const capabilitiesPath = join(cwd, '.harness', 'capabilities.json');
  if (!existsSync(capabilitiesPath)) return [];

  try {
    const caps = JSON.parse(readFileSync(capabilitiesPath, 'utf-8'));
    const tools = caps.tools || {};
    return Object.entries(tools)
      .filter(([, v]) => (v as Record<string, unknown>).detected)
      .map(([k]) => k);
  } catch {
    return [];
  }
}

/**
 * 워크플로우 상태 요약 문자열을 생성합니다.
 */
export function buildWorkflowSummary(instance: WorkflowStateData): string {
  const lines: string[] = [];
  lines.push(`[harness-workflow] ${instance.workflowType ?? '?'} (${instance.id ?? '?'})`);
  lines.push(`상태: ${instance.status ?? '?'} | 진행: ${instance.currentStep ?? '?'}/${instance.totalSteps ?? '?'}`);

  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps?.[currentStepIndex];
  if (currentStep) {
    lines.push(`현재 단계: ${currentStep.agent ?? '?'} — ${currentStep.action ?? '?'}`);
    if (currentStep.omcSkill) {
      lines.push(`OMC 스킬: ${currentStep.omcSkill}`);
    }
  }

  return lines.join(' | ');
}
