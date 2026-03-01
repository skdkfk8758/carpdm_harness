// src/hooks/pre-compact.ts
import { readFileSync as readFileSync3 } from "fs";

// src/hooks/hook-utils.ts
import { readFileSync as readFileSync2, existsSync as existsSync2, readdirSync } from "fs";
import { join as join2 } from "path";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync } from "fs";
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
  if (!existsSync2(activePath)) {
    return { active: null, instance: null };
  }
  let activeData;
  try {
    activeData = JSON.parse(readFileSync2(activePath, "utf-8"));
  } catch {
    return { active: null, instance: null };
  }
  const activeId = activeData.activeWorkflowId;
  if (!activeId) {
    return { active: activeData, instance: null };
  }
  const statePath = join2(cwd, ".harness", "workflows", activeId, "state.json");
  if (!existsSync2(statePath)) {
    return { active: activeData, instance: null };
  }
  try {
    const instance = JSON.parse(readFileSync2(statePath, "utf-8"));
    return { active: activeData, instance };
  } catch {
    return { active: activeData, instance: null };
  }
}
function readTeamMemoryConventions(cwd, limit = 5) {
  const teamMemoryPath = join2(cwd, ".harness", "team-memory.json");
  if (!existsSync2(teamMemoryPath)) return [];
  try {
    const teamMemory = JSON.parse(readFileSync2(teamMemoryPath, "utf-8"));
    if (!teamMemory.conventions || !Array.isArray(teamMemory.conventions)) return [];
    return teamMemory.conventions.slice(0, limit).map((c) => String(c.title || c.content || "")).filter(Boolean);
  } catch {
    return [];
  }
}
function readDetectedCapabilities(cwd) {
  const capabilitiesPath = join2(cwd, ".harness", "capabilities.json");
  if (!existsSync2(capabilitiesPath)) return [];
  try {
    const caps = JSON.parse(readFileSync2(capabilitiesPath, "utf-8"));
    const tools = caps.tools || {};
    return Object.entries(tools).filter(([, v]) => v.detected).map(([k]) => k);
  } catch {
    return [];
  }
}

// src/hooks/pre-compact.ts
function main() {
  let input;
  try {
    const raw = readFileSync3("/dev/stdin", "utf-8");
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
  const sections = [];
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (instance && instance.status && instance.status !== "completed" && instance.status !== "aborted") {
    sections.push(serializeWorkflowState(instance));
  }
  const conventions = readTeamMemoryConventions(cwd, 5);
  if (conventions.length > 0) {
    const convSection = ["[harness-conventions]", ...conventions.map((c, i) => `  ${i + 1}. ${c}`)];
    sections.push(convSection.join("\n"));
  }
  const capabilities = readDetectedCapabilities(cwd);
  if (capabilities.length > 0) {
    sections.push(`[harness-capabilities] \uAC10\uC9C0\uB41C \uB3C4\uAD6C: ${capabilities.join(", ")}`);
  }
  if (sections.length === 0) {
    outputResult("continue");
    return;
  }
  outputResult("continue", sections.join("\n\n"));
}
function serializeWorkflowState(instance) {
  const lines = [];
  lines.push(`[harness-workflow-state] \uC555\uCD95 \uC804 \uC6CC\uD06C\uD50C\uB85C\uC6B0 \uCEE8\uD14D\uC2A4\uD2B8 \uBCF4\uC874`);
  lines.push(`ID: ${instance.id ?? "?"}`);
  lines.push(`\uD0C0\uC785: ${instance.workflowType ?? "?"}`);
  lines.push(`\uC0C1\uD0DC: ${instance.status ?? "?"}`);
  lines.push(`\uC9C4\uD589: ${instance.currentStep ?? "?"}/${instance.totalSteps ?? "?"}`);
  if (instance.steps && instance.steps.length > 0) {
    lines.push("\uB2E8\uACC4 \uC0C1\uD0DC:");
    for (const step of instance.steps) {
      lines.push(formatStepLine(step));
    }
  }
  if (instance.config?.guardLevel) {
    lines.push(`\uAC00\uB4DC: ${instance.config.guardLevel}`);
  }
  return lines.join("\n");
}
function formatStepLine(step) {
  const statusIcon = step.status === "completed" ? "OK" : step.status === "running" ? "RUN" : step.status === "failed" ? "FAIL" : step.status === "skipped" ? "SKIP" : step.status === "waiting_checkpoint" ? "WAIT" : "PEND";
  const optionalTag = step.optional ? " (opt)" : "";
  const cpTag = step.checkpoint ? ` [cp: ${step.checkpoint}]` : "";
  return `  ${step.order ?? "?"}. [${statusIcon}] ${step.agent ?? "?"} \u2014 ${step.action ?? "?"}${optionalTag}${cpTag}`;
}
main();
//# sourceMappingURL=pre-compact.js.map