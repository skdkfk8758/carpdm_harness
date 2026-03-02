// src/hooks/subagent-complete.ts
import { readFileSync as readFileSync3, appendFileSync, mkdirSync } from "fs";
import { join as join3 } from "path";

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
function matchSubagent(subagentName, step) {
  if (!subagentName || !step.agent) return false;
  const normalizedSubagent = subagentName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedAgent = step.agent.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalizedSubagent.includes(normalizedAgent) || normalizedAgent.includes(normalizedSubagent);
}

// src/hooks/subagent-complete.ts
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
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (!instance || !instance.status || instance.status === "completed" || instance.status === "aborted") {
    outputResult("continue");
    return;
  }
  const subagentName = input.subagent_name || input.subagent_type || "";
  const sessionId = input.session_id || "unknown";
  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps?.[currentStepIndex];
  if (!currentStep) {
    outputResult("continue");
    return;
  }
  const isMatched = matchSubagent(subagentName, currentStep);
  if (isMatched) {
    logSubagentEvent(cwd, sessionId, {
      type: "subagent_complete",
      subagent: subagentName,
      workflowId: instance.id ?? "unknown",
      step: instance.currentStep ?? 0,
      agent: currentStep.agent ?? "",
      action: currentStep.action ?? ""
    });
    const contextLines = [];
    contextLines.push(`[harness-workflow] \uC11C\uBE0C\uC5D0\uC774\uC804\uD2B8 \uC644\uB8CC: ${subagentName} (${currentStep.agent} \u2014 ${currentStep.action})`);
    if (currentStep.checkpoint) {
      contextLines.push(`\uCCB4\uD06C\uD3EC\uC778\uD2B8 \uC2B9\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4: ${currentStep.checkpoint}`);
      contextLines.push(`harness_workflow({ action: "approve" }) \uB610\uB294 harness_workflow({ action: "reject" })`);
    } else {
      contextLines.push(`\uB2E4\uC74C \uB2E8\uACC4\uB85C \uC9C4\uD589\uD558\uC138\uC694: harness_workflow({ action: "advance" })`);
    }
    const nextStepIndex = currentStepIndex + 1;
    if (instance.steps && nextStepIndex < instance.steps.length) {
      const nextStep = instance.steps[nextStepIndex];
      const skillHint = nextStep.omcSkill ? ` -> ${nextStep.omcSkill}` : "";
      contextLines.push(`\uB2E4\uC74C \uB2E8\uACC4: ${nextStep.agent ?? "?"} (${nextStep.action ?? "?"})${skillHint}`);
    } else {
      contextLines.push(`\uB9C8\uC9C0\uB9C9 \uB2E8\uACC4\uC785\uB2C8\uB2E4. advance \uD6C4 \uC6CC\uD06C\uD50C\uB85C\uC6B0\uAC00 \uC644\uB8CC\uB429\uB2C8\uB2E4.`);
    }
    outputResult("continue", contextLines.join("\n"));
  } else {
    outputResult("continue");
  }
}
function logSubagentEvent(cwd, sessionId, data) {
  const eventsDir = join3(cwd, ".harness", "events");
  try {
    mkdirSync(eventsDir, { recursive: true });
    const entry = {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      ...data,
      session: sessionId
    };
    appendFileSync(join3(eventsDir, `${sessionId}.jsonl`), JSON.stringify(entry) + "\n");
  } catch {
  }
}
main();
//# sourceMappingURL=subagent-complete.js.map