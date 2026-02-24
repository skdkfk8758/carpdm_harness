import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
};

export function getModuleHooks(moduleName: string): HookRegistration[] {
  return HOOK_MAP[moduleName] || [];
}

export function registerHooks(
  modules: string[],
  projectRoot: string,
  dryRun = false,
): { registered: number; total: number } {
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
    }
  }

  if (!dryRun && registered > 0) {
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  return { registered, total };
}
