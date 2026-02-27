/**
 * 프로젝트 settings.local.json 부트스트랩
 *
 * carpdm-harness + OMC 생태계가 동작하기 위한 최소 필수 설정을 생성합니다.
 * 기존 설정이 있으면 병합(additive)하고, 기존 규칙을 제거하지 않습니다.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================
// 최소 필수 Allow 규칙
// ============================================================

/** Claude Code 핵심 도구 — 없으면 매 호출마다 승인 팝업 */
const CORE_TOOL_ALLOW = [
  'AskUserQuestion',
  'Edit',
  'Glob',
  'Grep',
  'Read',
  'Skill',
  'Task',
  'Write',
  'WebFetch',
  'WebSearch',
] as const;

/** 읽기 전용 + 기본 파일 Bash 명령어 */
const BASH_READONLY_ALLOW = [
  'Bash(ls:*)',
  'Bash(pwd:*)',
  'Bash(which:*)',
  'Bash(cat:*)',
  'Bash(head:*)',
  'Bash(tail:*)',
  'Bash(grep:*)',
  'Bash(rg:*)',
  'Bash(find:*)',
  'Bash(wc:*)',
  'Bash(tree:*)',
  'Bash(diff:*)',
  'Bash(sort:*)',
  'Bash(echo:*)',
  'Bash(jq:*)',
] as const;

/** 기본 파일 조작 */
const BASH_FILE_ALLOW = [
  'Bash(mkdir:*)',
  'Bash(cp:*)',
  'Bash(mv:*)',
  'Bash(touch:*)',
] as const;

/** Git 기본 명령어 */
const BASH_GIT_ALLOW = [
  'Bash(git add:*)',
  'Bash(git blame:*)',
  'Bash(git branch:*)',
  'Bash(git checkout:*)',
  'Bash(git commit:*)',
  'Bash(git diff:*)',
  'Bash(git fetch:*)',
  'Bash(git log:*)',
  'Bash(git merge:*)',
  'Bash(git pull:*)',
  'Bash(git push:*)',
  'Bash(git remote:*)',
  'Bash(git rev-parse:*)',
  'Bash(git show:*)',
  'Bash(git stash:*)',
  'Bash(git status:*)',
  'Bash(git switch:*)',
  'Bash(git tag:*)',
  'Bash(gh pr:*)',
  'Bash(gh issue:*)',
] as const;

/** Node.js 생태계 */
const BASH_NODE_ALLOW = [
  'Bash(node:*)',
  'Bash(npm:*)',
  'Bash(npx:*)',
] as const;

// ============================================================
// 최소 필수 Deny 규칙 (보안 기본선)
// ============================================================

const ESSENTIAL_DENY = [
  // 파괴적 파일 작업
  'Bash(rm -rf /:*)',
  'Bash(rm -rf /*:*)',
  'Bash(rm -rf ~:*)',
  'Bash(rm -rf ~/*:*)',
  // Git 위험 명령
  'Bash(git push --force:*)',
  'Bash(git push -f:*)',
  'Bash(git reset --hard:*)',
  'Bash(git clean -fd:*)',
  'Bash(git clean -fdx:*)',
  // 시스템 위험 명령
  'Bash(chmod 777:*)',
  'Bash(dd:*)',
  'Bash(mkfs:*)',
  'Bash(reboot:*)',
  'Bash(shutdown:*)',
  // 민감 경로 보호
  'Read(./secrets/**)',
  'Read(~/.ssh/**)',
  'Read(~/.aws/**)',
  'Write(./secrets/**)',
  'Write(~/.ssh/**)',
  'Write(~/.aws/**)',
  'Edit(./secrets/**)',
  'Edit(~/.ssh/**)',
  'Edit(~/.aws/**)',
] as const;

// ============================================================
// 확장 Deny 규칙 (security 모듈 전용)
// ============================================================

const EXTENDED_SECURITY_DENY = [
  // 외부 코드 실행
  'Bash(curl*|*sh)*',
  'Bash(wget*|*sh)*',
  'Bash(eval *)*',
  'Bash(bash -c *)*',
  'Bash(sh -c *)*',
  'Bash(node -e *)*',
  'Bash(perl -e *)*',
  'Bash(python3 -c *import os*)*',
  // 환경/프로필 보호
  'Bash(*>~/.ssh/*)',
  'Bash(*>~/.zshrc)*',
  'Bash(*>~/.bashrc)*',
  'Bash(*>~/.profile)*',
  'Bash(*>~/.zprofile)*',
  // Git 추가 보호
  'Bash(git push --force*main)*',
  'Bash(git push -f*main)*',
  'Bash(git push --force*master)*',
  'Bash(git push -f*master)*',
  'Bash(git reset --hard origin/*)*',
  'Bash(git clean -f*)*',
  'Bash(git checkout -- .)*',
  'Bash(git restore .)*',
  // 패키지 배포
  'Bash(npm publish)*',
  'Bash(pnpm publish)*',
  'Bash(yarn publish)*',
  // 시스템 명령
  'Bash(osascript*)*',
  'Bash(crontab*)*',
  'Bash(launchctl*)*',
  'Bash(docker system prune)*',
  // DB 위험 명령
  'Bash(DROP DATABASE:*)',
  'Bash(DROP TABLE:*)',
  'Bash(TRUNCATE:*)',
  'Bash(DELETE FROM:*)',
] as const;

// ============================================================
// Ask 규칙 (승인 필요)
// ============================================================

const ESSENTIAL_ASK = [
  'Bash(rm:*)',
  'Bash(chmod:*)',
  'Bash(chown:*)',
  'Bash(sudo:*)',
  'Read(./.env)',
  'Read(./.env.*)',
] as const;

// ============================================================
// 환경변수
// ============================================================

const ESSENTIAL_ENV: Record<string, string> = {
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: 'true',
};

// ============================================================
// 부트스트랩 함수
// ============================================================

export interface BootstrapOptions {
  /** 언어 설정 (기본: "Korea") */
  language?: string;
  /** security 모듈 포함 여부 → 확장 deny 규칙 추가 */
  includeSecurityModule?: boolean;
  /** 추가 allow 규칙 (감지된 MCP 도구 등) */
  extraAllow?: string[];
  /** dry-run 모드 */
  dryRun?: boolean;
}

export interface BootstrapResult {
  allowAdded: number;
  denyAdded: number;
  askAdded: number;
  envAdded: number;
  languageSet: boolean;
  totalAllow: number;
  totalDeny: number;
}

interface SettingsJson {
  permissions?: {
    allow?: string[];
    deny?: string[];
    ask?: string[];
    [key: string]: unknown;
  };
  env?: Record<string, string>;
  language?: string;
  [key: string]: unknown;
}

/**
 * 프로젝트 `.claude/settings.local.json`에 최소 필수 설정을 적용합니다.
 * 기존 설정과 병합(additive)하며, 기존 규칙을 제거하지 않습니다.
 */
export function bootstrapProjectSettings(
  projectRoot: string,
  options: BootstrapOptions = {},
): BootstrapResult {
  const {
    language = 'Korea',
    includeSecurityModule = false,
    extraAllow = [],
    dryRun = false,
  } = options;

  const settingsPath = join(projectRoot, '.claude', 'settings.local.json');
  let settings: SettingsJson = {};

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as SettingsJson;
    } catch {
      settings = {};
    }
  }

  // permissions 초기화
  if (!settings.permissions) settings.permissions = {};
  if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];
  if (!Array.isArray(settings.permissions.deny)) settings.permissions.deny = [];
  if (!Array.isArray(settings.permissions.ask)) settings.permissions.ask = [];

  const allow = settings.permissions.allow;
  const deny = settings.permissions.deny;
  const ask = settings.permissions.ask;

  // ── Allow 규칙 병합 ──
  const allAllow = [
    ...CORE_TOOL_ALLOW,
    ...BASH_READONLY_ALLOW,
    ...BASH_FILE_ALLOW,
    ...BASH_GIT_ALLOW,
    ...BASH_NODE_ALLOW,
    ...extraAllow,
  ];

  let allowAdded = 0;
  for (const rule of allAllow) {
    if (!allow.includes(rule)) {
      allow.push(rule);
      allowAdded++;
    }
  }

  // ── Deny 규칙 병합 ──
  const allDeny = [
    ...ESSENTIAL_DENY,
    ...(includeSecurityModule ? EXTENDED_SECURITY_DENY : []),
  ];

  let denyAdded = 0;
  for (const rule of allDeny) {
    if (!deny.includes(rule)) {
      deny.push(rule);
      denyAdded++;
    }
  }

  // ── Ask 규칙 병합 ──
  let askAdded = 0;
  for (const rule of ESSENTIAL_ASK) {
    if (!ask.includes(rule)) {
      ask.push(rule);
      askAdded++;
    }
  }

  // ── Env 병합 ──
  if (!settings.env) settings.env = {};
  let envAdded = 0;
  for (const [key, value] of Object.entries(ESSENTIAL_ENV)) {
    if (settings.env[key] === undefined) {
      settings.env[key] = value;
      envAdded++;
    }
  }

  // ── Language 설정 ──
  let languageSet = false;
  if (!settings.language) {
    settings.language = language;
    languageSet = true;
  }

  // ── 파일 쓰기 ──
  if (!dryRun) {
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  return {
    allowAdded,
    denyAdded,
    askAdded,
    envAdded,
    languageSet,
    totalAllow: allow.length,
    totalDeny: deny.length,
  };
}

/**
 * 감지된 capabilities에 기반한 추가 allow 규칙 생성
 */
export function getCapabilityAllowRules(capabilities: {
  omc?: { installed: boolean };
  tools: Record<string, { detected: boolean }>;
}): string[] {
  const rules: string[] = [];

  // OMC 감지 시: 주요 MCP 도구 (읽기 전용 우선)
  if (capabilities.omc?.installed) {
    rules.push(
      // State / Notepad / Project Memory (읽기)
      'mcp__plugin_oh-my-claudecode_t__state_read',
      'mcp__plugin_oh-my-claudecode_t__state_list_active',
      'mcp__plugin_oh-my-claudecode_t__state_get_status',
      'mcp__plugin_oh-my-claudecode_t__notepad_read',
      'mcp__plugin_oh-my-claudecode_t__notepad_stats',
      'mcp__plugin_oh-my-claudecode_t__project_memory_read',
      // State / Notepad / Project Memory (쓰기)
      'mcp__plugin_oh-my-claudecode_t__state_write',
      'mcp__plugin_oh-my-claudecode_t__state_clear',
      'mcp__plugin_oh-my-claudecode_t__notepad_write_priority',
      'mcp__plugin_oh-my-claudecode_t__notepad_write_working',
      'mcp__plugin_oh-my-claudecode_t__notepad_write_manual',
      'mcp__plugin_oh-my-claudecode_t__notepad_prune',
      'mcp__plugin_oh-my-claudecode_t__project_memory_write',
      'mcp__plugin_oh-my-claudecode_t__project_memory_add_note',
      'mcp__plugin_oh-my-claudecode_t__project_memory_add_directive',
      // LSP (코드 인텔리전스)
      'mcp__plugin_oh-my-claudecode_t__lsp_hover',
      'mcp__plugin_oh-my-claudecode_t__lsp_goto_definition',
      'mcp__plugin_oh-my-claudecode_t__lsp_find_references',
      'mcp__plugin_oh-my-claudecode_t__lsp_document_symbols',
      'mcp__plugin_oh-my-claudecode_t__lsp_workspace_symbols',
      'mcp__plugin_oh-my-claudecode_t__lsp_diagnostics',
      // AST
      'mcp__plugin_oh-my-claudecode_t__ast_grep_search',
      'mcp__plugin_oh-my-claudecode_t__ast_grep_replace',
      // Trace
      'mcp__plugin_oh-my-claudecode_t__trace_timeline',
      'mcp__plugin_oh-my-claudecode_t__trace_summary',
    );
  }

  // Serena 감지 시
  if (capabilities.tools.serena?.detected) {
    rules.push(
      'mcp__plugin_serena_serena__list_dir',
      'mcp__plugin_serena_serena__read_file',
      'mcp__plugin_serena_serena__get_symbols_overview',
      'mcp__plugin_serena_serena__find_symbol',
      'mcp__plugin_serena_serena__find_referencing_symbols',
      'mcp__plugin_serena_serena__activate_project',
    );
  }

  // Context7 감지 시
  if (capabilities.tools.context7?.detected) {
    rules.push(
      'mcp__context7__resolve-library-id',
      'mcp__context7__query-docs',
    );
  }

  // Codex 감지 시
  if (capabilities.tools.codex?.detected) {
    rules.push(
      'mcp__codex__codex',
      'mcp__codex__codex-reply',
    );
  }

  // Gemini 감지 시
  if (capabilities.tools.gemini?.detected) {
    rules.push(
      'mcp__gemini__gemini',
      'mcp__gemini__gemini-reply',
    );
  }

  return rules;
}

// ============================================================
// 권한 규칙 수정 (overlap-applier 전용)
// ============================================================

export interface PermissionOperation {
  rule: string;
  from?: 'allow' | 'deny' | 'ask';  // 제거할 목록
  to?: 'allow' | 'deny' | 'ask';    // 추가할 목록
}

/**
 * settings.local.json의 permission 규칙을 수정합니다.
 * bootstrapProjectSettings의 additive-only 원칙과 분리된 별도 함수입니다.
 */
export function modifyPermissionRules(
  projectRoot: string,
  operations: PermissionOperation[],
): { removed: number; added: number } {
  const settingsPath = join(projectRoot, '.claude', 'settings.local.json');
  let settings: SettingsJson = {};

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as SettingsJson;
    } catch {
      settings = {};
    }
  }

  if (!settings.permissions) settings.permissions = {};
  if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];
  if (!Array.isArray(settings.permissions.deny)) settings.permissions.deny = [];
  if (!Array.isArray(settings.permissions.ask)) settings.permissions.ask = [];

  let removed = 0;
  let added = 0;

  for (const op of operations) {
    // from 목록에서 제거
    if (op.from) {
      const list = settings.permissions[op.from] as string[];
      const idx = list.indexOf(op.rule);
      if (idx !== -1) {
        list.splice(idx, 1);
        removed++;
      }
    }

    // to 목록에 추가 (중복 방지)
    if (op.to) {
      const list = settings.permissions[op.to] as string[];
      if (!list.includes(op.rule)) {
        list.push(op.rule);
        added++;
      }
    }
  }

  mkdirSync(join(projectRoot, '.claude'), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  return { removed, added };
}
