// src/hooks/pre-compact.ts
import { readFileSync as readFileSync3 } from "fs";

// src/hooks/hook-utils.ts
import { readFileSync as readFileSync2, existsSync as existsSync2, readdirSync } from "fs";
import { join as join2 } from "path";

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