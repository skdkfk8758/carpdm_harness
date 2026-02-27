// src/hooks/workflow-guard.ts
import { readFileSync, existsSync, readdirSync } from "fs";
import { join as join2 } from "path";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
function omcStateDir(projectRoot) {
  return join(projectRoot, ".omc", "state");
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

// src/hooks/workflow-guard.ts
function main() {
  let input;
  try {
    const raw = readFileSync("/dev/stdin", "utf-8");
    input = JSON.parse(raw);
  } catch {
    outputResult("continue");
    return;
  }
  const toolName = input.tool_name || "";
  const cwd = input.cwd || process.cwd();
  const activePath = join2(cwd, ".harness", "workflows", "active.json");
  if (!existsSync(activePath)) {
    if (toolName === "harness_workflow") {
      checkOmcActiveMode(cwd);
      return;
    }
    outputResult("continue");
    return;
  }
  let activeData;
  try {
    activeData = JSON.parse(readFileSync(activePath, "utf-8"));
  } catch {
    outputResult("continue");
    return;
  }
  const activeId = activeData.activeWorkflowId;
  if (!activeId) {
    if (toolName === "harness_workflow") {
      checkOmcActiveMode(cwd);
      return;
    }
    outputResult("continue");
    return;
  }
  const statePath = join2(cwd, ".harness", "workflows", activeId, "state.json");
  if (!existsSync(statePath)) {
    outputResult("continue");
    return;
  }
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    outputResult("continue");
    return;
  }
  if (state.status === "completed" || state.status === "aborted") {
    outputResult("continue");
    return;
  }
  const guardLevel = state.config?.guardLevel ?? "warn";
  if (guardLevel === "off") {
    outputResult("continue");
    return;
  }
  const currentStepIndex = (state.currentStep ?? 1) - 1;
  const currentStep = state.steps?.[currentStepIndex];
  if (!currentStep) {
    outputResult("continue");
    return;
  }
  const contextLines = [];
  contextLines.push(`[harness-workflow] \uD65C\uC131 \uC6CC\uD06C\uD50C\uB85C\uC6B0: ${state.workflowType ?? "?"} (${activeId})`);
  contextLines.push(`\uD604\uC7AC \uB2E8\uACC4: ${state.currentStep}/${state.totalSteps} - ${currentStep.agent ?? "?"} (${currentStep.action ?? "?"})`);
  if (currentStep.omcSkill) {
    contextLines.push(`OMC \uC2A4\uD0AC: ${currentStep.omcSkill}`);
  }
  const nextStepIndex = currentStepIndex + 1;
  if (state.steps && nextStepIndex < state.steps.length) {
    const nextStep = state.steps[nextStepIndex];
    const skillHint = nextStep.omcSkill ? ` -> ${nextStep.omcSkill}` : "";
    contextLines.push(`\uB2E4\uC74C \uB2E8\uACC4: ${nextStep.agent ?? "?"} (${nextStep.action ?? "?"})${skillHint}`);
  }
  if (state.status === "waiting_checkpoint") {
    contextLines.push(`\uCCB4\uD06C\uD3EC\uC778\uD2B8 \uC2B9\uC778 \uB300\uAE30: ${currentStep.checkpoint ?? "?"}`);
    contextLines.push(`\uC2B9\uC778: harness_workflow({ action: "approve" })`);
    contextLines.push(`\uAC70\uBD80: harness_workflow({ action: "reject" })`);
  } else if (state.status === "failed_step") {
    contextLines.push(`\uB2E8\uACC4 \uC2E4\uD328 - \uC7AC\uC2DC\uB3C4: harness_workflow({ action: "retry" })`);
    contextLines.push(`\uAC74\uB108\uB6F0\uAE30: harness_workflow({ action: "skip" })`);
  } else {
    contextLines.push(`\uB2E8\uACC4 \uC644\uB8CC \uC2DC: harness_workflow({ action: "advance" })`);
  }
  const CLAUDE_BUILTIN_TOOLS = /* @__PURE__ */ new Set([
    "Bash",
    "Read",
    "Edit",
    "Write",
    "MultiEdit",
    "Glob",
    "Grep",
    "WebFetch",
    "WebSearch",
    "Task",
    "TodoWrite",
    "AskUserQuestion",
    "Skill",
    "NotebookEdit"
  ]);
  if (guardLevel === "block" && !toolName.startsWith("harness_") && !CLAUDE_BUILTIN_TOOLS.has(toolName)) {
    outputResult("block", contextLines.join("\n"));
    return;
  }
  outputResult("continue", contextLines.join("\n"));
}
function checkOmcActiveMode(cwd) {
  const stateDirPath = omcStateDir(cwd);
  if (!existsSync(stateDirPath)) {
    outputResult("continue");
    return;
  }
  try {
    const stateFiles = readdirSync(stateDirPath).filter((f) => f.endsWith("-state.json"));
    for (const file of stateFiles) {
      try {
        const state = JSON.parse(readFileSync(join2(stateDirPath, file), "utf-8"));
        if (state.active) {
          const mode = file.replace("-state.json", "");
          outputResult(
            "continue",
            `[harness-workflow-guard] OMC '${mode}' \uBAA8\uB4DC\uAC00 \uD65C\uC131 \uC0C1\uD0DC\uC785\uB2C8\uB2E4. \uC6CC\uD06C\uD50C\uB85C\uC6B0 \uC2E4\uD589 \uC2DC \uBAA8\uB4DC \uCDA9\uB3CC\uC5D0 \uC8FC\uC758\uD558\uC138\uC694.`
          );
          return;
        }
      } catch {
      }
    }
  } catch {
  }
  outputResult("continue");
}
function outputResult(result, additionalContext) {
  const output = { result };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}
main();
//# sourceMappingURL=workflow-guard.js.map