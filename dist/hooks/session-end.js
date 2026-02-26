// src/hooks/session-end.ts
import { readFileSync, existsSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join as join2, dirname, resolve, normalize } from "path";
import { homedir as homedir2 } from "os";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
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
var OMC_SKILLS = {
  analyze: "/oh-my-claudecode:analyze",
  plan: "/oh-my-claudecode:plan",
  autopilot: "/oh-my-claudecode:autopilot",
  tdd: "/oh-my-claudecode:tdd",
  "git-master": "/oh-my-claudecode:git-master",
  deepsearch: "/oh-my-claudecode:deepsearch",
  "code-review": "/oh-my-claudecode:code-review",
  "security-review": "/oh-my-claudecode:security-review",
  cancel: "/oh-my-claudecode:cancel"
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
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function writeJsonFile(filePath, data) {
  try {
    const dir = dirname(filePath);
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2));
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
  const localPath = join2(stateDir, filename);
  const globalPath = join2(globalStateDir, filename);
  let state = readJsonFile(localPath);
  if (state) return { state, path: localPath, isGlobal: false };
  state = readJsonFile(globalPath);
  if (state) return { state, path: globalPath, isGlobal: true };
  return { state: null, path: localPath, isGlobal: false };
}
function readStateFileWithSession(stateDir, globalStateDir, filename, sessionId) {
  const safeSessionId = sanitizeSessionId(sessionId);
  if (safeSessionId) {
    const sessionsDir = join2(stateDir, "sessions", safeSessionId);
    const sessionPath = join2(sessionsDir, filename);
    const state = readJsonFile(sessionPath);
    return { state, path: sessionPath, isGlobal: false };
  }
  return readStateFile(stateDir, globalStateDir, filename);
}
function readLastToolError(harnessDir) {
  const errorPath = join2(harnessDir, "last-tool-error.json");
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
  const taskDir = join2(homedir2(), ".claude", "tasks", sessionId);
  if (!existsSync(taskDir)) return 0;
  let count = 0;
  try {
    const files = readdirSync(taskDir).filter(
      (f) => f.endsWith(".json") && f !== ".lock"
    );
    for (const file of files) {
      try {
        const content = readFileSync(join2(taskDir, file), "utf-8");
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
    const sessionTodoPath = join2(
      homedir2(),
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
    join2(projectDir, ".claude", "todos.json")
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
  const swarmMarker = existsSync(omcSwarmMarkerPath(directory));
  const swarmSummary = readJsonFile(omcSwarmSummaryPath(directory));
  const taskCount = countIncompleteTasks(sessionId);
  const todoCount = countIncompleteTodos(sessionId, directory);
  const totalIncomplete = taskCount + todoCount;
  const sessionMatches = (state) => {
    if (!state) return false;
    return hasValidSession ? state.session_id === sessionId : !state.session_id || state.session_id === sessionId;
  };
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
  const configPath = join2(cwd, "carpdm-harness.config.json");
  if (!existsSync(configPath)) return null;
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const omcConfig = config.omcConfig || {};
    const hasTeamMemory = (config.modules || []).includes("team-memory");
    if (omcConfig.autoSync !== false && hasTeamMemory) {
      const teamMemoryPath = join2(cwd, ".harness", "team-memory.json");
      const omcProjMemPath = omcProjectMemoryPath(cwd);
      if (existsSync(teamMemoryPath) && existsSync(omcProjMemPath)) {
        try {
          const teamMemory = JSON.parse(readFileSync(teamMemoryPath, "utf-8"));
          const omcMemory = JSON.parse(readFileSync(omcProjMemPath, "utf-8"));
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
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}
function findAgentFile(cwd, name) {
  const agentPath = join2(cwd, ".agent", name);
  if (existsSync(agentPath)) return agentPath;
  const rootPath = join2(cwd, name);
  if (existsSync(rootPath)) return rootPath;
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
  const changeLogPath = join2(cwd, ".harness", "change-log.md");
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
  const handoffPath = join2(cwd, ".agent", "handoff.md");
  const handoffDir = dirname(handoffPath);
  if (!existsSync(handoffDir)) {
    mkdirSync(handoffDir, { recursive: true });
  }
  writeFileSync(handoffPath, handoffContent, "utf-8");
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
  const logPath = join2(cwd, ".agent", "session-log.md");
  const logDir = dirname(logPath);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  if (existsSync(logPath)) {
    const existing = readFileSync(logPath, "utf-8");
    const separatorIdx = existing.indexOf("\n---\n");
    if (separatorIdx !== -1) {
      const header = existing.slice(0, separatorIdx + 5);
      const body = existing.slice(separatorIdx + 5);
      writeFileSync(logPath, header + "\n" + logEntry + body, "utf-8");
    } else {
      writeFileSync(logPath, existing + "\n" + logEntry, "utf-8");
    }
  } else {
    writeFileSync(logPath, `# Session Log

> \uC138\uC158 \uC885\uB8CC \uC2DC \uC790\uB3D9\uC73C\uB85C \uD56D\uBAA9\uC774 \uCD94\uAC00\uB429\uB2C8\uB2E4.
> \uCD5C\uC2E0 \uC138\uC158\uC774 \uB9E8 \uC704\uC5D0 \uC704\uCE58\uD569\uB2C8\uB2E4.

---

${logEntry}`, "utf-8");
  }
}
function checkBugModeCompletion(cwd) {
  const stateDir = harnessStateDir(cwd);
  const taskModePath = join2(stateDir, "task-mode");
  if (!existsSync(taskModePath)) return null;
  try {
    const mode = readFileSync(taskModePath, "utf-8").trim();
    if (!mode.startsWith("BugFix")) return null;
    return '[harness-session-end] Bug Mode \uC138\uC158\uC774 \uC885\uB8CC\uB429\uB2C8\uB2E4. \uC218\uC815\uD55C \uBC84\uADF8\uAC00 \uC788\uB2E4\uBA74 harness_bug_report \uB610\uB294 harness_memory_add(category:"bugs")\uB85C \uAE30\uB85D\uD558\uBA74 \uD300 \uCD94\uC801\uC774 \uAC00\uB2A5\uD569\uB2C8\uB2E4.';
  } catch {
    return null;
  }
}
function checkClaudeMdSync(cwd) {
  const configPath = join2(cwd, "carpdm-harness.config.json");
  if (!existsSync(configPath)) return null;
  const claudeMdPath = join2(cwd, "CLAUDE.md");
  if (!existsSync(claudeMdPath)) return null;
  try {
    const content = readFileSync(claudeMdPath, "utf-8");
    const MARKER_START = "<!-- harness:auto:start -->";
    const MARKER_END = "<!-- harness:auto:end -->";
    const startIdx = content.indexOf(MARKER_START);
    const endIdx = content.indexOf(MARKER_END);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
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
function main() {
  let input;
  try {
    const raw = readFileSync("/dev/stdin", "utf-8");
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
  const syncMessage = checkTeamMemorySync(cwd);
  if (syncMessage) messages.push(syncMessage);
  const claudeMessage = checkClaudeMdSync(cwd);
  if (claudeMessage) messages.push(claudeMessage);
  const bugMessage = checkBugModeCompletion(cwd);
  if (bugMessage) messages.push(bugMessage);
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