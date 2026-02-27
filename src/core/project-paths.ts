/**
 * 프로젝트 레벨 경로 빌더
 *
 * .agent/ 하위 파일 경로를 중앙화합니다.
 * omc-compat.ts가 .omc/ + .harness/ 경로를 관리하는 것처럼,
 * 이 모듈은 .agent/ 경로만 관리합니다.
 *
 * 규칙:
 * - 새 .agent/ 경로 추가 시 이 파일에만 추가
 * - 다른 모듈에서 .agent/ 경로를 직접 하드코딩하지 않음
 */

import { join } from 'node:path';

// ============================================================
// .agent/ 루트
// ============================================================

/** .agent/ 디렉토리 */
export function agentDir(projectRoot: string): string {
  return join(projectRoot, '.agent');
}

// ============================================================
// 워크플로우 파일 (.agent/plan.md, .agent/todo.md 등)
// ============================================================

/** .agent/plan.md */
export function agentPlanPath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'plan.md');
}

/** plan.md (루트 fallback) */
export function rootPlanPath(projectRoot: string): string {
  return join(projectRoot, 'plan.md');
}

/** plan.md 탐색 경로 (우선순위 순) */
export function planSearchPaths(projectRoot: string): string[] {
  return [agentPlanPath(projectRoot), rootPlanPath(projectRoot)];
}

/** .agent/todo.md */
export function agentTodoPath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'todo.md');
}

/** todo.md (루트 fallback) */
export function rootTodoPath(projectRoot: string): string {
  return join(projectRoot, 'todo.md');
}

/** todo.md 탐색 경로 (우선순위 순) */
export function todoSearchPaths(projectRoot: string): string[] {
  return [agentTodoPath(projectRoot), rootTodoPath(projectRoot)];
}

/** .agent/context.md */
export function agentContextPath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'context.md');
}

/** .agent/lessons.md */
export function agentLessonsPath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'lessons.md');
}

/** .agent/memory.md */
export function agentMemoryPath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'memory.md');
}

/** .agent/session-log.md */
export function agentSessionLogPath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'session-log.md');
}

/** .agent/handoff.md */
export function agentHandoffPath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'handoff.md');
}

// ============================================================
// 온톨로지 (.agent/ontology/)
// ============================================================

/** .agent/ontology/ 디렉토리 */
export function agentOntologyDir(projectRoot: string): string {
  return join(projectRoot, '.agent', 'ontology');
}

/** .agent/ontology/ONTOLOGY-INDEX.md */
export function agentOntologyIndexPath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'ontology', 'ONTOLOGY-INDEX.md');
}

/** .agent/ontology/ONTOLOGY-DOMAIN.md */
export function agentOntologyDomainPath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'ontology', 'ONTOLOGY-DOMAIN.md');
}

/** .agent/ontology/.cache/ 디렉토리 */
export function agentOntologyCacheDir(projectRoot: string): string {
  return join(projectRoot, '.agent', 'ontology', '.cache');
}

/** .agent/ontology/.cache/domain-cache.json */
export function agentDomainCachePath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'ontology', '.cache', 'domain-cache.json');
}
