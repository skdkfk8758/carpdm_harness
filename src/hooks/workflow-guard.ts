import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { omcStateDir } from '../core/omc-compat.js';

interface HookInput {
  tool_name?: string;
  cwd?: string;
  [key: string]: unknown;
}

interface HookOutput {
  result: 'continue' | 'block';
  additionalContext?: string;
}

interface ActiveJson {
  activeWorkflowId?: string | null;
}

interface StepJson {
  order?: number;
  agent?: string;
  action?: string;
  status?: string;
  checkpoint?: string;
  omcSkill?: string;
  optional?: boolean;
}

interface StateJson {
  id?: string;
  workflowType?: string;
  status?: string;
  currentStep?: number;
  totalSteps?: number;
  steps?: StepJson[];
  config?: {
    guardLevel?: string;
  };
}

function main(): void {
  let input: HookInput;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = JSON.parse(raw) as HookInput;
  } catch {
    outputResult('continue');
    return;
  }

  const toolName = input.tool_name || '';
  const cwd = input.cwd || process.cwd();

  // 활성 워크플로우 확인
  const activePath = join(cwd, '.harness', 'workflows', 'active.json');
  if (!existsSync(activePath)) {
    // 활성 워크플로우 없으면 기존 OMC 모드 감지 로직 실행
    if (toolName === 'harness_workflow') {
      checkOmcActiveMode(cwd);
      return;
    }
    outputResult('continue');
    return;
  }

  let activeData: ActiveJson;
  try {
    activeData = JSON.parse(readFileSync(activePath, 'utf-8')) as ActiveJson;
  } catch {
    outputResult('continue');
    return;
  }

  const activeId = activeData.activeWorkflowId;
  if (!activeId) {
    // 활성 워크플로우 없음
    if (toolName === 'harness_workflow') {
      checkOmcActiveMode(cwd);
      return;
    }
    outputResult('continue');
    return;
  }

  // 활성 워크플로우 상태 읽기
  const statePath = join(cwd, '.harness', 'workflows', activeId, 'state.json');
  if (!existsSync(statePath)) {
    outputResult('continue');
    return;
  }

  let state: StateJson;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf-8')) as StateJson;
  } catch {
    outputResult('continue');
    return;
  }

  // 터미널 상태면 무시
  if (state.status === 'completed' || state.status === 'aborted') {
    outputResult('continue');
    return;
  }

  const guardLevel = state.config?.guardLevel ?? 'warn';
  if (guardLevel === 'off') {
    outputResult('continue');
    return;
  }

  // 현재 단계 정보
  const currentStepIndex = (state.currentStep ?? 1) - 1;
  const currentStep = state.steps?.[currentStepIndex];
  if (!currentStep) {
    outputResult('continue');
    return;
  }

  // 워크플로우 컨텍스트 주입
  const contextLines: string[] = [];
  contextLines.push(`[harness-workflow] 활성 워크플로우: ${state.workflowType ?? '?'} (${activeId})`);
  contextLines.push(`현재 단계: ${state.currentStep}/${state.totalSteps} - ${currentStep.agent ?? '?'} (${currentStep.action ?? '?'})`);

  if (currentStep.omcSkill) {
    contextLines.push(`OMC 스킬: ${currentStep.omcSkill}`);
  }

  // 다음 단계 힌트
  const nextStepIndex = currentStepIndex + 1;
  if (state.steps && nextStepIndex < state.steps.length) {
    const nextStep = state.steps[nextStepIndex];
    const skillHint = nextStep.omcSkill ? ` -> ${nextStep.omcSkill}` : '';
    contextLines.push(`다음 단계: ${nextStep.agent ?? '?'} (${nextStep.action ?? '?'})${skillHint}`);
  }

  if (state.status === 'waiting_checkpoint') {
    contextLines.push(`체크포인트 승인 대기: ${currentStep.checkpoint ?? '?'}`);
    contextLines.push(`승인: harness_workflow({ action: "approve" })`);
    contextLines.push(`거부: harness_workflow({ action: "reject" })`);
  } else if (state.status === 'failed_step') {
    contextLines.push(`단계 실패 - 재시도: harness_workflow({ action: "retry" })`);
    contextLines.push(`건너뛰기: harness_workflow({ action: "skip" })`);
  } else {
    contextLines.push(`단계 완료 시: harness_workflow({ action: "advance" })`);
  }

  // guardLevel: block일 때 harness_ 및 Claude Code 기본 도구 외의 도구 호출 시 차단
  const CLAUDE_BUILTIN_TOOLS = new Set([
    'Bash', 'Read', 'Edit', 'Write', 'MultiEdit',
    'Glob', 'Grep', 'WebFetch', 'WebSearch',
    'Task', 'TodoWrite', 'AskUserQuestion',
    'Skill', 'NotebookEdit',
  ]);

  if (guardLevel === 'block' && !toolName.startsWith('harness_') && !CLAUDE_BUILTIN_TOOLS.has(toolName)) {
    outputResult('block', contextLines.join('\n'));
    return;
  }

  outputResult('continue', contextLines.join('\n'));
}

function checkOmcActiveMode(cwd: string): void {
  const stateDirPath = omcStateDir(cwd);
  if (!existsSync(stateDirPath)) {
    outputResult('continue');
    return;
  }

  try {
    const stateFiles = readdirSync(stateDirPath)
      .filter(f => f.endsWith('-state.json'));

    for (const file of stateFiles) {
      try {
        const state = JSON.parse(readFileSync(join(stateDirPath, file), 'utf-8'));
        if (state.active) {
          const mode = file.replace('-state.json', '');
          outputResult(
            'continue',
            `[harness-workflow-guard] OMC '${mode}' 모드가 활성 상태입니다. 워크플로우 실행 시 모드 충돌에 주의하세요.`
          );
          return;
        }
      } catch {
        // 개별 파일 파싱 실패 무시
      }
    }
  } catch {
    // 디렉토리 읽기 실패 무시
  }

  outputResult('continue');
}

function outputResult(result: 'continue' | 'block', additionalContext?: string): void {
  const output: HookOutput = { result };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}

main();
