// src/hooks/subagent-context.ts
import { readFileSync as readFileSync2 } from "fs";

// src/hooks/hook-utils.ts
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

// src/hooks/hook-utils.ts
function parseHookInput(stdin) {
  try {
    return JSON.parse(stdin);
  } catch {
    return null;
  }
}
function outputResult(result, additionalContext) {
  const output = { result };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}
function loadActiveWorkflowFromFiles(cwd) {
  const activePath = join2(cwd, ".harness", "workflows", "active.json");
  if (!existsSync(activePath)) {
    return { active: null, instance: null };
  }
  let activeData;
  try {
    activeData = JSON.parse(readFileSync(activePath, "utf-8"));
  } catch {
    return { active: null, instance: null };
  }
  const activeId = activeData.activeWorkflowId;
  if (!activeId) {
    return { active: activeData, instance: null };
  }
  const statePath = join2(cwd, ".harness", "workflows", activeId, "state.json");
  if (!existsSync(statePath)) {
    return { active: activeData, instance: null };
  }
  try {
    const instance = JSON.parse(readFileSync(statePath, "utf-8"));
    return { active: activeData, instance };
  } catch {
    return { active: activeData, instance: null };
  }
}
function detectOmcMode(cwd) {
  const stateDir = omcStateDir(cwd);
  if (!existsSync(stateDir)) return null;
  try {
    const stateFiles = readdirSync(stateDir).filter((f) => f.endsWith("-state.json"));
    for (const file of stateFiles) {
      try {
        const state = JSON.parse(readFileSync(join2(stateDir, file), "utf-8"));
        if (state.active) {
          return file.replace("-state.json", "");
        }
      } catch {
      }
    }
  } catch {
  }
  return null;
}
function buildWorkflowSummary(instance) {
  const lines = [];
  lines.push(`[harness-workflow] ${instance.workflowType ?? "?"} (${instance.id ?? "?"})`);
  lines.push(`\uC0C1\uD0DC: ${instance.status ?? "?"} | \uC9C4\uD589: ${instance.currentStep ?? "?"}/${instance.totalSteps ?? "?"}`);
  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps?.[currentStepIndex];
  if (currentStep) {
    lines.push(`\uD604\uC7AC \uB2E8\uACC4: ${currentStep.agent ?? "?"} \u2014 ${currentStep.action ?? "?"}`);
    if (currentStep.omcSkill) {
      lines.push(`OMC \uC2A4\uD0AC: ${currentStep.omcSkill}`);
    }
  }
  return lines.join(" | ");
}

// src/hooks/subagent-context.ts
function main() {
  let input;
  try {
    const raw = readFileSync2("/dev/stdin", "utf-8");
    input = parseHookInput(raw);
  } catch {
    outputResult("continue");
    return;
  }
  if (!input) {
    outputResult("continue");
    return;
  }
  const cwd = input.cwd || process.cwd();
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (!instance || !instance.status || instance.status === "completed" || instance.status === "aborted") {
    outputResult("continue");
    return;
  }
  const omcMode = detectOmcMode(cwd);
  const relaxedModes = ["team", "swarm", "autopilot", "ultrapilot", "ralph", "ultrawork"];
  const isRelaxed = omcMode !== null && relaxedModes.includes(omcMode);
  const subagentName = input.subagent_name || input.subagent_type || "";
  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps?.[currentStepIndex];
  if (!currentStep) {
    outputResult("continue", buildWorkflowSummary(instance));
    return;
  }
  const isMatched = matchSubagent(subagentName, currentStep);
  if (isMatched) {
    const context = buildDetailedGuide(instance, currentStep, omcMode, isRelaxed);
    outputResult("continue", context);
  } else {
    const summary = buildWorkflowSummary(instance);
    const omcHint = omcMode ? ` | OMC \uBAA8\uB4DC: ${omcMode}` : "";
    outputResult("continue", summary + omcHint);
  }
}
function matchSubagent(subagentName, step) {
  if (!subagentName || !step.agent) return false;
  const normalizedSubagent = subagentName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedAgent = step.agent.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalizedSubagent.includes(normalizedAgent) || normalizedAgent.includes(normalizedSubagent);
}
function buildDetailedGuide(instance, step, omcMode, isRelaxed) {
  const lines = [];
  lines.push(`[harness-workflow] \uD65C\uC131 \uC6CC\uD06C\uD50C\uB85C\uC6B0: ${instance.workflowType ?? "?"} (${instance.id ?? "?"})`);
  lines.push(`\uD604\uC7AC \uB2E8\uACC4: ${instance.currentStep}/${instance.totalSteps} - ${step.agent ?? "?"}`);
  lines.push(`\uC791\uC5C5: ${step.action ?? "?"}`);
  if (step.checkpoint) {
    lines.push(`\uCCB4\uD06C\uD3EC\uC778\uD2B8: ${step.checkpoint}`);
  }
  if (step.omcSkill) {
    lines.push(`OMC \uC2A4\uD0AC: ${step.omcSkill}`);
  }
  const nextStepIndex = instance.currentStep ?? 1;
  if (instance.steps && nextStepIndex < instance.steps.length) {
    const nextStep = instance.steps[nextStepIndex];
    const skillHint = nextStep.omcSkill ? ` -> ${nextStep.omcSkill}` : "";
    lines.push(`\uB2E4\uC74C \uB2E8\uACC4: ${nextStep.agent ?? "?"} (${nextStep.action ?? "?"})${skillHint}`);
  }
  if (instance.status === "waiting_checkpoint") {
    lines.push(`\uCCB4\uD06C\uD3EC\uC778\uD2B8 \uC2B9\uC778 \uB300\uAE30: harness_workflow({ action: "approve" })`);
  } else if (instance.status === "failed_step") {
    lines.push(`\uB2E8\uACC4 \uC2E4\uD328 - \uC7AC\uC2DC\uB3C4: harness_workflow({ action: "retry" })`);
  } else {
    lines.push(`\uB2E8\uACC4 \uC644\uB8CC \uC2DC: harness_workflow({ action: "advance" })`);
  }
  if (omcMode) {
    lines.push(`OMC \uBAA8\uB4DC: ${omcMode}${isRelaxed ? " (\uAC00\uB4DC \uC644\uD654)" : ""}`);
  }
  return lines.join("\n");
}
main();
//# sourceMappingURL=subagent-context.js.map