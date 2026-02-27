/**
 * 구현 준비 상태 검증 (Hybrid Enforcement)
 *
 * plan.md / todo.md 상태를 확인하여 구현 시작 전 워크플로우 준수 여부를 검증한다.
 * - plan 없이 구현 시도 → Hard (plan-gate 강제)
 * - plan DRAFT → 승인 먼저
 * - plan APPROVED + todo 없거나 stale → Soft (todo 작성 지시)
 * - 모두 갖춰짐 → 통과
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const IMPLEMENTATION_INTENT_PATTERNS: RegExp[] = [
  // EN: "implement the plan", "implement following plan"
  /\bimplement\s+(the\s+)?(following\s+)?plan\b/i,
  // EN: "execute the plan", "execute this plan"
  /\bexecute\s+(the\s+)?(this\s+)?(following\s+)?plan\b/i,
  // KR: "계획 구현/실행/진행"
  /(?:이|다음|위)\s*(?:계획|플랜).*(?:구현|실행|진행)/i,
  /(?:계획|플랜)\s*(?:을|를)?\s*(?:구현|실행|진행)/i,
  // KR: "plan 실행해줘", "플랜대로 구현"
  /plan\s*(?:을|를)?\s*(?:실행|구현|진행)/i,
  /(?:플랜|계획)\s*대로/i,
];

export type PlanStatus = 'NONE' | 'DRAFT' | 'APPROVED' | 'EXISTS';

export interface TodoStatus {
  exists: boolean;
  allDone: boolean;
  doneCount: number;
  totalCount: number;
}

export interface ReadinessCheckResult {
  status: 'pass' | 'force-plan-gate' | 'plan-not-approved' | 'todo-required' | 'todo-stale';
  message?: string;
}

export function getPlanStatus(cwd: string): PlanStatus {
  const paths = [join(cwd, '.agent', 'plan.md'), join(cwd, 'plan.md')];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, 'utf-8');
      if (/\bAPPROVED\b/.test(content)) return 'APPROVED';
      if (/\bDRAFT\b/.test(content)) return 'DRAFT';
      return 'EXISTS';
    } catch { continue; }
  }
  return 'NONE';
}

export function getTodoStatus(cwd: string): TodoStatus {
  const paths = [join(cwd, '.agent', 'todo.md'), join(cwd, 'todo.md')];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, 'utf-8');
      const done = (content.match(/\[x\]/gi) || []).length;
      const remaining = (content.match(/\[ \]/g) || []).length;
      const total = done + remaining;
      return { exists: true, allDone: total > 0 && remaining === 0, doneCount: done, totalCount: total };
    } catch { continue; }
  }
  return { exists: false, allDone: false, doneCount: 0, totalCount: 0 };
}

export function hasImplementationIntent(cleanPrompt: string): boolean {
  return IMPLEMENTATION_INTENT_PATTERNS.some(p => p.test(cleanPrompt));
}

/**
 * 구현 준비 상태를 검증하고 결과를 반환한다.
 * @param cleanPrompt - sanitized prompt (코드블록 제거 완료)
 * @param cwd - 프로젝트 루트
 */
export function checkImplementationReadiness(cleanPrompt: string, cwd: string): ReadinessCheckResult {
  // harness 설치 확인 (config 없으면 스킵)
  if (!existsSync(join(cwd, 'carpdm-harness.config.json'))) return { status: 'pass' };

  if (!hasImplementationIntent(cleanPrompt)) return { status: 'pass' };

  const planStatus = getPlanStatus(cwd);
  const todoStatus = getTodoStatus(cwd);

  // Case 1: plan 없이 구현 시도 → Hard: plan-gate 강제
  if (planStatus === 'NONE') {
    return { status: 'force-plan-gate' };
  }

  // Case 2: plan DRAFT → plan 승인 먼저
  if (planStatus === 'DRAFT') {
    return {
      status: 'plan-not-approved',
      message: `[WORKFLOW GUARD: PLAN NOT APPROVED]

plan.md가 DRAFT 상태입니다. 구현을 시작하기 전에:
1. plan.md를 검토하고 승인(APPROVED)으로 변경하세요
2. 승인 후 todo.md를 작성하세요
3. 그 후 구현을 시작하세요`,
    };
  }

  // Case 3: plan APPROVED + todo 없음 → Soft: todo 작성 지시
  if (!todoStatus.exists) {
    return {
      status: 'todo-required',
      message: `[WORKFLOW GUARD: TODO REQUIRED]

plan.md가 APPROVED 상태이지만 todo.md가 없습니다.
구현을 시작하기 전에:
1. plan.md의 구현 계획(Step)을 기반으로 .agent/todo.md를 작성하세요
2. 첫 번째 항목에 ← CURRENT 마커를 추가하세요
3. 그 후 Step 1부터 구현을 시작하세요`,
    };
  }

  // Case 3b: plan APPROVED + todo 전부 완료 → todo 갱신 지시
  if (todoStatus.allDone) {
    return {
      status: 'todo-stale',
      message: `[WORKFLOW GUARD: TODO STALE]

todo.md의 모든 항목이 완료되었습니다 (${todoStatus.doneCount}/${todoStatus.totalCount}).
새 구현 작업을 위해:
1. plan.md의 새 구현 계획을 기반으로 .agent/todo.md를 갱신하세요
2. 첫 번째 항목에 ← CURRENT 마커를 추가하세요
3. 그 후 Step 1부터 구현을 시작하세요`,
    };
  }

  // Case 4: 모든 준비 완료 → 통과
  return { status: 'pass' };
}
