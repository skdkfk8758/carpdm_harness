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
import { existsSync, readFileSync } from 'node:fs';

import type { McpResponseBuilder } from '../types/mcp.js';

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
// Knowledge Vault 경로 빌더 — 로컬 지식 베이스 (.knowledge/)
// ============================================================

/** 브랜치명을 디렉토리 안전한 이름으로 변환 (feat/42-login → feat-42-login) */
export function sanitizeBranchName(branch: string): string {
  return branch.replace(/\//g, '-');
}

/** Knowledge Vault 루트 디렉토리 */
export function knowledgeDir(projectRoot: string): string {
  return join(projectRoot, '.knowledge');
}

/** 브랜치별 작업 문서 디렉토리 */
export function knowledgeBranchesDir(projectRoot: string): string {
  return join(projectRoot, '.knowledge', 'branches');
}

/** 특정 브랜치의 작업 문서 디렉토리 */
export function knowledgeBranchDir(projectRoot: string, branch: string): string {
  return join(projectRoot, '.knowledge', 'branches', sanitizeBranchName(branch));
}

/** 완료된 브랜치 아카이브 디렉토리 */
export function knowledgeArchiveDir(projectRoot: string): string {
  return join(projectRoot, '.knowledge', 'branches', '_archive');
}

/** 도메인별 지식 디렉토리 */
export function knowledgeDomainsDir(projectRoot: string): string {
  return join(projectRoot, '.knowledge', 'domains');
}

/** 온톨로지 vault 렌더링 디렉토리 */
export function knowledgeOntologyDir(projectRoot: string): string {
  return join(projectRoot, '.knowledge', 'ontology');
}

/** vault 내 템플릿 디렉토리 */
export function knowledgeTemplatesDir(projectRoot: string): string {
  return join(projectRoot, '.knowledge', '_templates');
}

/** vault 전체 인덱스 파일 */
export function knowledgeIndexPath(projectRoot: string): string {
  return join(projectRoot, '.knowledge', '_index.md');
}

/** 팀 공유용 온톨로지 스냅샷 디렉토리 (git-tracked) */
export function docsOntologyDir(projectRoot: string): string {
  return join(projectRoot, 'docs', 'ontology');
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

// ============================================================
// Local MCP 충돌 감지
// ============================================================

/** 프로젝트 로컬 .mcp.json 파일 경로 */
export function localMcpConfigPath(projectRoot: string): string {
  return join(projectRoot, '.mcp.json');
}

/**
 * 로컬 .mcp.json에 carpdm-harness가 등록되어 플러그인과 충돌하는지 감지한다.
 * 소스 프로젝트(package.json name === "carpdm-harness")는 배포 매니페스트이므로 제외.
 */
export function detectLocalMcpConflict(projectRoot: string): boolean {
  try {
    // 소스 프로젝트이면 충돌 아님
    const pkgPath = join(projectRoot, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string };
      if (pkg.name === 'carpdm-harness') return false;
    }

    const mcpPath = localMcpConfigPath(projectRoot);
    if (!existsSync(mcpPath)) return false;

    const raw = JSON.parse(readFileSync(mcpPath, 'utf-8')) as Record<string, unknown>;
    const servers = raw.mcpServers as Record<string, unknown> | undefined;
    if (!servers || typeof servers !== 'object') return false;

    return 'carpdm-harness' in servers;
  } catch {
    return false;
  }
}

/** 충돌 감지 시 경고 메시지를 응답에 추가한다 */
export function formatMcpConflictWarning(res: McpResponseBuilder): void {
  res.blank();
  res.warn('Local MCP 충돌 감지');
  res.line('`.mcp.json`에 `carpdm-harness`가 Local MCP로 등록되어 있습니다.');
  res.line('플러그인이 MCP 서버를 자동 제공하므로 수동 등록은 불필요합니다.');
  res.info('해결: `.mcp.json`의 mcpServers에서 `carpdm-harness` 항목을 제거하세요.');
}
