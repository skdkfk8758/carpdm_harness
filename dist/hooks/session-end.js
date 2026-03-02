// src/hooks/session-end.ts
import { readFileSync as readFileSync3, existsSync as existsSync3, writeFileSync as writeFileSync2, readdirSync as readdirSync2, mkdirSync as mkdirSync2 } from "fs";
import { join as join4, dirname as dirname2, resolve, normalize } from "path";
import { homedir as homedir3 } from "os";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync } from "fs";
function omcStateDir(projectRoot) {
  return join(projectRoot, ".omc", "state");
}
function omcGlobalStateDir() {
  return join(homedir(), ".omc", "state");
}
function omcProjectMemoryPath(projectRoot) {
  return join(projectRoot, ".omc", "project-memory.json");
}
function omcSwarmMarkerPath(projectRoot) {
  return join(projectRoot, ".omc", "state", "swarm-active.marker");
}
function omcSwarmSummaryPath(projectRoot) {
  return join(projectRoot, ".omc", "state", "swarm-summary.json");
}
function omcTodosPath(projectRoot) {
  return join(projectRoot, ".omc", "todos.json");
}
function harnessStateDir(projectRoot) {
  return join(projectRoot, ".harness", "state");
}
function rufloSwarmActivityPath(projectRoot) {
  return join(projectRoot, ".claude-flow", "metrics", "swarm-activity.json");
}
function detectRufloSwarmStatus(projectRoot) {
  const inactive = { active: false, agentCount: 0, timestamp: null };
  const activityPath = rufloSwarmActivityPath(projectRoot);
  if (!existsSync(activityPath)) return inactive;
  try {
    const raw = JSON.parse(readFileSync(activityPath, "utf-8"));
    const swarm = raw?.swarm;
    if (!swarm) return inactive;
    return {
      active: swarm.active ?? false,
      agentCount: swarm.agent_count ?? 0,
      timestamp: raw.timestamp ?? null
    };
  } catch {
    return inactive;
  }
}
var OMC_SKILLS = {
  analyze: "/oh-my-claudecode:analyze",
  plan: "/oh-my-claudecode:plan",
  autopilot: "/oh-my-claudecode:autopilot",
  tdd: "/oh-my-claudecode:tdd",
  "git-master": "/oh-my-claudecode:git-master",
  deepsearch: "/oh-my-claudecode:deepsearch",
  "code-review": "/oh-my-claudecode:code-review",
  "security-review": "/oh-my-claudecode:security-review",
  cancel: "/oh-my-claudecode:cancel",
  ralph: "/oh-my-claudecode:ralph"
};
var AGENT_SKILL_MAP = {
  analyst: { skill: OMC_SKILLS.analyze, model: "opus" },
  planner: { skill: OMC_SKILLS.plan, model: "opus" },
  architect: { skill: void 0, model: "opus" },
  executor: { skill: OMC_SKILLS.autopilot, model: "sonnet" },
  "deep-executor": { skill: OMC_SKILLS.autopilot, model: "opus" },
  "test-engineer": { skill: OMC_SKILLS.tdd, model: "sonnet" },
  verifier: { skill: void 0, model: "sonnet" },
  "git-master": { skill: OMC_SKILLS["git-master"], model: "sonnet" },
  explore: { skill: OMC_SKILLS.deepsearch, model: "haiku" },
  debugger: { skill: OMC_SKILLS.analyze, model: "sonnet" },
  "quality-reviewer": { skill: OMC_SKILLS["code-review"], model: "sonnet" },
  "security-reviewer": { skill: OMC_SKILLS["security-review"], model: "sonnet" },
  "qa-tester": { skill: void 0, model: "sonnet" }
};
var OMC_NPM_PACKAGE = "oh-my-claude-sisyphus";
var OMC_REGISTRY_URL = `https://registry.npmjs.org/${OMC_NPM_PACKAGE}/latest`;
var HARNESS_NPM_PACKAGE = "carpdm-harness";
var HARNESS_REGISTRY_URL = `https://registry.npmjs.org/${HARNESS_NPM_PACKAGE}/latest`;

// src/core/plan-sync.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, readdirSync, statSync, unlinkSync, mkdirSync, writeFileSync } from "fs";
import { join as join3, dirname } from "path";
import { homedir as homedir2 } from "os";

// src/core/project-paths.ts
import { join as join2 } from "path";
function agentPlanPath(projectRoot) {
  return join2(projectRoot, ".agent", "plan.md");
}

// src/core/plan-sync.ts
var CLAUDE_PLANS_DIR = join3(homedir2(), ".claude", "plans");
function syncPlanFromClaudeCode(projectRoot) {
  if (!existsSync2(CLAUDE_PLANS_DIR)) return { synced: false };
  const cutoff = Date.now() - 36e5;
  const planFiles = readdirSync(CLAUDE_PLANS_DIR).filter((f) => f.endsWith(".md")).map((f) => ({ name: f, mtime: statSync(join3(CLAUDE_PLANS_DIR, f)).mtimeMs })).filter((f) => f.mtime > cutoff).sort((a, b) => b.mtime - a.mtime);
  if (planFiles.length === 0) return { synced: false };
  const planPath = agentPlanPath(projectRoot);
  if (existsSync2(planPath)) {
    const existing = readFileSync2(planPath, "utf-8");
    if (/APPROVED|IN_PROGRESS/.test(existing)) {
      return { synced: false };
    }
  }
  const latestFile = planFiles[0].name;
  const content = readFileSync2(join3(CLAUDE_PLANS_DIR, latestFile), "utf-8");
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const wrapped = `# Plan: (Claude Code plan mode\uC5D0\uC11C \uB3D9\uAE30\uD654\uB428)

> \uC0C1\uD0DC: DRAFT
> \uB3D9\uAE30\uD654: ${now}
> \uC6D0\uBCF8: ~/.claude/plans/${latestFile}

${content}
`;
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, wrapped, "utf-8");
  return { synced: true, source: latestFile };
}
function cleanupStalePlans(maxAgeDays = 7) {
  if (!existsSync2(CLAUDE_PLANS_DIR)) return 0;
  const cutoff = Date.now() - maxAgeDays * 864e5;
  const files = readdirSync(CLAUDE_PLANS_DIR).filter((f) => f.endsWith(".md"));
  let removed = 0;
  for (const f of files) {
    const fpath = join3(CLAUDE_PLANS_DIR, f);
    try {
      if (statSync(fpath).mtimeMs < cutoff) {
        unlinkSync(fpath);
        removed++;
      }
    } catch {
    }
  }
  return removed;
}

// src/hooks/session-end.ts
process.on("uncaughtException", (error) => {
  try {
    process.stderr.write(`[harness-session-end] Uncaught exception: ${error?.message || error}
`);
  } catch {
  }
  try {
    process.stdout.write(JSON.stringify({ result: "continue" }) + "\n");
  } catch {
  }
  process.exit(0);
});
process.on("unhandledRejection", (error) => {
  try {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[harness-session-end] Unhandled rejection: ${msg}
`);
  } catch {
  }
  try {
    process.stdout.write(JSON.stringify({ result: "continue" }) + "\n");
  } catch {
  }
  process.exit(0);
});
var safetyTimeout = setTimeout(() => {
  try {
    process.stderr.write("[harness-session-end] Safety timeout reached, forcing exit\n");
  } catch {
  }
  try {
    process.stdout.write(JSON.stringify({ result: "continue" }) + "\n");
  } catch {
  }
  process.exit(0);
}, 1e4);
var STALE_STATE_THRESHOLD_MS = 2 * 60 * 60 * 1e3;
var SESSION_ID_ALLOWLIST = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,255}$/;
function readJsonFile(filePath) {
  try {
    if (!existsSync3(filePath)) return null;
    return JSON.parse(readFileSync3(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function writeJsonFile(filePath, data) {
  try {
    const dir = dirname2(filePath);
    if (dir && dir !== "." && !existsSync3(dir)) {
      mkdirSync2(dir, { recursive: true });
    }
    writeFileSync2(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}
function isStaleState(state) {
  if (!state) return true;
  const lastChecked = state.last_checked_at ? new Date(state.last_checked_at).getTime() : 0;
  const startedAt = state.started_at ? new Date(state.started_at).getTime() : 0;
  const mostRecent = Math.max(lastChecked, startedAt);
  if (mostRecent === 0) return true;
  const age = Date.now() - mostRecent;
  return age > STALE_STATE_THRESHOLD_MS;
}
function normalizePath(p) {
  if (!p) return "";
  let normalized = resolve(p);
  normalized = normalize(normalized);
  normalized = normalized.replace(/[/\\]+$/, "");
  if (process.platform === "win32") {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}
function isStateForCurrentProject(state, currentDirectory, isGlobalState = false) {
  if (!state) return true;
  if (!state.project_path) {
    if (isGlobalState) return false;
    return true;
  }
  return normalizePath(state.project_path) === normalizePath(currentDirectory);
}
function isContextLimitStop(data) {
  const reason = (data.stop_reason || data.stopReason || "").toString().toLowerCase();
  const contextPatterns = [
    "context_limit",
    "context_window",
    "context_exceeded",
    "context_full",
    "max_context",
    "token_limit",
    "max_tokens",
    "conversation_too_long",
    "input_too_long"
  ];
  if (contextPatterns.some((p) => reason.includes(p))) return true;
  const endTurnReason = (data.end_turn_reason || data.endTurnReason || "").toString().toLowerCase();
  if (endTurnReason && contextPatterns.some((p) => endTurnReason.includes(p))) {
    return true;
  }
  return false;
}
function isUserAbort(data) {
  if (data.user_requested || data.userRequested) return true;
  const reason = (data.stop_reason || data.stopReason || "").toString().toLowerCase();
  const exactPatterns = ["aborted", "abort", "cancel", "interrupt"];
  const substringPatterns = [
    "user_cancel",
    "user_interrupt",
    "ctrl_c",
    "manual_stop"
  ];
  return exactPatterns.some((p) => reason === p) || substringPatterns.some((p) => reason.includes(p));
}
function sanitizeSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== "string") return "";
  return SESSION_ID_ALLOWLIST.test(sessionId) ? sessionId : "";
}
function isValidSessionId(sessionId) {
  return typeof sessionId === "string" && SESSION_ID_ALLOWLIST.test(sessionId);
}
function readStateFile(stateDir, globalStateDir, filename) {
  const localPath = join4(stateDir, filename);
  const globalPath = join4(globalStateDir, filename);
  let state = readJsonFile(localPath);
  if (state) return { state, path: localPath, isGlobal: false };
  state = readJsonFile(globalPath);
  if (state) return { state, path: globalPath, isGlobal: true };
  return { state: null, path: localPath, isGlobal: false };
}
function readStateFileWithSession(stateDir, globalStateDir, filename, sessionId) {
  const safeSessionId = sanitizeSessionId(sessionId);
  if (safeSessionId) {
    const sessionsDir = join4(stateDir, "sessions", safeSessionId);
    const sessionPath = join4(sessionsDir, filename);
    const state = readJsonFile(sessionPath);
    return { state, path: sessionPath, isGlobal: false };
  }
  return readStateFile(stateDir, globalStateDir, filename);
}
function readLastToolError(harnessDir) {
  const errorPath = join4(harnessDir, "last-tool-error.json");
  const toolError = readJsonFile(errorPath);
  if (!toolError || !toolError.timestamp) return null;
  const parsedTime = new Date(toolError.timestamp).getTime();
  if (!Number.isFinite(parsedTime)) return null;
  const age = Date.now() - parsedTime;
  if (age > 6e4) return null;
  return toolError;
}
function getToolErrorRetryGuidance(toolError) {
  if (!toolError) return "";
  const retryCount = toolError.retry_count || 1;
  const toolName = toolError.tool_name || "unknown";
  const error = toolError.error || "Unknown error";
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
function countIncompleteTasks(sessionId) {
  if (!sessionId || typeof sessionId !== "string") return 0;
  if (!SESSION_ID_ALLOWLIST.test(sessionId)) return 0;
  const taskDir = join4(homedir3(), ".claude", "tasks", sessionId);
  if (!existsSync3(taskDir)) return 0;
  let count = 0;
  try {
    const files = readdirSync2(taskDir).filter(
      (f) => f.endsWith(".json") && f !== ".lock"
    );
    for (const file of files) {
      try {
        const content = readFileSync3(join4(taskDir, file), "utf-8");
        const task = JSON.parse(content);
        if (task.status === "pending" || task.status === "in_progress") count++;
      } catch {
      }
    }
  } catch {
  }
  return count;
}
function countIncompleteTodos(sessionId, projectDir) {
  let count = 0;
  if (sessionId && typeof sessionId === "string" && SESSION_ID_ALLOWLIST.test(sessionId)) {
    const sessionTodoPath = join4(
      homedir3(),
      ".claude",
      "todos",
      `${sessionId}.json`
    );
    try {
      const data = readJsonFile(sessionTodoPath);
      const todos = Array.isArray(data) ? data : Array.isArray(data?.todos) ? data.todos : [];
      count += todos.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled"
      ).length;
    } catch {
    }
  }
  for (const path of [
    omcTodosPath(projectDir),
    join4(projectDir, ".claude", "todos.json")
  ]) {
    try {
      const data = readJsonFile(path);
      const todos = Array.isArray(data) ? data : Array.isArray(data?.todos) ? data.todos : [];
      count += todos.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled"
      ).length;
    } catch {
    }
  }
  return count;
}
function checkPersistentMode(input) {
  const directory = input.cwd || input.directory || process.cwd();
  const sessionIdRaw = input.sessionId || input.session_id || input.sessionid || "";
  const sessionId = sanitizeSessionId(sessionIdRaw);
  const hasValidSession = isValidSessionId(sessionIdRaw);
  const stateDir = omcStateDir(directory);
  const globalStateDir = omcGlobalStateDir();
  const harnessDir = harnessStateDir(directory);
  if (isContextLimitStop(input)) {
    return { blocked: false, output: JSON.stringify({ result: "continue" }) };
  }
  if (isUserAbort(input)) {
    return { blocked: false, output: JSON.stringify({ result: "continue" }) };
  }
  const ralph = readStateFileWithSession(stateDir, globalStateDir, "ralph-state.json", sessionId);
  const autopilot = readStateFileWithSession(stateDir, globalStateDir, "autopilot-state.json", sessionId);
  const ultrapilot = readStateFileWithSession(stateDir, globalStateDir, "ultrapilot-state.json", sessionId);
  const ultrawork = readStateFileWithSession(stateDir, globalStateDir, "ultrawork-state.json", sessionId);
  const ecomode = readStateFileWithSession(stateDir, globalStateDir, "ecomode-state.json", sessionId);
  const ultraqa = readStateFileWithSession(stateDir, globalStateDir, "ultraqa-state.json", sessionId);
  const pipeline = readStateFileWithSession(stateDir, globalStateDir, "pipeline-state.json", sessionId);
  const swarmMarker = existsSync3(omcSwarmMarkerPath(directory));
  const swarmSummary = readJsonFile(omcSwarmSummaryPath(directory));
  const taskCount = countIncompleteTasks(sessionId);
  const todoCount = countIncompleteTodos(sessionId, directory);
  const totalIncomplete = taskCount + todoCount;
  const sessionMatches = (state) => {
    if (!state) return false;
    return hasValidSession ? state.session_id === sessionId : !state.session_id || state.session_id === sessionId;
  };
  const ralphTodo = readStateFileWithSession(stateDir, globalStateDir, "ralph-todo-state.json", sessionId);
  if (ralphTodo.state?.active && !isStaleState(ralphTodo.state) && isStateForCurrentProject(ralphTodo.state, directory, ralphTodo.isGlobal) && sessionMatches(ralphTodo.state)) {
    const todoState = ralphTodo.state;
    const globalIter = todoState.global_iteration ?? 0;
    const globalMax = todoState.global_max_iterations ?? 100;
    if (globalIter >= globalMax) {
      todoState.active = false;
      todoState.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
      writeJsonFile(ralphTodo.path, todoState);
    } else {
      const todoSearchPaths = [
        join4(directory, ".agent", "todo.md"),
        join4(directory, "todo.md")
      ];
      let todoTasks = [];
      for (const tp of todoSearchPaths) {
        if (!existsSync3(tp)) continue;
        try {
          const content = readFileSync3(tp, "utf-8");
          const lines = content.split("\n");
          for (const line of lines) {
            const match = line.trim().match(/^-\s+\[([ xX])\]\s+(.+)/);
            if (!match) continue;
            const done = match[1].toLowerCase() === "x";
            const text = match[2].replace(/\s*←\s*CURRENT\s*/gi, "").trim();
            todoTasks.push({ index: todoTasks.length, text, done });
          }
          break;
        } catch {
          continue;
        }
      }
      const currentIdx = todoState.current_task_index ?? 0;
      const taskIter = todoState.task_iteration ?? 0;
      const taskMax = todoState.task_max_iterations ?? 15;
      if (todoTasks.length === 0) {
        todoState.active = false;
        todoState.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
        writeJsonFile(ralphTodo.path, todoState);
      } else {
        const currentTask = todoTasks[currentIdx];
        if (currentTask && currentTask.done) {
          const completed = todoState.completed_task_indices ?? [];
          if (!completed.includes(currentIdx)) completed.push(currentIdx);
          todoState.completed_task_indices = completed;
          let nextIdx = -1;
          for (let i = currentIdx + 1; i < todoTasks.length; i++) {
            if (!todoTasks[i].done) {
              nextIdx = i;
              break;
            }
          }
          if (nextIdx < 0) {
            for (let i = 0; i < currentIdx; i++) {
              if (!todoTasks[i].done) {
                nextIdx = i;
                break;
              }
            }
          }
          if (nextIdx < 0) {
            todoState.active = false;
            todoState.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
            writeJsonFile(ralphTodo.path, todoState);
          } else {
            todoState.current_task_index = nextIdx;
            todoState.current_task_text = todoTasks[nextIdx].text;
            todoState.task_iteration = 0;
            todoState.global_iteration = globalIter + 1;
            todoState.total_tasks = todoTasks.length;
            todoState.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
            writeJsonFile(ralphTodo.path, todoState);
            const toolError = readLastToolError(harnessDir);
            const errorGuidance = getToolErrorRetryGuidance(toolError);
            let reason = `[RALPH-TODO: Task ${nextIdx + 1}/${todoTasks.length} | Iteration 1/${taskMax}]
Current task: ${todoTasks[nextIdx].text}

Previous task completed. Continue with the next task.
When this task is done, update todo.md: change [ ] to [x].
When ALL tasks are complete, run /oh-my-claudecode:cancel to exit.`;
            if (todoState.original_prompt) {
              reason += `
Original request: ${todoState.original_prompt}`;
            }
            if (errorGuidance) reason = errorGuidance + reason;
            return { blocked: true, output: JSON.stringify({ decision: "block", reason }) };
          }
        } else if (taskIter >= taskMax) {
          const skipped = todoState.skipped_task_indices ?? [];
          if (!skipped.includes(currentIdx)) skipped.push(currentIdx);
          todoState.skipped_task_indices = skipped;
          let nextIdx = -1;
          for (let i = currentIdx + 1; i < todoTasks.length; i++) {
            if (!todoTasks[i].done && !skipped.includes(i)) {
              nextIdx = i;
              break;
            }
          }
          if (nextIdx < 0) {
            for (let i = 0; i < currentIdx; i++) {
              if (!todoTasks[i].done && !skipped.includes(i)) {
                nextIdx = i;
                break;
              }
            }
          }
          if (nextIdx < 0 || nextIdx === currentIdx) {
            todoState.active = false;
            todoState.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
            writeJsonFile(ralphTodo.path, todoState);
          } else {
            todoState.current_task_index = nextIdx;
            todoState.current_task_text = todoTasks[nextIdx].text;
            todoState.task_iteration = 0;
            todoState.global_iteration = globalIter + 1;
            todoState.total_tasks = todoTasks.length;
            todoState.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
            writeJsonFile(ralphTodo.path, todoState);
            const toolError = readLastToolError(harnessDir);
            const errorGuidance = getToolErrorRetryGuidance(toolError);
            let reason = `[SKIPPED] Previous task exceeded ${taskMax} iterations.

[RALPH-TODO: Task ${nextIdx + 1}/${todoTasks.length} | Iteration 1/${taskMax}]
Current task: ${todoTasks[nextIdx].text}

Continue with this task. When done, update todo.md: change [ ] to [x].
When ALL tasks are complete, run /oh-my-claudecode:cancel to exit.`;
            if (errorGuidance) reason = errorGuidance + reason;
            return { blocked: true, output: JSON.stringify({ decision: "block", reason }) };
          }
        } else {
          todoState.task_iteration = taskIter + 1;
          todoState.global_iteration = globalIter + 1;
          todoState.total_tasks = todoTasks.length;
          todoState.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
          writeJsonFile(ralphTodo.path, todoState);
          const toolError = readLastToolError(harnessDir);
          const errorGuidance = getToolErrorRetryGuidance(toolError);
          const taskText = currentTask?.text ?? todoState.current_task_text ?? "Unknown task";
          let reason = `[RALPH-TODO: Task ${currentIdx + 1}/${todoTasks.length} | Iteration ${taskIter + 2}/${taskMax}]
Current task: ${taskText}

Work is NOT done. Continue working on this task.
When complete, update todo.md: change [ ] to [x] for this item.
When ALL tasks are complete, run /oh-my-claudecode:cancel to exit.`;
          if (todoState.original_prompt) {
            reason += `
Original request: ${todoState.original_prompt}`;
          }
          if (errorGuidance) reason = errorGuidance + reason;
          return { blocked: true, output: JSON.stringify({ decision: "block", reason }) };
        }
      }
    }
  }
  if (ralph.state?.active && !isStaleState(ralph.state) && isStateForCurrentProject(ralph.state, directory, ralph.isGlobal) && sessionMatches(ralph.state)) {
    const iteration = ralph.state.iteration || 1;
    const maxIter = ralph.state.max_iterations || 100;
    if (iteration < maxIter) {
      const toolError = readLastToolError(harnessDir);
      const errorGuidance = getToolErrorRetryGuidance(toolError);
      ralph.state.iteration = iteration + 1;
      ralph.state.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
      writeJsonFile(ralph.path, ralph.state);
      let reason = `[RALPH LOOP - ITERATION ${iteration + 1}/${maxIter}] Work is NOT done. Continue working.
When FULLY complete (after Architect verification), run /oh-my-claudecode:cancel to cleanly exit ralph mode and clean up all state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.
${ralph.state.prompt ? `Task: ${ralph.state.prompt}` : ""}`;
      if (errorGuidance) {
        reason = errorGuidance + reason;
      }
      return {
        blocked: true,
        output: JSON.stringify({ decision: "block", reason })
      };
    }
  }
  if (autopilot.state?.active && !isStaleState(autopilot.state) && isStateForCurrentProject(autopilot.state, directory, autopilot.isGlobal) && sessionMatches(autopilot.state)) {
    const phase = autopilot.state.phase || "unspecified";
    if (phase !== "complete") {
      const newCount = (autopilot.state.reinforcement_count || 0) + 1;
      if (newCount <= 20) {
        const toolError = readLastToolError(harnessDir);
        const errorGuidance = getToolErrorRetryGuidance(toolError);
        autopilot.state.reinforcement_count = newCount;
        autopilot.state.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
        writeJsonFile(autopilot.path, autopilot.state);
        let reason = `[AUTOPILOT - Phase: ${phase}] Autopilot not complete. Continue working. When all phases are complete, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
        if (errorGuidance) {
          reason = errorGuidance + reason;
        }
        return {
          blocked: true,
          output: JSON.stringify({ decision: "block", reason })
        };
      }
    }
  }
  if (ultrapilot.state?.active && !isStaleState(ultrapilot.state) && isStateForCurrentProject(ultrapilot.state, directory, ultrapilot.isGlobal) && sessionMatches(ultrapilot.state)) {
    const workers = ultrapilot.state.workers || [];
    const incomplete = workers.filter(
      (w) => w.status !== "complete" && w.status !== "failed"
    ).length;
    if (incomplete > 0) {
      const newCount = (ultrapilot.state.reinforcement_count || 0) + 1;
      if (newCount <= 20) {
        const toolError = readLastToolError(harnessDir);
        const errorGuidance = getToolErrorRetryGuidance(toolError);
        ultrapilot.state.reinforcement_count = newCount;
        ultrapilot.state.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
        writeJsonFile(ultrapilot.path, ultrapilot.state);
        let reason = `[ULTRAPILOT] ${incomplete} workers still running. Continue working. When all workers complete, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
        if (errorGuidance) {
          reason = errorGuidance + reason;
        }
        return {
          blocked: true,
          output: JSON.stringify({ decision: "block", reason })
        };
      }
    }
  }
  if (swarmMarker && swarmSummary?.active && !isStaleState(swarmSummary) && isStateForCurrentProject(swarmSummary, directory, false)) {
    const pending = (swarmSummary.tasks_pending || 0) + (swarmSummary.tasks_claimed || 0);
    if (pending > 0) {
      const newCount = (swarmSummary.reinforcement_count || 0) + 1;
      if (newCount <= 15) {
        const toolError = readLastToolError(harnessDir);
        const errorGuidance = getToolErrorRetryGuidance(toolError);
        swarmSummary.reinforcement_count = newCount;
        swarmSummary.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
        writeJsonFile(omcSwarmSummaryPath(directory), swarmSummary);
        let reason = `[SWARM ACTIVE] ${pending} tasks remain. Continue working. When all tasks are done, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
        if (errorGuidance) {
          reason = errorGuidance + reason;
        }
        return {
          blocked: true,
          output: JSON.stringify({ decision: "block", reason })
        };
      }
    }
  }
  try {
    const rufloStatus = detectRufloSwarmStatus(directory);
    if (rufloStatus.active && rufloStatus.agentCount > 0) {
      const isRufloStale = !rufloStatus.timestamp || Date.now() - new Date(rufloStatus.timestamp).getTime() > STALE_STATE_THRESHOLD_MS;
      if (!isRufloStale) {
        const countPath = join4(harnessDir, "ruflo-reinforcement.json");
        const countData = readJsonFile(countPath);
        const newCount = (countData?.count || 0) + 1;
        if (newCount <= 10) {
          writeJsonFile(countPath, { count: newCount, lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString() });
          const toolError = readLastToolError(harnessDir);
          const errorGuidance = getToolErrorRetryGuidance(toolError);
          let reason = `[RUFLO SWARM ACTIVE] claude-flow swarm running with ${rufloStatus.agentCount} agents. Do not end session. To stop: use ruflo swarm_shutdown tool.`;
          if (errorGuidance) {
            reason = errorGuidance + reason;
          }
          return {
            blocked: true,
            output: JSON.stringify({ decision: "block", reason })
          };
        }
      }
    }
  } catch {
  }
  if (pipeline.state?.active && !isStaleState(pipeline.state) && isStateForCurrentProject(pipeline.state, directory, pipeline.isGlobal) && sessionMatches(pipeline.state)) {
    const currentStage = pipeline.state.current_stage || 0;
    const totalStages = pipeline.state.stages?.length || 0;
    if (currentStage < totalStages) {
      const newCount = (pipeline.state.reinforcement_count || 0) + 1;
      if (newCount <= 15) {
        const toolError = readLastToolError(harnessDir);
        const errorGuidance = getToolErrorRetryGuidance(toolError);
        pipeline.state.reinforcement_count = newCount;
        pipeline.state.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
        writeJsonFile(pipeline.path, pipeline.state);
        let reason = `[PIPELINE - Stage ${currentStage + 1}/${totalStages}] Pipeline not complete. Continue working. When all stages complete, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
        if (errorGuidance) {
          reason = errorGuidance + reason;
        }
        return {
          blocked: true,
          output: JSON.stringify({ decision: "block", reason })
        };
      }
    }
  }
  if (ultraqa.state?.active && !isStaleState(ultraqa.state) && isStateForCurrentProject(ultraqa.state, directory, ultraqa.isGlobal) && sessionMatches(ultraqa.state)) {
    const cycle = ultraqa.state.cycle || 1;
    const maxCycles = ultraqa.state.max_cycles || 10;
    if (cycle < maxCycles && !ultraqa.state.all_passing) {
      const toolError = readLastToolError(harnessDir);
      const errorGuidance = getToolErrorRetryGuidance(toolError);
      ultraqa.state.cycle = cycle + 1;
      ultraqa.state.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
      writeJsonFile(ultraqa.path, ultraqa.state);
      let reason = `[ULTRAQA - Cycle ${cycle + 1}/${maxCycles}] Tests not all passing. Continue fixing. When all tests pass, run /oh-my-claudecode:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force.`;
      if (errorGuidance) {
        reason = errorGuidance + reason;
      }
      return {
        blocked: true,
        output: JSON.stringify({ decision: "block", reason })
      };
    }
  }
  if (ultrawork.state?.active && !isStaleState(ultrawork.state) && isStateForCurrentProject(ultrawork.state, directory, ultrawork.isGlobal) && sessionMatches(ultrawork.state)) {
    const newCount = (ultrawork.state.reinforcement_count || 0) + 1;
    const maxReinforcements = ultrawork.state.max_reinforcements || 50;
    if (newCount <= maxReinforcements) {
      const toolError = readLastToolError(harnessDir);
      const errorGuidance = getToolErrorRetryGuidance(toolError);
      ultrawork.state.reinforcement_count = newCount;
      ultrawork.state.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
      writeJsonFile(ultrawork.path, ultrawork.state);
      let reason = `[ULTRAWORK #${newCount}/${maxReinforcements}] Mode active.`;
      if (totalIncomplete > 0) {
        const itemType = taskCount > 0 ? "Tasks" : "todos";
        reason += ` ${totalIncomplete} incomplete ${itemType} remain. Continue working.`;
      } else if (newCount >= 3) {
        reason += ` If all work is complete, run /oh-my-claudecode:cancel to cleanly exit ultrawork mode and clean up state files. If cancel fails, retry with /oh-my-claudecode:cancel --force. Otherwise, continue working.`;
      } else {
        reason += ` Continue working - create Tasks to track your progress.`;
      }
      if (ultrawork.state.original_prompt) {
        reason += `
Task: ${ultrawork.state.original_prompt}`;
      }
      if (errorGuidance) {
        reason = errorGuidance + reason;
      }
      return {
        blocked: true,
        output: JSON.stringify({ decision: "block", reason })
      };
    }
  }
  if (ecomode.state?.active && !isStaleState(ecomode.state) && isStateForCurrentProject(ecomode.state, directory, ecomode.isGlobal) && sessionMatches(ecomode.state)) {
    const newCount = (ecomode.state.reinforcement_count || 0) + 1;
    const maxReinforcements = ecomode.state.max_reinforcements || 50;
    if (newCount <= maxReinforcements) {
      const toolError = readLastToolError(harnessDir);
      const errorGuidance = getToolErrorRetryGuidance(toolError);
      ecomode.state.reinforcement_count = newCount;
      ecomode.state.last_checked_at = (/* @__PURE__ */ new Date()).toISOString();
      writeJsonFile(ecomode.path, ecomode.state);
      let reason = `[ECOMODE #${newCount}/${maxReinforcements}] Mode active.`;
      if (totalIncomplete > 0) {
        const itemType = taskCount > 0 ? "Tasks" : "todos";
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
        output: JSON.stringify({ decision: "block", reason })
      };
    }
  }
  return { blocked: false, output: "" };
}
function checkTeamMemorySync(cwd) {
  const configPath = join4(cwd, "carpdm-harness.config.json");
  if (!existsSync3(configPath)) return null;
  try {
    const config = JSON.parse(readFileSync3(configPath, "utf-8"));
    const omcConfig = config.omcConfig || {};
    const hasTeamMemory = (config.modules || []).includes("team-memory");
    if (omcConfig.autoSync !== false && hasTeamMemory) {
      const teamMemoryPath = join4(cwd, ".harness", "team-memory.json");
      const omcProjMemPath = omcProjectMemoryPath(cwd);
      if (existsSync3(teamMemoryPath) && existsSync3(omcProjMemPath)) {
        try {
          const teamMemory = JSON.parse(readFileSync3(teamMemoryPath, "utf-8"));
          const omcMemory = JSON.parse(readFileSync3(omcProjMemPath, "utf-8"));
          if (teamMemory.conventions && Array.isArray(teamMemory.conventions)) {
            const conventionTexts = teamMemory.conventions.map((c) => c.title || c.content || "").filter(Boolean);
            if (conventionTexts.length > 0) {
              const existingConventions = omcMemory.conventions || "";
              const newConventions = conventionTexts.join("\n");
              if (existingConventions !== newConventions) {
                return "[harness-session-end] \uD300 \uBA54\uBAA8\uB9AC \uBCC0\uACBD \uAC10\uC9C0. `harness_sync`\uB85C OMC \uB3D9\uAE30\uD654\uB97C \uAD8C\uC7A5\uD569\uB2C8\uB2E4.";
              }
            }
          }
        } catch {
        }
      }
    }
  } catch {
  }
  return null;
}
function readFileContent(filePath) {
  try {
    if (!existsSync3(filePath)) return null;
    return readFileSync3(filePath, "utf-8");
  } catch {
    return null;
  }
}
function findAgentFile(cwd, name) {
  const agentPath = join4(cwd, ".agent", name);
  if (existsSync3(agentPath)) return agentPath;
  const rootPath = join4(cwd, name);
  if (existsSync3(rootPath)) return rootPath;
  return null;
}
function generateHandoff(cwd) {
  const planPath = findAgentFile(cwd, "plan.md");
  const todoPath = findAgentFile(cwd, "todo.md");
  if (!planPath && !todoPath) return;
  const now = /* @__PURE__ */ new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  let planStatus = "UNKNOWN";
  let planTitle = "";
  const planContent = planPath ? readFileContent(planPath) : null;
  if (planContent) {
    const statusMatch = planContent.match(/상태:\s*(DRAFT|APPROVED|IN_PROGRESS|COMPLETED)/);
    if (statusMatch) planStatus = statusMatch[1];
    const titleMatch = planContent.match(/^#\s+Plan:\s*(.+)/m);
    if (titleMatch) planTitle = titleMatch[1];
  }
  let doneItems = [];
  let remainItems = [];
  const todoContent = todoPath ? readFileContent(todoPath) : null;
  if (todoContent) {
    const lines = todoContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- [x]")) {
        doneItems.push(trimmed.replace("- [x] ", ""));
      } else if (trimmed.startsWith("- [ ]")) {
        remainItems.push(trimmed.replace("- [ ] ", ""));
      }
    }
  }
  if (doneItems.length === 0 && remainItems.length === 0 && planStatus === "UNKNOWN") return;
  let changedFiles = [];
  const changeLogPath = join4(cwd, ".harness", "change-log.md");
  const changeLogContent = readFileContent(changeLogPath);
  if (changeLogContent) {
    const lines = changeLogContent.split("\n");
    const fileLines = lines.filter((l) => l.includes("|")).slice(-20);
    for (const line of fileLines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 3 && parts[2] && !parts[2].startsWith("\uD30C\uC77C")) {
        changedFiles.push(parts[2]);
      }
    }
    changedFiles = [...new Set(changedFiles)];
  }
  const doneSection = doneItems.length > 0 ? doneItems.map((i) => `- ${i}`).join("\n") : "- (\uC774\uBC88 \uC138\uC158\uC5D0\uC11C \uC644\uB8CC\uD55C \uD56D\uBAA9 \uC5C6\uC74C)";
  const remainSection = remainItems.length > 0 ? remainItems.map((i) => `- ${i}`).join("\n") : "- (\uB0A8\uC740 \uC791\uC5C5 \uC5C6\uC74C)";
  const filesSection = changedFiles.length > 0 ? changedFiles.map((f) => `- ${f}`).join("\n") : "- (\uBCC0\uACBD \uD30C\uC77C \uC815\uBCF4 \uC5C6\uC74C)";
  const handoffContent = `# Handoff: \uC138\uC158 \uC778\uC218\uC778\uACC4

> \uC0DD\uC131\uC77C: ${dateStr}
> \uC790\uB3D9 \uC0DD\uC131\uB428 (session-end hook)

## \uD604\uC7AC \uC0C1\uD0DC

- **Plan**: ${planTitle || "(\uC81C\uBAA9 \uC5C6\uC74C)"} \u2014 ${planStatus}
- **\uC9C4\uD589\uB960**: ${doneItems.length}/${doneItems.length + remainItems.length} completed

## \uC644\uB8CC \uD56D\uBAA9

${doneSection}

## \uBBF8\uC644\uB8CC \uD56D\uBAA9

${remainSection}

## \uBCC0\uACBD \uD30C\uC77C

${filesSection}
`;
  const handoffPath = join4(cwd, ".agent", "handoff.md");
  const handoffDir = dirname2(handoffPath);
  if (!existsSync3(handoffDir)) {
    mkdirSync2(handoffDir, { recursive: true });
  }
  writeFileSync2(handoffPath, handoffContent, "utf-8");
}
function appendSessionLog(cwd) {
  const todoPath = findAgentFile(cwd, "todo.md");
  const planPath = findAgentFile(cwd, "plan.md");
  if (!todoPath) return;
  const todoContent = readFileContent(todoPath);
  if (!todoContent) return;
  const doneCount = (todoContent.match(/- \[x\]/g) || []).length;
  const remainCount = (todoContent.match(/- \[ \]/g) || []).length;
  if (doneCount === 0) return;
  const now = /* @__PURE__ */ new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  let planTitle = "";
  const planContent = planPath ? readFileContent(planPath) : null;
  if (planContent) {
    const titleMatch = planContent.match(/^#\s+Plan:\s*(.+)/m);
    if (titleMatch) planTitle = titleMatch[1];
  }
  const logEntry = `## [${dateStr}] \uC138\uC158
- **\uBAA9\uD45C**: ${planTitle || "(plan.md \uCC38\uC870)"}
- **\uC9C4\uD589**: ${doneCount}/${doneCount + remainCount} completed${remainCount > 0 ? ` (${remainCount} remaining)` : " \u2014 \uC644\uB8CC"}

`;
  const logPath = join4(cwd, ".agent", "session-log.md");
  const logDir = dirname2(logPath);
  if (!existsSync3(logDir)) {
    mkdirSync2(logDir, { recursive: true });
  }
  if (existsSync3(logPath)) {
    const existing = readFileSync3(logPath, "utf-8");
    const separatorIdx = existing.indexOf("\n---\n");
    if (separatorIdx !== -1) {
      const header = existing.slice(0, separatorIdx + 5);
      const body = existing.slice(separatorIdx + 5);
      writeFileSync2(logPath, header + "\n" + logEntry + body, "utf-8");
    } else {
      writeFileSync2(logPath, existing + "\n" + logEntry, "utf-8");
    }
  } else {
    writeFileSync2(logPath, `# Session Log

> \uC138\uC158 \uC885\uB8CC \uC2DC \uC790\uB3D9\uC73C\uB85C \uD56D\uBAA9\uC774 \uCD94\uAC00\uB429\uB2C8\uB2E4.
> \uCD5C\uC2E0 \uC138\uC158\uC774 \uB9E8 \uC704\uC5D0 \uC704\uCE58\uD569\uB2C8\uB2E4.

---

${logEntry}`, "utf-8");
  }
}
function checkBugModeCompletion(cwd) {
  const stateDir = harnessStateDir(cwd);
  const taskModePath = join4(stateDir, "task-mode");
  if (!existsSync3(taskModePath)) return null;
  try {
    const mode = readFileSync3(taskModePath, "utf-8").trim();
    if (!mode.startsWith("BugFix")) return null;
    return '[harness-session-end] Bug Mode \uC138\uC158\uC774 \uC885\uB8CC\uB429\uB2C8\uB2E4. \uC218\uC815\uD55C \uBC84\uADF8\uAC00 \uC788\uB2E4\uBA74 harness_bug_report \uB610\uB294 harness_memory_add(category:"bugs")\uB85C \uAE30\uB85D\uD558\uBA74 \uD300 \uCD94\uC801\uC774 \uAC00\uB2A5\uD569\uB2C8\uB2E4.';
  } catch {
    return null;
  }
}
function checkClaudeMdSync(cwd) {
  const configPath = join4(cwd, "carpdm-harness.config.json");
  if (!existsSync3(configPath)) return null;
  const claudeMdPath = join4(cwd, "CLAUDE.md");
  if (!existsSync3(claudeMdPath)) return null;
  try {
    const content = readFileSync3(claudeMdPath, "utf-8");
    const MARKER_START = "<!-- harness:auto:start -->";
    const MARKER_END = "<!-- harness:auto:end -->";
    const startIdx = content.indexOf(MARKER_START);
    const endIdx = content.indexOf(MARKER_END);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
    const config = JSON.parse(readFileSync3(configPath, "utf-8"));
    const modules = (config.modules || []).join(", ") || "(\uC5C6\uC74C)";
    const preset = config.preset || "unknown";
    const currentAuto = content.slice(startIdx + MARKER_START.length, endIdx).trim();
    if (!currentAuto.includes(preset) || !currentAuto.includes(modules)) {
      return "[harness-session-end] CLAUDE.md \uC790\uB3D9 \uC139\uC158\uC774 \uD604\uC7AC \uC124\uC815\uACFC \uB2E4\uB985\uB2C8\uB2E4. `harness_sync` \uB610\uB294 `/carpdm-harness:sync`\uB85C \uAC31\uC2E0\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.";
    }
  } catch {
  }
  return null;
}
function syncMemoryMd(cwd) {
  const teamMemoryPath = join4(cwd, ".harness", "team-memory.json");
  if (!existsSync3(teamMemoryPath)) return;
  const memoryMdPath = join4(cwd, ".agent", "memory.md");
  if (!existsSync3(memoryMdPath)) return;
  const MARKER_START = "<!-- harness:team-memory:start -->";
  const MARKER_END = "<!-- harness:team-memory:end -->";
  const raw = readFileSync3(teamMemoryPath, "utf-8");
  const data = JSON.parse(raw);
  const entries = data.entries || [];
  if (entries.length === 0) return;
  const recent = entries.slice(-20);
  const lines = recent.map((e) => {
    const date = (e.addedAt || "").slice(0, 10);
    const cat = e.category || "general";
    return `- **[${cat}]** ${e.title || "(\uBB34\uC81C)"}${date ? ` _(${date})_` : ""}`;
  });
  const newSection = lines.join("\n");
  let content = readFileSync3(memoryMdPath, "utf-8");
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    content = content.slice(0, startIdx + MARKER_START.length) + "\n" + newSection + "\n" + content.slice(endIdx);
  } else {
    content += "\n\n" + MARKER_START + "\n" + newSection + "\n" + MARKER_END + "\n";
  }
  writeFileSync2(memoryMdPath, content, "utf-8");
}
function checkOntologyStale(cwd) {
  const cachePath = join4(cwd, ".agent", "ontology", ".cache", "domain-cache.json");
  if (!existsSync3(cachePath)) return null;
  const raw = readFileSync3(cachePath, "utf-8");
  const cache = JSON.parse(raw);
  if (!cache.builtAt) return null;
  const builtAt = new Date(cache.builtAt).getTime();
  const now = Date.now();
  const hoursSinceBuilt = (now - builtAt) / (1e3 * 60 * 60);
  if (hoursSinceBuilt > 24) {
    const days = Math.floor(hoursSinceBuilt / 24);
    return `[harness-session-end] \uC628\uD1A8\uB85C\uC9C0 \uB3C4\uBA54\uC778 \uCE90\uC2DC\uAC00 ${days}\uC77C \uACBD\uACFC\uD588\uC2B5\uB2C8\uB2E4. \`harness_ontology_refresh\` \uB610\uB294 \`/generate-ontology\`\uB85C \uAC31\uC2E0\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.`;
  }
  return null;
}
function main() {
  let input;
  try {
    const raw = readFileSync3("/dev/stdin", "utf-8");
    input = JSON.parse(raw);
  } catch {
    process.stdout.write(JSON.stringify({ result: "continue" }));
    return;
  }
  try {
    const persistentResult = checkPersistentMode(input);
    if (persistentResult.blocked) {
      process.stdout.write(persistentResult.output);
      return;
    }
  } catch {
  }
  const cwd = input.cwd || input.directory || process.cwd();
  const messages = [];
  try {
    generateHandoff(cwd);
  } catch {
  }
  try {
    appendSessionLog(cwd);
  } catch {
  }
  try {
    syncMemoryMd(cwd);
  } catch {
  }
  try {
    const planSync = syncPlanFromClaudeCode(cwd);
    if (planSync.synced) {
      messages.push(`[harness-session-end] plan mode \uC124\uACC4\uB97C .agent/plan.md\uB85C \uB3D9\uAE30\uD654\uD588\uC2B5\uB2C8\uB2E4 (DRAFT). \uAD6C\uD604 \uC804 \uC2B9\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.`);
    }
    const cleaned = cleanupStalePlans(7);
    if (cleaned > 0) {
      messages.push(`[harness-session-end] ~/.claude/plans/ \uC815\uB9AC: ${cleaned}\uAC1C \uC624\uB798\uB41C plan \uD30C\uC77C \uC0AD\uC81C`);
    }
  } catch {
  }
  try {
    const m = checkTeamMemorySync(cwd);
    if (m) messages.push(m);
  } catch {
  }
  try {
    const m = checkClaudeMdSync(cwd);
    if (m) messages.push(m);
  } catch {
  }
  try {
    const m = checkBugModeCompletion(cwd);
    if (m) messages.push(m);
  } catch {
  }
  try {
    const m = checkOntologyStale(cwd);
    if (m) messages.push(m);
  } catch {
  }
  if (messages.length > 0) {
    process.stdout.write(JSON.stringify({
      result: "continue",
      additionalContext: messages.join("\n")
    }));
    return;
  }
  process.stdout.write(JSON.stringify({ result: "continue" }));
}
try {
  main();
} catch (error) {
  try {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[harness-session-end] Error: ${msg}
`);
  } catch {
  }
  try {
    process.stdout.write(JSON.stringify({ result: "continue" }) + "\n");
  } catch {
  }
  process.exit(0);
} finally {
  clearTimeout(safetyTimeout);
}
//# sourceMappingURL=session-end.js.map