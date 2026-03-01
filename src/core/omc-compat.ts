/**
 * OMC 호환성 레이어
 *
 * 모든 OMC 참조(경로, 모드, 에이전트/스킬 매핑)를 중앙화하여
 * 하드코딩을 제거하고 OMC 버전 변경에 대한 적응력을 확보합니다.
 *
 * 규칙:
 * - OMC 공유 상태 (.omc/) → OMC가 읽는 파일은 이 경로에 유지
 * - Harness 전용 상태 (.harness/) → harness만 사용하는 파일
 */

import { join } from 'node:path';
import { homedir } from 'node:os';

// ============================================================
// OMC 모드 상수
// ============================================================

/** 모든 OMC 실행 모드 */
export const OMC_MODES = [
  'ralph', 'ralph-todo', 'autopilot', 'ultrapilot', 'ultrawork',
  'ecomode', 'pipeline', 'swarm', 'ultraqa', 'team',
] as const;
export type OmcMode = (typeof OMC_MODES)[number];

/** 영속 모드 (session-end에서 종료 차단) */
export const OMC_PERSISTENT_MODES = [
  'ralph', 'ralph-todo', 'autopilot', 'ultrapilot', 'ultrawork',
  'ecomode', 'pipeline', 'swarm', 'ultraqa',
] as const;

/** OMC가 계획을 관리하는 모드 (plan-guard 완화) */
export const OMC_PLANNING_MODES = [
  'autopilot', 'ralph', 'ultrapilot', 'ultrawork',
] as const;

/** 팀 계열 모드 (차단 훅 비활성화, 로깅만) */
export const OMC_TEAM_MODES = ['team', 'swarm', 'ultrapilot'] as const;

/** 키워드 감지 시 state 파일을 생성하는 모드 */
export const OMC_STATEFUL_MODES = [
  'ralph', 'ralph-todo', 'autopilot', 'team', 'ultrawork', 'ecomode',
] as const;

/** cancel 시 삭제하는 모드 state 파일 */
export const OMC_CANCEL_MODES = [
  'ralph', 'ralph-todo', 'autopilot', 'team', 'ultrawork', 'ecomode', 'pipeline',
] as const;

/** 키워드 충돌 해소 우선순위 */
export const OMC_KEYWORD_PRIORITY = [
  'cancel', 'ralph-todo', 'ralph', 'autopilot', 'team', 'ultrawork', 'ecomode',
  'pipeline', 'ralplan', 'plan', 'tdd', 'research', 'ultrathink',
  'deepsearch', 'analyze', 'codex', 'gemini',
] as const;

// ============================================================
// OMC 경로 빌더 — 공유 상태 (.omc/)
// ============================================================

/** OMC 로컬 디렉토리 */
export function omcDir(projectRoot: string): string {
  return join(projectRoot, '.omc');
}

/** OMC state 디렉토리 (로컬) */
export function omcStateDir(projectRoot: string): string {
  return join(projectRoot, '.omc', 'state');
}

/** OMC state 디렉토리 (글로벌) */
export function omcGlobalStateDir(): string {
  return join(homedir(), '.omc', 'state');
}

/** 모드 state 파일 (로컬) */
export function omcStatePath(projectRoot: string, mode: string): string {
  return join(projectRoot, '.omc', 'state', `${mode}-state.json`);
}

/** 모드 state 파일 (글로벌) */
export function omcGlobalStatePath(mode: string): string {
  return join(homedir(), '.omc', 'state', `${mode}-state.json`);
}

/** 세션 범위 state 디렉토리 */
export function omcSessionStateDir(projectRoot: string, sessionId: string): string {
  return join(projectRoot, '.omc', 'state', 'sessions', sessionId);
}

/** 프로젝트 메모리 파일 */
export function omcProjectMemoryPath(projectRoot: string): string {
  return join(projectRoot, '.omc', 'project-memory.json');
}

/** 노트패드 파일 */
export function omcNotepadPath(projectRoot: string): string {
  return join(projectRoot, '.omc', 'notepad.md');
}

/** 워크플로우 state 파일 */
export function omcWorkflowStatePath(projectRoot: string): string {
  return join(projectRoot, '.omc', 'state', 'workflow-state.json');
}

/** OMC 글로벌 설정 파일 (~/.claude/.omc-config.json) */
export function omcConfigPath(): string {
  return join(homedir(), '.claude', '.omc-config.json');
}

/** swarm 마커 파일 */
export function omcSwarmMarkerPath(projectRoot: string): string {
  return join(projectRoot, '.omc', 'state', 'swarm-active.marker');
}

/** swarm summary 파일 */
export function omcSwarmSummaryPath(projectRoot: string): string {
  return join(projectRoot, '.omc', 'state', 'swarm-summary.json');
}

/** todos 파일 (프로젝트 로컬) */
export function omcTodosPath(projectRoot: string): string {
  return join(projectRoot, '.omc', 'todos.json');
}

// ============================================================
// Harness 경로 빌더 — 전용 상태 (.harness/)
// ============================================================

/** Harness state 디렉토리 */
export function harnessStateDir(projectRoot: string): string {
  return join(projectRoot, '.harness', 'state');
}

/** 도구 실패 추적 파일 (harness 전용) */
export function harnessToolErrorPath(projectRoot: string): string {
  return join(projectRoot, '.harness', 'state', 'last-tool-error.json');
}

/** 업데이트 체크 캐시 (harness 전용, 글로벌) */
export function harnessUpdateCheckPath(): string {
  return join(homedir(), '.harness', 'update-check.json');
}

/** MCP 프롬프트 로그 디렉토리 (harness 전용) */
export function harnessPromptsDir(projectRoot: string): string {
  return join(projectRoot, '.harness', 'prompts');
}

/** 온보딩 마커 파일 */
export function harnessOnboardedMarkerPath(projectRoot: string): string {
  return join(projectRoot, '.harness', 'state', 'onboarded');
}

/** 캐싱된 capabilities 파일 */
export function harnessCapabilitiesPath(projectRoot: string): string {
  return join(projectRoot, '.harness', 'capabilities.json');
}

/** 팀 메모리 파일 */
export function harnessTeamMemoryPath(projectRoot: string): string {
  return join(projectRoot, '.harness', 'team-memory.json');
}

// ============================================================
// OMC 에이전트 & 스킬 매핑
// ============================================================

/** OMC 에이전트 타입 접두사 (Task tool용) */
export const OMC_AGENT_PREFIX = 'oh-my-claudecode:' as const;

/** OMC 스킬 호출 접두사 */
export const OMC_SKILL_PREFIX = '/oh-my-claudecode:' as const;

/** OMC cancel 스킬 전체 이름 */
export const OMC_CANCEL_SKILL = '/oh-my-claudecode:cancel' as const;

/** 에이전트 역할별 스킬 이름 */
export const OMC_SKILLS = {
  analyze: '/oh-my-claudecode:analyze',
  plan: '/oh-my-claudecode:plan',
  autopilot: '/oh-my-claudecode:autopilot',
  tdd: '/oh-my-claudecode:tdd',
  'git-master': '/oh-my-claudecode:git-master',
  deepsearch: '/oh-my-claudecode:deepsearch',
  'code-review': '/oh-my-claudecode:code-review',
  'security-review': '/oh-my-claudecode:security-review',
  cancel: '/oh-my-claudecode:cancel',
} as const;

/** 에이전트 → 스킬 + 모델 매핑 */
export const AGENT_SKILL_MAP: Record<string, { skill?: string; model: string }> = {
  analyst:             { skill: OMC_SKILLS.analyze,              model: 'opus' },
  planner:             { skill: OMC_SKILLS.plan,                 model: 'opus' },
  architect:           { skill: undefined,                       model: 'opus' },
  executor:            { skill: OMC_SKILLS.autopilot,            model: 'sonnet' },
  'deep-executor':     { skill: OMC_SKILLS.autopilot,            model: 'opus' },
  'test-engineer':     { skill: OMC_SKILLS.tdd,                  model: 'sonnet' },
  verifier:            { skill: undefined,                       model: 'sonnet' },
  'git-master':        { skill: OMC_SKILLS['git-master'],        model: 'sonnet' },
  explore:             { skill: OMC_SKILLS.deepsearch,            model: 'haiku' },
  debugger:            { skill: OMC_SKILLS.analyze,              model: 'sonnet' },
  'quality-reviewer':  { skill: OMC_SKILLS['code-review'],       model: 'sonnet' },
  'security-reviewer': { skill: OMC_SKILLS['security-review'],   model: 'sonnet' },
  'qa-tester':         { skill: undefined,                       model: 'sonnet' },
};

/** MCP 위임 프로바이더 키워드 */
export const MCP_DELEGATION_KEYWORDS = ['codex', 'gemini'] as const;

// ============================================================
// OMC 패키지 정보
// ============================================================

/** npm 패키지 이름 */
export const OMC_NPM_PACKAGE = 'oh-my-claude-sisyphus' as const;

/** npm 레지스트리 URL (버전 체크용) */
export const OMC_REGISTRY_URL = `https://registry.npmjs.org/${OMC_NPM_PACKAGE}/latest` as const;

/** carpdm-harness npm 패키지 이름 */
export const HARNESS_NPM_PACKAGE = 'carpdm-harness' as const;

/** carpdm-harness npm 레지스트리 URL (버전 체크용) */
export const HARNESS_REGISTRY_URL = `https://registry.npmjs.org/${HARNESS_NPM_PACKAGE}/latest` as const;
