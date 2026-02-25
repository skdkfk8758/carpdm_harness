import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import type { HookRegistration } from '../types/module.js';
import { logger } from '../utils/logger.js';
import { omcConfigPath, omcStateDir } from './omc-compat.js';

interface SettingsLocalJson {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

/** Claude Code 신 포맷: { matcher: { tools?: string[] }, hooks: [{ type, command }] } */
interface HookEntry {
  matcher?: { tools?: string[] };
  hooks?: Array<{ type: string; command: string }>;
}

/** 구 포맷 항목 (마이그레이션용) */
interface LegacyHookConfig {
  type?: string;
  command?: string;
  matcher?: string;
}

const HOOK_MAP: Record<string, HookRegistration[]> = {
  core: [
    { event: 'UserPromptSubmit', command: 'bash .claude/hooks/pre-task.sh' },
    { event: 'PreToolUse', command: 'bash .claude/hooks/plan-guard.sh', pattern: 'Edit|Write' },
    { event: 'Stop', command: 'bash .claude/hooks/post-task.sh' },
  ],
  tdd: [
    { event: 'PreToolUse', command: 'bash .claude/hooks/tdd-guard.sh', pattern: 'Edit|Write' },
  ],
  quality: [
    { event: 'PostToolUse', command: 'bash .claude/hooks/code-change.sh', pattern: 'Edit|Write' },
  ],
  security: [
    { event: 'PostToolUse', command: 'bash .claude/hooks/secret-filter.sh' },
    { event: 'PreToolUse', command: 'bash .claude/hooks/command-guard.sh', pattern: 'Bash' },
    { event: 'PreToolUse', command: 'bash .claude/hooks/db-guard.sh', pattern: 'mcp__*' },
    { event: 'PostToolUse', command: 'bash .claude/hooks/security-trigger.sh', pattern: 'Edit|Write' },
  ],
  ontology: [
    { event: 'PostToolUse', command: 'bash .claude/hooks/ontology-update.sh', pattern: 'Edit|Write' },
  ],
};

export function getModuleHooks(moduleName: string): HookRegistration[] {
  return HOOK_MAP[moduleName] || [];
}

export function registerHooks(
  modules: string[],
  projectRoot: string,
  dryRun = false,
): { registered: number; total: number; warnings: string[] } {
  const settingsPath = join(projectRoot, '.claude', 'settings.local.json');
  let settings: SettingsLocalJson = {};

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }

  // 구 포맷 키 마이그레이션 (예: "PreToolUse:Edit|Write" → "PreToolUse")
  migrateLegacyHooks(settings.hooks);

  const warnings: string[] = [];
  const omcDetected = existsSync(omcConfigPath());

  const OMC_EVENTS = new Set(['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']);

  let registered = 0;
  let total = 0;

  for (const moduleName of modules) {
    const hooks = getModuleHooks(moduleName);
    for (const hook of hooks) {
      total++;
      const eventKey = hook.event;
      const tools = hook.pattern ? hook.pattern.split('|') : undefined;

      if (!settings.hooks[eventKey]) {
        settings.hooks[eventKey] = [];
      }

      // 동일한 matcher(tools 배열)를 가진 기존 엔트리 탐색
      const matchingEntry = settings.hooks[eventKey].find((entry: HookEntry) => {
        const entryTools = entry.matcher?.tools;
        if (!tools && (!entryTools || entryTools.length === 0)) return true;
        if (!tools || !entryTools) return false;
        return JSON.stringify([...entryTools].sort()) === JSON.stringify([...tools].sort());
      });

      if (matchingEntry) {
        if (!matchingEntry.hooks) matchingEntry.hooks = [];
        const cmdExists = matchingEntry.hooks.some(h => h.command === hook.command);
        if (!cmdExists) {
          matchingEntry.hooks.push({ type: 'command', command: hook.command });
          registered++;
          if (!dryRun) {
            logger.fileAction('create', `훅 등록: ${eventKey} → ${hook.command}`);
          }
        }
      } else {
        const newEntry: HookEntry = {
          matcher: tools ? { tools } : {},
          hooks: [{ type: 'command', command: hook.command }],
        };
        settings.hooks[eventKey].push(newEntry);
        registered++;
        if (!dryRun) {
          logger.fileAction('create', `훅 등록: ${eventKey} → ${hook.command}`);
        }
      }

      if (omcDetected && OMC_EVENTS.has(hook.event)) {
        const modeHint = getOmcModeHint(projectRoot);
        if (modeHint) {
          warnings.push(
            `OMC '${modeHint}' 모드 활성: ${eventKey} harness 훅이 OMC와 조율됩니다.`
          );
        } else {
          warnings.push(
            `OMC 감지: ${eventKey} 이벤트에 OMC 훅과 harness 훅이 공존합니다.`
          );
        }
      }
    }
  }

  if (!dryRun && registered > 0) {
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  return { registered, total, warnings };
}

/**
 * 구 포맷 키("PreToolUse:Edit|Write" 등)를 신 포맷으로 마이그레이션.
 * 콜론이 포함된 키를 파싱하여 기본 이벤트명 아래 matcher 구조로 변환한다.
 */
function migrateLegacyHooks(hooks: Record<string, unknown[]>): void {
  const legacyKeys = Object.keys(hooks).filter(k => k.includes(':'));

  for (const legacyKey of legacyKeys) {
    const [event, pattern] = legacyKey.split(':', 2);
    const tools = pattern ? pattern.split('|') : undefined;
    const legacyEntries = hooks[legacyKey] as LegacyHookConfig[];

    if (!hooks[event]) {
      hooks[event] = [];
    }

    const targetEntries = hooks[event] as HookEntry[];

    // 구 포맷 항목들을 신 포맷 엔트리로 변환
    const commands = legacyEntries
      .filter(e => e.command)
      .map(e => ({ type: 'command' as const, command: e.command! }));

    if (commands.length > 0) {
      // 동일 matcher를 가진 기존 엔트리에 병합 시도
      const existing = targetEntries.find((entry: HookEntry) => {
        const entryTools = entry.matcher?.tools;
        if (!tools && (!entryTools || entryTools.length === 0)) return true;
        if (!tools || !entryTools) return false;
        return JSON.stringify([...entryTools].sort()) === JSON.stringify([...tools].sort());
      });

      if (existing) {
        if (!existing.hooks) existing.hooks = [];
        for (const cmd of commands) {
          if (!existing.hooks.some(h => h.command === cmd.command)) {
            existing.hooks.push(cmd);
          }
        }
      } else {
        targetEntries.push({
          matcher: tools ? { tools } : {},
          hooks: commands,
        });
      }
    }

    delete hooks[legacyKey];
  }
}

function getOmcModeHint(projectRoot: string): string | null {
  const stateDir = omcStateDir(projectRoot);
  if (!existsSync(stateDir)) return null;

  try {
    const files = readdirSync(stateDir).filter((f: string) => f.endsWith('-state.json'));
    for (const file of files) {
      try {
        const state = JSON.parse(readFileSync(join(stateDir, file), 'utf-8'));
        if (state.active) {
          return file.replace('-state.json', '');
        }
      } catch {
        // 무시
      }
    }
  } catch {
    // 무시
  }
  return null;
}
