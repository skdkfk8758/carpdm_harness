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
function matchSubagent(subagentName, step) {
  if (!subagentName || !step.agent) return false;
  const normalizedSubagent = subagentName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedAgent = step.agent.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalizedSubagent.includes(normalizedAgent) || normalizedAgent.includes(normalizedSubagent);
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