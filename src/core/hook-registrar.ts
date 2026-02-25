import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import type { HookRegistration } from '../types/module.js';
import { logger } from '../utils/logger.js';

interface SettingsLocalJson {
  hooks?: Record<string, HookConfig[]>;
  [key: string]: unknown;
}

interface HookConfig {
  type: string;
  command: string;
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
    { event: 'PostToolUse', command: 'bash .claude/hooks/ontology-update.sh' },
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

  const warnings: string[] = [];
  const omcConfigPath = join(homedir(), '.claude', '.omc-config.json');
  const omcDetected = existsSync(omcConfigPath);

  const OMC_EVENTS = new Set(['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']);

  let registered = 0;
  let total = 0;

  for (const moduleName of modules) {
    const hooks = getModuleHooks(moduleName);
    for (const hook of hooks) {
      total++;
      const eventKey = hook.pattern ? `${hook.event}:${hook.pattern}` : hook.event;

      if (!settings.hooks[eventKey]) {
        settings.hooks[eventKey] = [];
      }

      const existing = settings.hooks[eventKey].find(
        (h: HookConfig) => h.command === hook.command
      );

      if (!existing) {
        settings.hooks[eventKey].push({
          type: 'command',
          command: hook.command,
          ...(hook.pattern ? { matcher: hook.pattern } : {}),
        });
        registered++;
        if (!dryRun) {
          logger.fileAction('create', `훅 등록: ${eventKey} → ${hook.command}`);
        }
      }

      if (omcDetected && OMC_EVENTS.has(hook.event)) {
        // OMC 활성 모드 확인하여 조율 안내
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

function getOmcModeHint(projectRoot: string): string | null {
  const omcStateDir = join(projectRoot, '.omc', 'state');
  if (!existsSync(omcStateDir)) return null;

  try {
    const files = readdirSync(omcStateDir).filter((f: string) => f.endsWith('-state.json'));
    for (const file of files) {
      try {
        const state = JSON.parse(readFileSync(join(omcStateDir, file), 'utf-8'));
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
