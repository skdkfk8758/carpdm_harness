import { readFileSync } from 'node:fs';
import {
  parseHookInput,
  outputResult,
  loadActiveWorkflowFromFiles,
  readTeamMemoryConventions,
  readDetectedCapabilities,
} from './hook-utils.js';
import type { WorkflowStateData, StepData } from './hook-utils.js';

interface PreCompactInput {
  cwd?: string;
  [key: string]: unknown;
}

function main(): void {
  let input: PreCompactInput | null;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = parseHookInput<PreCompactInput>(raw);
  } catch {
    outputResult('continue');
    return;
  }

  if (!input) {
    outputResult('continue');
    return;
  }

  const cwd = input.cwd || process.cwd();
  const sections: string[] = [];

  // 1. 활성 워크플로우 전체 상태 직렬화
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (instance && instance.status && instance.status !== 'completed' && instance.status !== 'aborted') {
    sections.push(serializeWorkflowState(instance));
  }

  // 2. 팀 메모리 conventions 상위 5개
  const conventions = readTeamMemoryConventions(cwd, 5);
  if (conventions.length > 0) {
    const convSection = ['[harness-conventions]', ...conventions.map((c, i) => `  ${i + 1}. ${c}`)];
    sections.push(convSection.join('\n'));
  }

  // 3. capabilities 요약
  const capabilities = readDetectedCapabilities(cwd);
  if (capabilities.length > 0) {
    sections.push(`[harness-capabilities] 감지된 도구: ${capabilities.join(', ')}`);
  }

  // 아무 정보도 없으면 컨텍스트 주입 없이 진행
  if (sections.length === 0) {
    outputResult('continue');
    return;
  }

  outputResult('continue', sections.join('\n\n'));
}

/**
 * 워크플로우 상태를 압축 친화적으로 직렬화합니다.
 */
function serializeWorkflowState(instance: WorkflowStateData): string {
  const lines: string[] = [];

  lines.push(`[harness-workflow-state] 압축 전 워크플로우 컨텍스트 보존`);
  lines.push(`ID: ${instance.id ?? '?'}`);
  lines.push(`타입: ${instance.workflowType ?? '?'}`);
  lines.push(`상태: ${instance.status ?? '?'}`);
  lines.push(`진행: ${instance.currentStep ?? '?'}/${instance.totalSteps ?? '?'}`);

  if (instance.steps && instance.steps.length > 0) {
    lines.push('단계 상태:');
    for (const step of instance.steps) {
      lines.push(formatStepLine(step));
    }
  }

  if (instance.config?.guardLevel) {
    lines.push(`가드: ${instance.config.guardLevel}`);
  }

  return lines.join('\n');
}

/**
 * 단계 상태를 한 줄로 포맷합니다.
 */
function formatStepLine(step: StepData): string {
  const statusIcon = step.status === 'completed' ? 'OK'
    : step.status === 'running' ? 'RUN'
    : step.status === 'failed' ? 'FAIL'
    : step.status === 'skipped' ? 'SKIP'
    : step.status === 'waiting_checkpoint' ? 'WAIT'
    : 'PEND';
  const optionalTag = step.optional ? ' (opt)' : '';
  const cpTag = step.checkpoint ? ` [cp: ${step.checkpoint}]` : '';
  return `  ${step.order ?? '?'}. [${statusIcon}] ${step.agent ?? '?'} — ${step.action ?? '?'}${optionalTag}${cpTag}`;
}

main();
