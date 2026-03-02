/**
 * 워크플로우 ↔ .agent/ ↔ .knowledge/ 자동 동기화 유틸리티
 *
 * - startWorkflow 시: plan.md + todo.md 자동 생성, knowledge 브랜치 초기화
 * - advanceWorkflow 시: todo.md 진행 갱신 ([x] + ← CURRENT 마커)
 * - 기존 파일이 있으면 절대 덮어쓰지 않음 (보호)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { agentPlanPath, agentTodoPath } from './project-paths.js';
import { knowledgeDir } from './omc-compat.js';
import { createBranchKnowledge } from './knowledge-vault.js';
import type { WorkflowInstance, WorkflowContext } from '../types/workflow-engine.js';

// ===== plan.md 자동 생성 =====

export function generatePlanFromWorkflow(
  projectRoot: string,
  instance: WorkflowInstance,
  context?: WorkflowContext,
): { created: boolean; path: string } {
  const planPath = agentPlanPath(projectRoot);

  if (existsSync(planPath)) {
    return { created: false, path: planPath };
  }

  mkdirSync(dirname(planPath), { recursive: true });

  const description = context?.description || '(워크플로우에서 자동 생성됨)';
  const now = new Date().toISOString().slice(0, 10);

  const stepsSection = instance.steps
    .map((s) => {
      const cp = s.checkpoint ? ` → checkpoint: ${s.checkpoint}` : '';
      return `${s.order}. **${s.agent}** — ${s.action}${cp}`;
    })
    .join('\n');

  const content = `# Plan — ${instance.workflowType}: ${description}

> 상태: DRAFT
> 워크플로우: ${instance.workflowType} (${instance.id})
> 생성: ${now}

## 목표

${description}

## 구현 계획

${stepsSection}

## 검증

- [ ] 전체 워크플로우 단계 완료
- [ ] harness_verify_all 통과
`;

  writeFileSync(planPath, content, 'utf-8');
  return { created: true, path: planPath };
}

// ===== todo.md 자동 생성 =====

export function generateTodoFromWorkflow(
  projectRoot: string,
  instance: WorkflowInstance,
): { created: boolean; path: string } {
  const todoPath = agentTodoPath(projectRoot);

  if (existsSync(todoPath)) {
    return { created: false, path: todoPath };
  }

  mkdirSync(dirname(todoPath), { recursive: true });

  const lines: string[] = [
    `# Todo — ${instance.workflowType}`,
    `> 워크플로우: ${instance.id}`,
    '',
  ];

  for (const step of instance.steps) {
    const cp = step.checkpoint ? ` → checkpoint: ${step.checkpoint}` : '';
    const current = step.order === 1 ? ' ← CURRENT' : '';
    lines.push(`- [ ] Step ${step.order}: ${step.agent} — ${step.action}${cp}${current}`);
  }

  writeFileSync(todoPath, lines.join('\n') + '\n', 'utf-8');
  return { created: true, path: todoPath };
}

// ===== todo.md 진행 갱신 =====

export function syncTodoProgress(
  projectRoot: string,
  completedStep: number,
  nextStep?: number,
): { synced: boolean } {
  const todoPath = agentTodoPath(projectRoot);

  if (!existsSync(todoPath)) {
    return { synced: false };
  }

  let content: string;
  try {
    content = readFileSync(todoPath, 'utf-8');
  } catch {
    return { synced: false };
  }

  // Step {N}: 패턴 매칭하여 체크박스 갱신
  const stepPattern = new RegExp(`^(- \\[)( )(\\] Step ${completedStep}:.*)$`, 'm');
  if (!stepPattern.test(content)) {
    return { synced: false };
  }

  // 완료된 단계: [ ] → [x]
  content = content.replace(stepPattern, '$1x$3');

  // 기존 ← CURRENT 마커 제거
  content = content.replace(/ ← CURRENT/g, '');

  // 다음 단계에 ← CURRENT 마커 추가
  if (nextStep != null) {
    const nextPattern = new RegExp(`^(- \\[[ x]\\] Step ${nextStep}:.*)$`, 'm');
    content = content.replace(nextPattern, '$1 ← CURRENT');
  }

  // 모든 단계 완료 시 상태 표시
  if (nextStep == null) {
    if (!content.includes('> 상태: COMPLETED')) {
      content = content.replace(/^(# Todo .*)$/m, '$1\n> 상태: COMPLETED');
    }
  }

  writeFileSync(todoPath, content, 'utf-8');
  return { synced: true };
}

// ===== knowledge 브랜치 자동 초기화 =====

export function initKnowledgeBranch(
  projectRoot: string,
  branch: string,
): { created: boolean } {
  // .knowledge/ 디렉토리가 없으면 vault 미초기화 → 건너뜀
  if (!existsSync(knowledgeDir(projectRoot))) {
    return { created: false };
  }

  try {
    createBranchKnowledge(projectRoot, branch);
    return { created: true };
  } catch {
    return { created: false };
  }
}
