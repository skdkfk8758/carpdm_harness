import { readFileSync, existsSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, normalize } from 'node:path';
import { homedir } from 'node:os';
import {
  omcStateDir,
  omcGlobalStateDir,
  omcProjectMemoryPath,
  omcTodosPath,
  omcSwarmMarkerPath,
  omcSwarmSummaryPath,
  harnessStateDir as harnessStateDirFn,
} from '../core/omc-compat.js';

// ============================================================
// Types
// ============================================================

interface HookInput {
  cwd?: string;
  directory?: string;
  session_id?: string;
  sessionId?: string;
  sessionid?: string;
  stop_reason?: string;
  stopReason?: string;
  end_turn_reason?: string;
  endTurnReason?: string;
  user_requested?: boolean;
  userRequested?: boolean;
  [key: string]: unknown;
}

interface ModeStateResult {
  state: ModeState | null;
  path: string;
  isGlobal: boolean;
}

interface ModeState {
  active?: boolean;
  session_id?: string;
  project_path?: string;
  last_checked_at?: string;
  started_at?: string;
  reinforcement_count?: number;
  max_reinforcements?: number;
  iteration?: number;
  max_iterations?: number;
  phase?: string;
  prompt?: string;
  original_prompt?: string;
  workers?: Array<{ status?: string }>;
  current_stage?: number;
  stages?: unknown[];
  cycle?: number;
  max_cycles?: number;
  all_passing?: boolean;
  tasks_pending?: number;
  tasks_claimed?: number;
  [key: string]: unknown;
}

interface ToolError {
  timestamp?: string;
  retry_count?: number;
  tool_name?: string;
  error?: string;
  [key: string]: unknown;
}

// ============================================================
// Safety: Global error handlers + timeout
// ============================================================

process.on('uncaughtException', (error: Error) => {
  try {
    process.stderr.write(`[harness-session-end] Uncaught exception: ${error?.message || error}\n`);
  } catch { /* ignore */ }
  try {
    process.stdout.write(JSON.stringify({ result: 'continue' }) + '\n');
  } catch { /* ignore */ }
  process.exit(0);
});

process.on('unhandledRejection', (error: unknown) => {
  try {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[harness-session-end] Unhandled rejection: ${msg}\n`);
  } catch { /* ignore */ }
  try {
    process.stdout.write(JSON.stringify({ result: 'continue' }) + '\n');
  } catch { /* ignore */ }
  process.exit(0);
});

const safetyTimeout = setTimeout(() => {
  try {
    process.stderr.write('[harness-session-end] Safety timeout reached, forcing exit\n');
  } catch { /* ignore */ }
  try {
    process.stdout.write(JSON.stringify({ result: 'continue' }) + '\n');
  } catch { /* ignore */ }
  process.exit(0);
}, 10000);

// ============================================================
// Utility functions
// ============================================================

const STALE_STATE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const SESSION_ID_ALLOWLIST = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,255}$/;

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, data: unknown): boolean {
  try {
    const dir = dirname(filePath);
    if (dir && dir !== '.' && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

function isStaleState(state: ModeState | null): boolean {
  if (!state) return true;

  const lastChecked = state.last_checked_at
    ? new Date(state.last_checked_at).getTime()
    : 0;
  const startedAt = state.started_at ? new Date(state.started_at).getTime() : 0;
  const mostRecent = Math.max(lastChecked, startedAt);

  if (mostRecent === 0) return true;

  const age = Date.now() - mostRecent;
  return age > STALE_STATE_THRESHOLD_MS;
}

function normalizePath(p: string): string {
  if (!p) return '';
  let normalized = resolve(p);
  normalized = normalize(normalized);
  normalized = normalized.replace(/[/\\]+$/, '');
  if (process.platform === 'win32') {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

function isStateForCurrentProject(
  state: ModeState | null,
  currentDirectory: string,
  isGlobalState = false,
): boolean {
  if (!state) return true;

  if (!state.project_path) {
    if (isGlobalState) return false;
    return true;
  }

  return normalizePath(state.project_path) === normalizePath(currentDirectory);
}

function isContextLimitStop(data: HookInput): boolean {
  const reason = (data.stop_reason || data.stopReason || '').toString().toLowerCase();

  const contextPatterns = [
    'context_limit',
    'context_window',
    'context_exceeded',
    'context_full',
    'max_context',
    'token_limit',
    'max_tokens',
    'conversation_too_long',
    'input_too_long',
  ];

  if (contextPatterns.some((p) => reason.includes(p))) return true;

  const endTurnReason = (
    data.end_turn_reason || data.endTurnReason || ''
  ).toString().toLowerCase();
  if (endTurnReason && contextPatterns.some((p) => endTurnReason.includes(p))) {
    return true;
  }

  return false;
}

function isUserAbort(data: HookInput): boolean {
  if (data.user_requested || data.userRequested) return true;

  const reason = (data.stop_reason || data.stopReason || '').toString().toLowerCase();
  const exactPatterns = ['aborted', 'abort', 'cancel', 'interrupt'];
  const substringPatterns = [
    'user_cancel',
    'user_interrupt',
    'ctrl_c',
    'manual_stop',
  ];

  return (
    exactPatterns.some((p) => reason === p) ||
    substringPatterns.some((p) => reason.includes(p))
  );
}

function sanitizeSessionId(sessionId: unknown): string {
  if (!sessionId || typeof sessionId !== 'string') return '';
  return SESSION_ID_ALLOWLIST.test(sessionId) ? sessionId : '';
}

function isValidSessionId(sessionId: unknown): boolean {
  return typeof sessionId === 'string' && SESSION_ID_ALLOWLIST.test(sessionId);
}

function readStateFile(
  stateDir: string,
  globalStateDir: string,
  filename: string,
): ModeStateResult {
  const localPath = join(stateDir, filename);
  const globalPath = join(globalStateDir, filename);

  let state = readJsonFile(localPath) as ModeState | null;
  if (state) return { state, path: localPath, isGlobal: false };

  state = readJsonFile(globalPath) as ModeState | null;
  if (state) return { state, path: globalPath, isGlobal: true };

  return { state: null, path: localPath, isGlobal: false };
}

function readStateFileWithSession(
  stateDir: string,
  globalStateDir: string,
  filename: string,
  sessionId: string,
): ModeStateResult {
  const safeSessionId = sanitizeSessionId(sessionId);
  if (safeSessionId) {
    const sessionsDir = join(stateDir, 'sessions', safeSessionId);
    const sessionPath = join(sessionsDir, filename);
    const state = readJsonFile(sessionPath) as ModeState | null;
    return { state, path: sessionPath, isGlobal: false };
  }

  return readStateFile(stateDir, globalStateDir, filename);
}

function readLastToolError(harnessDir: string): ToolError | null {
  const errorPath = join(harnessDir, 'last-tool-error.json');
  const toolError = readJsonFile(errorPath) as ToolError | null;

  if (!toolError || !toolError.timestamp) return null;

  const parsedTime = new Date(toolError.timestamp).getTime();
  if (!Number.isFinite(parsedTime)) return null;

  const age = Date.now() - parsedTime;
  if (age > 60000) return null;

  return toolError;
}

function getToolErrorRetryGuidance(toolError: ToolError | null): string {
  if (!toolError) return '';

  const retryCount = toolError.retry_count || 1;
  const toolName = toolError.tool_name || 'unknown';
  const error = toolError.error || 'Unknown error';

  if (retryCount >= 5) {
    return `[TOOL ERROR - ALTERNATIVE APPROACH NEEDED]
The "${toolName}" operation has failed ${retryCount} times.

STOP RETRYING THE SAME APPROACH. Instead:
1. Try a completely different command or approach
2. Check if the environment/dependencies are correct
3. Consider breaking down the task differently
4. If stuck, ask the user for guidance

`;
  }

  return `[TOOL ERROR - RETRY REQUIRED]
The previous "${toolName}" operation failed.

Error: ${error}

REQUIRED ACTIONS:
1. Analyze why the command failed
2. Fix the issue (wrong path? permission? syntax? missing dependency?)
3. RETRY the operation with corrected parameters
4. Continue with your original task after success

Do NOT skip this step. Do NOT move on without fixing the error.

`;
}

function countIncompleteTasks(sessionId: string): number {
  if (!sessionId || typeof sessionId !== 'string') return 0;
  if (!SESSION_ID_ALLOWLIST.test(sessionId)) return 0;

  const taskDir = join(homedir(), '.claude', 'tasks', sessionId);
  if (!existsSync(taskDir)) return 0;

  let count = 0;
  try {
    const files = readdirSync(taskDir).filter(
      (f) => f.endsWith('.json') && f !== '.lock',
    );
    for (const file of files) {
      try {
        const content = readFileSync(join(taskDir, file), 'utf-8');
        const task = JSON.parse(content) as { status?: string };
        if (task.status === 'pending' || task.status === 'in_progress') count++;
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return count;
}

function countIncompleteTodos(sessionId: string, projectDir: string): number {
  let count = 0;

  if (
    sessionId &&
    typeof sessionId === 'string' &&
    SESSION_ID_ALLOWLIST.test(sessionId)
  ) {
    const sessionTodoPath = join(
      homedir(),
      '.claude',
      'todos',
      `${sessionId}.json`,
    );
    try {
      const data = readJsonFile(sessionTodoPath) as Record<string, unknown> | null;
      const todos = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.todos)
          ? (data as Record<string, unknown>).todos as Array<{ status?: string }>
          : [];
      count += (todos as Array<{ status?: string }>).filter(
        (t) => t.status !== 'completed' && t.status !== 'cancelled',
      ).length;
    } catch { /* skip */ }
  }

  for (const path of [
    omcTodosPath(projectDir),
    join(projectDir, '.claude', 'todos.json'),
  ]) {
    try {
      const data = readJsonFile(path) as Record<string, unknown> | null;
      const todos = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.todos)
          ? (data as Record<string, unknown>).todos as Array<{ status?: string }>
          : [];
      count += (todos as Array<{ status?: string }>).filter(
        (t) => t.status !== 'completed' && t.status !== 'cancelled',
      ).length;
    } catch { /* skip */ }
  }

  return count;
}

// ============================================================
// Persistent mode: check all OMC modes and decide block/continue
// ============================================================

function checkPersistentMode(input: HookInput): { blocked: boolean; output: string } {
  const directory = input.cwd || input.directory || process.cwd();
  const sessionIdRaw = input.sessionId || input.session_id || input.sessionid || '';
  const sessionId = sanitizeSessionId(sessionIdRaw);
  const hasValidSession = isValidSessionId(sessionIdRaw);
  const stateDir = omcStateDir(directory);
  const globalStateDir = omcGlobalStateDir();
  const harnessDir = harnessStateDirFn(directory);

  // CRITICAL: Never block context-limit stops (deadlock prevention)
  if (isContextLimitStop(input)) {
    return { blocked: false, output: JSON.stringify({ result: 'continue' }) };
  }

  // Respect user abort (Ctrl+C, cancel)
  if (isUserAbort(input)) {
    return { blocked: false, output: JSON.stringify({ result: 'continue' }) };
  }

  // Read all mode states (session-scoped when sessionId provided)
  const ralph = readStateFileWithSession(stateDir, globalStateDir, 'ralph-state.json', sessionId);
  const autopilot = readStateFileWithSession(stateDir, globalStateDir, 'autopilot-state.json', sessionId);
  const ultrapilot = readStateFileWithSession(stateDir, globalStateDir, 'ultrapilot-state.json', sessionId);
  const ultrawork = readStateFileWithSession(stateDir, globalStateDir, 'ultrawork-state.json', sessionId);
  const ecomode = readStateFileWithSession(stateDir, globalStateDir, 'ecomode-state.json', sessionId);
  const ultraqa = readStateFileWithSession(stateDir, globalStateDir, 'ultraqa-state.json', sessionId);
  const pipeline = readStateFileWithSession(stateDir, globalStateDir, 'pipeline-state.json', sessionId);

  // Swarm uses swarm-summary.json + marker file (local only)
  const swarmMarker = existsSync(omcSwarmMarkerPath(directory));
  const swarmSummary = readJsonFile(omcSwarmSummaryPath(directory)) as ModeState | null;

  // Count incomplete items (session-specific + project-local only)
  const taskCount = countIncompleteTasks(sessionId);
  const todoCount = countIncompleteTodos(sessionId, directory);
  const totalIncomplete = taskCount + todoCount;

  // Helper: check session match
  const sessionMatches = (state: ModeState | null): boolean => {
    if (!state) return false;
    return hasValidSession
      ? state.session_id === sessionId
      : !state.session_id || state.session_id === sessionId;
  };

  // Priority 1: Ralph Loop (max 100)
  if (
    ralph.state?.active &&
    !isStaleState(ralph.state) &&
    isStateForCurrentProject(ralph.state, directory, ralph.isGlobal) &&
    sessionMatches(ralph.state)
  ) {
    const iteration = ralph.state.iteration || 1;
    const maxIter = ralph.state.max_iterations || 100;

    if (iteration < maxIter) {
      const toolError = readLastToolError(harnessDir);
      const errorGuidance = getToolErrorRetryGuidance(toolError);

      ralph.state.iteration = iteration + 1;
      ralph.state.last_checked_at = new Date().toISOString();
      writeJsonFile(ralph.path, ralph.state);

      let reason = `[RALPH LOOP - ITERATION ${iteration + 1}/${maxIter}] Work is NOT done. Continue working.\nWhen FULLY complete (after Architect verification), run /oh-my-claudecode:cancel to cleanly exit ralph mode and clean up all state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.\n${ralph.state.prompt ? `Task: ${ralph.state.prompt}` : ''}`;
      if (errorGuidance) {
        reason = errorGuidance + reason;
      }

      return {
        blocked: true,
        output: JSON.stringify({ decision: 'block', reason }),
      };
    }
  }

  // Priority 2: Autopilot (max 20, phase !== "complete")
  if (
    autopilot.state?.active &&
    !isStaleState(autopilot.state) &&
    isStateForCurrentProject(autopilot.state, directory, autopilot.isGlobal) &&
    sessionMatches(autopilot.state)
  ) {
    const phase = autopilot.state.phase || 'unspecified';
    if (phase !== 'complete') {
      const newCount = (autopilot.state.reinforcement_count || 0) + 1;
      if (newCount <= 20) {
        const toolError = readLastToolError(harnessDir);
        const errorGuidance = getToolErrorRetryGuidance(toolError);

        autopilot.state.reinforcement_count = newCount;
        autopilot.state.last_checked_at = new Date().toISOString();
        writeJsonFile(autopilot.path, autopilot.state);

        let reason = `[AUTOPILOT - Phase: ${phase}] Autopilot not complete. Continue working. When all phases are complete, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
        if (errorGuidance) {
          reason = errorGuidance + reason;
        }

        return {
          blocked: true,
          output: JSON.stringify({ decision: 'block', reason }),
        };
      }
    }
  }

  // Priority 3: Ultrapilot (max 20, incomplete workers)
  if (
    ultrapilot.state?.active &&
    !isStaleState(ultrapilot.state) &&
    isStateForCurrentProject(ultrapilot.state, directory, ultrapilot.isGlobal) &&
    sessionMatches(ultrapilot.state)
  ) {
    const workers = ultrapilot.state.workers || [];
    const incomplete = workers.filter(
      (w) => w.status !== 'complete' && w.status !== 'failed',
    ).length;
    if (incomplete > 0) {
      const newCount = (ultrapilot.state.reinforcement_count || 0) + 1;
      if (newCount <= 20) {
        const toolError = readLastToolError(harnessDir);
        const errorGuidance = getToolErrorRetryGuidance(toolError);

        ultrapilot.state.reinforcement_count = newCount;
        ultrapilot.state.last_checked_at = new Date().toISOString();
        writeJsonFile(ultrapilot.path, ultrapilot.state);

        let reason = `[ULTRAPILOT] ${incomplete} workers still running. Continue working. When all workers complete, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
        if (errorGuidance) {
          reason = errorGuidance + reason;
        }

        return {
          blocked: true,
          output: JSON.stringify({ decision: 'block', reason }),
        };
      }
    }
  }

  // Priority 4: Swarm (max 15, pending tasks, local only)
  if (
    swarmMarker &&
    swarmSummary?.active &&
    !isStaleState(swarmSummary) &&
    isStateForCurrentProject(swarmSummary, directory, false)
  ) {
    const pending =
      (swarmSummary.tasks_pending || 0) + (swarmSummary.tasks_claimed || 0);
    if (pending > 0) {
      const newCount = (swarmSummary.reinforcement_count || 0) + 1;
      if (newCount <= 15) {
        const toolError = readLastToolError(harnessDir);
        const errorGuidance = getToolErrorRetryGuidance(toolError);

        swarmSummary.reinforcement_count = newCount;
        swarmSummary.last_checked_at = new Date().toISOString();
        writeJsonFile(omcSwarmSummaryPath(directory), swarmSummary);

        let reason = `[SWARM ACTIVE] ${pending} tasks remain. Continue working. When all tasks are done, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
        if (errorGuidance) {
          reason = errorGuidance + reason;
        }

        return {
          blocked: true,
          output: JSON.stringify({ decision: 'block', reason }),
        };
      }
    }
  }

  // Priority 5: Pipeline (max 15, currentStage < totalStages)
  if (
    pipeline.state?.active &&
    !isStaleState(pipeline.state) &&
    isStateForCurrentProject(pipeline.state, directory, pipeline.isGlobal) &&
    sessionMatches(pipeline.state)
  ) {
    const currentStage = pipeline.state.current_stage || 0;
    const totalStages = pipeline.state.stages?.length || 0;
    if (currentStage < totalStages) {
      const newCount = (pipeline.state.reinforcement_count || 0) + 1;
      if (newCount <= 15) {
        const toolError = readLastToolError(harnessDir);
        const errorGuidance = getToolErrorRetryGuidance(toolError);

        pipeline.state.reinforcement_count = newCount;
        pipeline.state.last_checked_at = new Date().toISOString();
        writeJsonFile(pipeline.path, pipeline.state);

        let reason = `[PIPELINE - Stage ${currentStage + 1}/${totalStages}] Pipeline not complete. Continue working. When all stages complete, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
        if (errorGuidance) {
          reason = errorGuidance + reason;
        }

        return {
          blocked: true,
          output: JSON.stringify({ decision: 'block', reason }),
        };
      }
    }
  }

  // Priority 6: UltraQA (cycle < maxCycles, !all_passing)
  if (
    ultraqa.state?.active &&
    !isStaleState(ultraqa.state) &&
    isStateForCurrentProject(ultraqa.state, directory, ultraqa.isGlobal) &&
    sessionMatches(ultraqa.state)
  ) {
    const cycle = ultraqa.state.cycle || 1;
    const maxCycles = ultraqa.state.max_cycles || 10;
    if (cycle < maxCycles && !ultraqa.state.all_passing) {
      const toolError = readLastToolError(harnessDir);
      const errorGuidance = getToolErrorRetryGuidance(toolError);

      ultraqa.state.cycle = cycle + 1;
      ultraqa.state.last_checked_at = new Date().toISOString();
      writeJsonFile(ultraqa.path, ultraqa.state);

      let reason = `[ULTRAQA - Cycle ${cycle + 1}/${maxCycles}] Tests not all passing. Continue fixing. When all tests pass, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
      if (errorGuidance) {
        reason = errorGuidance + reason;
      }

      return {
        blocked: true,
        output: JSON.stringify({ decision: 'block', reason }),
      };
    }
  }

  // Priority 7: Ultrawork (max 50, unconditional while active)
  if (
    ultrawork.state?.active &&
    !isStaleState(ultrawork.state) &&
    isStateForCurrentProject(ultrawork.state, directory, ultrawork.isGlobal) &&
    sessionMatches(ultrawork.state)
  ) {
    const newCount = (ultrawork.state.reinforcement_count || 0) + 1;
    const maxReinforcements = ultrawork.state.max_reinforcements || 50;

    if (newCount <= maxReinforcements) {
      const toolError = readLastToolError(harnessDir);
      const errorGuidance = getToolErrorRetryGuidance(toolError);

      ultrawork.state.reinforcement_count = newCount;
      ultrawork.state.last_checked_at = new Date().toISOString();
      writeJsonFile(ultrawork.path, ultrawork.state);

      let reason = `[ULTRAWORK #${newCount}/${maxReinforcements}] Mode active.`;

      if (totalIncomplete > 0) {
        const itemType = taskCount > 0 ? 'Tasks' : 'todos';
        reason += ` ${totalIncomplete} incomplete ${itemType} remain. Continue working.`;
      } else if (newCount >= 3) {
        reason += ` If all work is complete, run /oh-my-claudecode:cancel to cleanly exit ultrawork mode and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force. Otherwise, continue working.`;
      } else {
        reason += ` Continue working - create Tasks to track your progress.`;
      }

      if (ultrawork.state.original_prompt) {
        reason += `\nTask: ${ultrawork.state.original_prompt}`;
      }

      if (errorGuidance) {
        reason = errorGuidance + reason;
      }

      return {
        blocked: true,
        output: JSON.stringify({ decision: 'block', reason }),
      };
    }
  }

  // Priority 8: Ecomode (max 50, unconditional while active)
  if (
    ecomode.state?.active &&
    !isStaleState(ecomode.state) &&
    isStateForCurrentProject(ecomode.state, directory, ecomode.isGlobal) &&
    sessionMatches(ecomode.state)
  ) {
    const newCount = (ecomode.state.reinforcement_count || 0) + 1;
    const maxReinforcements = ecomode.state.max_reinforcements || 50;

    if (newCount <= maxReinforcements) {
      const toolError = readLastToolError(harnessDir);
      const errorGuidance = getToolErrorRetryGuidance(toolError);

      ecomode.state.reinforcement_count = newCount;
      ecomode.state.last_checked_at = new Date().toISOString();
      writeJsonFile(ecomode.path, ecomode.state);

      let reason = `[ECOMODE #${newCount}/${maxReinforcements}] Mode active.`;

      if (totalIncomplete > 0) {
        const itemType = taskCount > 0 ? 'Tasks' : 'todos';
        reason += ` ${totalIncomplete} incomplete ${itemType} remain. Continue working.`;
      } else if (newCount >= 3) {
        reason += ` If all work is complete, run /oh-my-claudecode:cancel to cleanly exit ecomode and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force. Otherwise, continue working.`;
      } else {
        reason += ` Continue working - create Tasks to track your progress.`;
      }

      if (errorGuidance) {
        reason = errorGuidance + reason;
      }

      return {
        blocked: true,
        output: JSON.stringify({ decision: 'block', reason }),
      };
    }
  }

  // No active mode blocking
  return { blocked: false, output: '' };
}

// ============================================================
// Team-memory sync check (existing session-end logic)
// ============================================================

function checkTeamMemorySync(cwd: string): string | null {
  const configPath = join(cwd, 'carpdm-harness.config.json');
  if (!existsSync(configPath)) return null;

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const omcConfig = config.omcConfig || {};
    const hasTeamMemory = (config.modules || []).includes('team-memory');

    if (omcConfig.autoSync !== false && hasTeamMemory) {
      const teamMemoryPath = join(cwd, '.harness', 'team-memory.json');
      const omcProjMemPath = omcProjectMemoryPath(cwd);

      if (existsSync(teamMemoryPath) && existsSync(omcProjMemPath)) {
        try {
          const teamMemory = JSON.parse(readFileSync(teamMemoryPath, 'utf-8'));
          const omcMemory = JSON.parse(readFileSync(omcProjMemPath, 'utf-8'));

          if (teamMemory.conventions && Array.isArray(teamMemory.conventions)) {
            const conventionTexts = teamMemory.conventions
              .map((c: Record<string, unknown>) => c.title || c.content || '')
              .filter(Boolean);

            if (conventionTexts.length > 0) {
              const existingConventions = omcMemory.conventions || '';
              const newConventions = conventionTexts.join('\n');

              if (existingConventions !== newConventions) {
                return '[harness-session-end] 팀 메모리 변경 감지. `harness_sync`로 OMC 동기화를 권장합니다.';
              }
            }
          }
        } catch {
          // sync check failure ignored
        }
      }
    }
  } catch {
    // config read failure ignored
  }

  return null;
}

// ============================================================
// CLAUDE.md auto-sync check
// ============================================================

/** Bug Mode 세션 종료 시 버그 기록 제안 */
function checkBugModeCompletion(cwd: string): string | null {
  const stateDir = harnessStateDirFn(cwd);
  const taskModePath = join(stateDir, 'task-mode');
  if (!existsSync(taskModePath)) return null;

  try {
    const mode = readFileSync(taskModePath, 'utf-8').trim();
    if (!mode.startsWith('BugFix')) return null;
    return '[harness-session-end] Bug Mode 세션이 종료됩니다. 수정한 버그가 있다면 harness_bug_report 또는 harness_memory_add(category:"bugs")로 기록하면 팀 추적이 가능합니다.';
  } catch {
    return null;
  }
}

function checkClaudeMdSync(cwd: string): string | null {
  const configPath = join(cwd, 'carpdm-harness.config.json');
  if (!existsSync(configPath)) return null;

  const claudeMdPath = join(cwd, 'CLAUDE.md');
  if (!existsSync(claudeMdPath)) return null;

  try {
    const content = readFileSync(claudeMdPath, 'utf-8');
    const MARKER_START = '<!-- harness:auto:start -->';
    const MARKER_END = '<!-- harness:auto:end -->';
    const startIdx = content.indexOf(MARKER_START);
    const endIdx = content.indexOf(MARKER_END);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;

    // 마커 영역을 재생성하여 변경 여부를 감지
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const modules = (config.modules || []).join(', ') || '(없음)';
    const preset = config.preset || 'unknown';

    // 현재 마커 영역 내용
    const currentAuto = content.slice(startIdx + MARKER_START.length, endIdx).trim();

    // 핵심 정보가 변경되었는지 간단 비교
    if (!currentAuto.includes(preset) || !currentAuto.includes(modules)) {
      // 변경 감지 — 다음 세션에서 sync를 권장
      return '[harness-session-end] CLAUDE.md 자동 섹션이 현재 설정과 다릅니다. `harness_sync` 또는 `/carpdm-harness:sync`로 갱신을 권장합니다.';
    }
  } catch {
    // 무시 — 훅은 절대 실패하면 안 됨
  }

  return null;
}

// ============================================================
// Main
// ============================================================

function main(): void {
  let input: HookInput;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = JSON.parse(raw) as HookInput;
  } catch {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  // Step 1: Persistent mode check (runs first, may block)
  try {
    const persistentResult = checkPersistentMode(input);
    if (persistentResult.blocked) {
      process.stdout.write(persistentResult.output);
      return;
    }
  } catch {
    // On persistent mode error, fall through to team-memory sync
  }

  // Step 2: Team-memory sync check + CLAUDE.md sync check + Bug Mode check (only when not blocking)
  const cwd = input.cwd || input.directory || process.cwd();
  const messages: string[] = [];

  const syncMessage = checkTeamMemorySync(cwd);
  if (syncMessage) messages.push(syncMessage);

  const claudeMessage = checkClaudeMdSync(cwd);
  if (claudeMessage) messages.push(claudeMessage);

  const bugMessage = checkBugModeCompletion(cwd);
  if (bugMessage) messages.push(bugMessage);

  if (messages.length > 0) {
    process.stdout.write(JSON.stringify({
      result: 'continue',
      additionalContext: messages.join('\n'),
    }));
    return;
  }

  process.stdout.write(JSON.stringify({ result: 'continue' }));
}

try {
  main();
} catch (error: unknown) {
  try {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[harness-session-end] Error: ${msg}\n`);
  } catch { /* ignore */ }
  try {
    process.stdout.write(JSON.stringify({ result: 'continue' }) + '\n');
  } catch { /* ignore */ }
  process.exit(0);
} finally {
  clearTimeout(safetyTimeout);
}
