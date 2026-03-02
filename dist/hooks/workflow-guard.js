// src/hooks/workflow-guard.ts
import { readFileSync as readFileSync3, existsSync as existsSync3, readdirSync as readdirSync2 } from "fs";
import { join as join3 } from "path";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync } from "fs";

// src/types/workflow.ts
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
var WORKFLOW_DEFINITIONS = {
  feature: {
    name: "feature",
    description: "\uAE30\uB2A5 \uAC1C\uBC1C \uC6CC\uD06C\uD50C\uB85C\uC6B0",
    requiredModules: ["core", "quality"],
    pipeline: [
      { order: 1, agent: "analyst", action: "\uC694\uAD6C\uC0AC\uD56D \uBD84\uC11D", omcSkill: OMC_SKILLS.analyze },
      { order: 2, agent: "planner", action: "\uAD6C\uD604 \uACC4\uD68D \uC218\uB9BD", checkpoint: "\uACC4\uD68D \uC2B9\uC778", omcSkill: OMC_SKILLS.plan },
      { order: 3, agent: "architect", action: "\uC544\uD0A4\uD14D\uCC98 \uAC80\uC99D", optional: true },
      { order: 4, agent: "executor", action: "\uAD6C\uD604", checkpoint: "\uAD6C\uD604 \uC644\uB8CC", omcSkill: OMC_SKILLS.autopilot },
      { order: 5, agent: "quality-reviewer", action: "\uD488\uC9C8 \uAC80\uD1A0", optional: true, omcSkill: OMC_SKILLS["code-review"] },
      { order: 6, agent: "test-engineer", action: "\uD14C\uC2A4\uD2B8 \uC791\uC131/\uC2E4\uD589", omcSkill: OMC_SKILLS.tdd },
      { order: 7, agent: "verifier", action: "\uAC80\uC99D", checkpoint: "\uAC80\uC99D \uD1B5\uACFC", harnessTool: "harness_verify_all" },
      { order: 8, agent: "git-master", action: "\uCEE4\uBC0B/PR", optional: true, omcSkill: OMC_SKILLS["git-master"] }
    ],
    recommendedCapabilities: ["serena", "context7"],
    teamMode: "ralph"
  },
  bugfix: {
    name: "bugfix",
    description: "\uBC84\uADF8 \uC218\uC815 \uC6CC\uD06C\uD50C\uB85C\uC6B0",
    requiredModules: ["core"],
    pipeline: [
      { order: 1, agent: "explore", action: "\uCF54\uB4DC\uBCA0\uC774\uC2A4 \uD0D0\uC0C9", omcSkill: OMC_SKILLS.deepsearch },
      { order: 2, agent: "debugger", action: "\uC6D0\uC778 \uBD84\uC11D", checkpoint: "\uADFC\uBCF8 \uC6D0\uC778 \uD655\uC778", omcSkill: OMC_SKILLS.analyze },
      { order: 3, agent: "executor", action: "\uC218\uC815 \uAD6C\uD604", omcSkill: OMC_SKILLS.autopilot },
      { order: 4, agent: "quality-reviewer", action: "\uC218\uC815 \uAC80\uD1A0", optional: true, omcSkill: OMC_SKILLS["code-review"] },
      { order: 5, agent: "test-engineer", action: "\uD68C\uADC0 \uD14C\uC2A4\uD2B8", omcSkill: OMC_SKILLS.tdd },
      { order: 6, agent: "verifier", action: "\uC218\uC815 \uAC80\uC99D", checkpoint: "\uAC80\uC99D \uD1B5\uACFC", harnessTool: "harness_verify_all" }
    ]
  },
  refactor: {
    name: "refactor",
    description: "\uB9AC\uD329\uD1A0\uB9C1 \uC6CC\uD06C\uD50C\uB85C\uC6B0",
    requiredModules: ["core", "quality"],
    pipeline: [
      { order: 1, agent: "planner", action: "\uB9AC\uD329\uD1A0\uB9C1 \uACC4\uD68D", checkpoint: "\uACC4\uD68D \uC2B9\uC778", omcSkill: OMC_SKILLS.plan },
      { order: 2, agent: "architect", action: "\uC544\uD0A4\uD14D\uCC98 \uB9AC\uBDF0" },
      { order: 3, agent: "executor", action: "\uB9AC\uD329\uD1A0\uB9C1 \uC2E4\uD589", omcSkill: OMC_SKILLS.autopilot },
      { order: 4, agent: "quality-reviewer", action: "\uD488\uC9C8 \uAC80\uD1A0", omcSkill: OMC_SKILLS["code-review"] },
      { order: 5, agent: "verifier", action: "\uAC80\uC99D", checkpoint: "\uAC80\uC99D \uD1B5\uACFC", harnessTool: "harness_verify_all" }
    ],
    recommendedCapabilities: ["serena"],
    teamMode: "autopilot"
  },
  release: {
    name: "release",
    description: "\uB9B4\uB9AC\uC2A4 \uC6CC\uD06C\uD50C\uB85C\uC6B0",
    requiredModules: ["core", "quality", "ship"],
    pipeline: [
      { order: 1, agent: "security-reviewer", action: "\uBCF4\uC548 \uAC80\uD1A0", optional: true, omcSkill: OMC_SKILLS["security-review"] },
      { order: 2, agent: "quality-reviewer", action: "\uB9B4\uB9AC\uC2A4 \uD488\uC9C8 \uAC80\uD1A0", omcSkill: OMC_SKILLS["code-review"] },
      { order: 3, agent: "verifier", action: "\uB9B4\uB9AC\uC2A4 \uC900\uBE44 \uAC80\uC99D", checkpoint: "\uB9B4\uB9AC\uC2A4 \uC900\uBE44 \uC644\uB8CC", harnessTool: "harness_verify_all" },
      { order: 4, agent: "qa-tester", action: "QA \uD14C\uC2A4\uD2B8" },
      { order: 5, agent: "git-master", action: "\uB9B4\uB9AC\uC2A4 \uD0DC\uAE45/\uBC30\uD3EC", omcSkill: OMC_SKILLS["git-master"] }
    ],
    recommendedCapabilities: ["codex"]
  },
  security: {
    name: "security",
    description: "\uBCF4\uC548 \uAC15\uD654 \uC6CC\uD06C\uD50C\uB85C\uC6B0",
    requiredModules: ["core", "security"],
    pipeline: [
      { order: 1, agent: "security-reviewer", action: "\uCDE8\uC57D\uC810 \uC2A4\uCE94", checkpoint: "\uCDE8\uC57D\uC810 \uBAA9\uB85D \uD655\uC815", omcSkill: OMC_SKILLS["security-review"] },
      { order: 2, agent: "executor", action: "\uBCF4\uC548 \uD328\uCE58 \uAD6C\uD604", omcSkill: OMC_SKILLS.autopilot },
      { order: 3, agent: "test-engineer", action: "\uBCF4\uC548 \uD14C\uC2A4\uD2B8", omcSkill: OMC_SKILLS.tdd },
      { order: 4, agent: "verifier", action: "\uBCF4\uC548 \uAC80\uC99D", checkpoint: "\uAC80\uC99D \uD1B5\uACFC", harnessTool: "harness_verify_all" }
    ],
    recommendedCapabilities: ["serena", "codex"]
  }
};

// src/core/omc-compat.ts
function omcStateDir(projectRoot) {
  return join(projectRoot, ".omc", "state");
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
var OMC_NPM_PACKAGE = "oh-my-claude-sisyphus";
var OMC_REGISTRY_URL = `https://registry.npmjs.org/${OMC_NPM_PACKAGE}/latest`;
var HARNESS_NPM_PACKAGE = "carpdm-harness";
var HARNESS_REGISTRY_URL = `https://registry.npmjs.org/${HARNESS_NPM_PACKAGE}/latest`;

// src/hooks/hook-utils.ts
import { readFileSync as readFileSync2, existsSync as existsSync2, readdirSync } from "fs";
import { join as join2 } from "path";
function outputResult(result, additionalContext) {
  const output = { result };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}

// src/hooks/workflow-guard.ts
function main() {
  let input;
  try {
    const raw = readFileSync3("/dev/stdin", "utf-8");
    input = JSON.parse(raw);
  } catch {
    outputResult("continue");
    return;
  }
  const toolName = input.tool_name || "";
  const cwd = input.cwd || process.cwd();
  const activePath = join3(cwd, ".harness", "workflows", "active.json");
  if (!existsSync3(activePath)) {
    if (toolName === "harness_workflow") {
      checkOmcActiveMode(cwd);
      return;
    }
    outputResult("continue");
    return;
  }
  let activeData;
  try {
    activeData = JSON.parse(readFileSync3(activePath, "utf-8"));
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
  const statePath = join3(cwd, ".harness", "workflows", activeId, "state.json");
  if (!existsSync3(statePath)) {
    outputResult("continue");
    return;
  }
  let state;
  try {
    state = JSON.parse(readFileSync3(statePath, "utf-8"));
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
  const CODE_MODIFY_TOOLS = /* @__PURE__ */ new Set(["Edit", "Write", "MultiEdit"]);
  if (state.status === "waiting_checkpoint" && CODE_MODIFY_TOOLS.has(toolName)) {
    contextLines.push(`[BLOCK] \uCCB4\uD06C\uD3EC\uC778\uD2B8 \uC2B9\uC778 \uC804 \uCF54\uB4DC \uC218\uC815 \uC2DC\uB3C4 \uAC10\uC9C0. \uBA3C\uC800 harness_workflow({ action: "approve" })\uB97C \uC2E4\uD589\uD558\uC138\uC694.`);
    if (guardLevel === "block") {
      outputResult("block", contextLines.join("\n"));
      return;
    }
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
  if (!existsSync3(stateDirPath)) {
    outputResult("continue");
    return;
  }
  try {
    const stateFiles = readdirSync2(stateDirPath).filter((f) => f.endsWith("-state.json"));
    for (const file of stateFiles) {
      try {
        const state = JSON.parse(readFileSync3(join3(stateDirPath, file), "utf-8"));
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
  try {
    const rufloStatus = detectRufloSwarmStatus(cwd);
    if (rufloStatus.active) {
      outputResult(
        "continue",
        `[harness-workflow-guard] ruflo swarm \uD65C\uC131 (agents: ${rufloStatus.agentCount}). \uC6CC\uD06C\uD50C\uB85C\uC6B0 \uC2E4\uD589 \uC2DC \uCDA9\uB3CC \uC8FC\uC758.`
      );
      return;
    }
  } catch {
  }
  outputResult("continue");
}
main();
//# sourceMappingURL=workflow-guard.js.map