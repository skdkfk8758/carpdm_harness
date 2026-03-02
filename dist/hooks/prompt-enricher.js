// src/hooks/prompt-enricher.ts
import { readFileSync as readFileSync4, existsSync as existsSync4, writeFileSync, mkdirSync } from "fs";
import { join as join5 } from "path";
import { execSync } from "child_process";

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
function sanitizeBranchName(branch) {
  return branch.replace(/\//g, "-");
}
function knowledgeBranchDir(projectRoot, branch) {
  return join(projectRoot, ".knowledge", "branches", sanitizeBranchName(branch));
}
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
function detectOmcMode(cwd) {
  const stateDir = omcStateDir(cwd);
  if (!existsSync2(stateDir)) return null;
  try {
    const stateFiles = readdirSync(stateDir).filter((f) => f.endsWith("-state.json"));
    for (const file of stateFiles) {
      try {
        const state = JSON.parse(readFileSync2(join2(stateDir, file), "utf-8"));
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
function detectRufloSwarm(cwd) {
  try {
    const status = detectRufloSwarmStatus(cwd);
    if (status.active) return `ruflo-swarm (agents: ${status.agentCount})`;
    return null;
  } catch {
    return null;
  }
}

// src/core/behavioral-validator.ts
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "fs";
import { join as join4 } from "path";

// src/core/project-paths.ts
import { join as join3 } from "path";
function agentPlanPath(projectRoot) {
  return join3(projectRoot, ".agent", "plan.md");
}
function rootPlanPath(projectRoot) {
  return join3(projectRoot, "plan.md");
}
function planSearchPaths(projectRoot) {
  return [agentPlanPath(projectRoot), rootPlanPath(projectRoot)];
}
function agentTodoPath(projectRoot) {
  return join3(projectRoot, ".agent", "todo.md");
}
function rootTodoPath(projectRoot) {
  return join3(projectRoot, "todo.md");
}
function todoSearchPaths(projectRoot) {
  return [agentTodoPath(projectRoot), rootTodoPath(projectRoot)];
}

// src/core/behavioral-validator.ts
var RATIONALIZATION_TABLE = {
  planning: [
    { rationalization: "\uC694\uAD6C\uC0AC\uD56D\uC774 \uBA85\uD655\uD558\uB2C8 \uACC4\uD68D \uAC74\uB108\uB6F0\uC790", rebuttal: "\uBA85\uD655\uD574 \uBCF4\uC5EC\uB3C4 \uC554\uBB35\uC801 \uAC00\uC815\uC774 \uC228\uC5B4 \uC788\uB2E4 \u2014 \uACC4\uD68D\uC740 \uAC00\uC815\uC744 \uB4DC\uB7EC\uB0B8\uB2E4" },
    { rationalization: "\uBE44\uC2B7\uD55C \uC791\uC5C5 \uD574\uBD24\uC73C\uB2C8 \uBC14\uB85C \uC2DC\uC791\uD558\uC790", rebuttal: "\uACFC\uAC70 \uACBD\uD5D8\uC774 \uD604\uC7AC \uCEE8\uD14D\uC2A4\uD2B8\uC640 \uB2E4\uB97C \uC218 \uC788\uB2E4 \u2014 \uCC28\uC774\uC810\uC744 \uBA3C\uC800 \uD655\uC778\uD558\uB77C" },
    { rationalization: "\uC2DC\uAC04\uC774 \uC5C6\uC73C\uB2C8 \uC124\uACC4 \uC5C6\uC774 \uCF54\uB529\uD558\uC790", rebuttal: "\uC124\uACC4 \uC5C6\uB294 \uCF54\uB529\uC740 \uB418\uB3CC\uC544\uC624\uB294 \uC2DC\uAC04\uC774 \uB354 \uAE38\uB2E4" },
    { rationalization: "\uC791\uC740 \uBCC0\uACBD\uC774\uB77C \uACC4\uD68D \uBD88\uD544\uC694", rebuttal: "\uC791\uC740 \uBCC0\uACBD\uB3C4 \uD30C\uAE09 \uD6A8\uACFC\uAC00 \uD074 \uC218 \uC788\uB2E4 \u2014 \uC601\uD5A5 \uBC94\uC704\uB97C \uBA3C\uC800 \uD30C\uC545\uD558\uB77C" },
    { rationalization: "\uC77C\uB2E8 \uB9CC\uB4E4\uACE0 \uB098\uC911\uC5D0 \uACE0\uCE58\uC790", rebuttal: '"\uB098\uC911"\uC740 \uC624\uC9C0 \uC54A\uB294\uB2E4 \u2014 \uCC98\uC74C\uBD80\uD130 \uC62C\uBC14\uB974\uAC8C \uB9CC\uB4E4\uC5B4\uB77C' }
  ],
  implementing: [
    { rationalization: "\uB098\uC911\uC5D0 \uD14C\uC2A4\uD2B8 \uCD94\uAC00\uD558\uACA0\uC74C", rebuttal: "\uC0AC\uD6C4 \uD14C\uC2A4\uD2B8\uB294 \uC2E4\uD328 \uC99D\uAC70\uB97C \uB0A8\uAE30\uC9C0 \uBABB\uD55C\uB2E4 \u2014 Red-Green-Refactor\uB97C \uB530\uB974\uB77C" },
    { rationalization: "\uC774 \uC815\uB3C4\uBA74 \uB3D9\uC791\uD560 \uAC83\uC774\uB2E4", rebuttal: '"\uB3D9\uC791\uD560 \uAC83\uC774\uB2E4"\uB294 \uAC80\uC99D\uC774 \uC544\uB2C8\uB2E4 \u2014 \uC2E4\uD589\uD558\uC5EC \uC99D\uBA85\uD558\uB77C' },
    { rationalization: "\uC5D0\uB7EC \uCC98\uB9AC\uB294 \uB098\uC911\uC5D0", rebuttal: "\uC5D0\uB7EC \uCC98\uB9AC \uC5C6\uB294 \uCF54\uB4DC\uB294 \uD504\uB85C\uB355\uC158\uC5D0\uC11C \uC2E4\uD328\uD55C\uB2E4" },
    { rationalization: "\uC77C\uB2E8 \uD558\uB4DC\uCF54\uB529\uD558\uACE0 \uB098\uC911\uC5D0 \uB9AC\uD329\uD1A0\uB9C1", rebuttal: "\uD558\uB4DC\uCF54\uB529\uC740 \uAE30\uC220 \uBD80\uCC44\uAC00 \uB41C\uB2E4 \u2014 \uCD5C\uC18C\uD55C\uC758 \uCD94\uC0C1\uD654\uB97C \uC9C0\uAE08 \uD558\uB77C" },
    { rationalization: "\uD0C0\uC785 \uC5D0\uB7EC\uB294 any\uB85C \uC6B0\uD68C\uD558\uC790", rebuttal: "any\uB294 \uD0C0\uC785 \uC2DC\uC2A4\uD15C\uC744 \uBB34\uB825\uD654\uD55C\uB2E4 \u2014 \uC815\uD655\uD55C \uD0C0\uC785\uC744 \uC0AC\uC6A9\uD558\uB77C" }
  ],
  testing: [
    { rationalization: "\uC774\uBBF8 \uC218\uB3D9\uC73C\uB85C \uD655\uC778\uD568", rebuttal: "\uC218\uB3D9 \uD14C\uC2A4\uD2B8\uB294 \uBC18\uBCF5 \uBD88\uAC00\uB2A5\uD558\uACE0 \uBD88\uC644\uC804\uD558\uB2E4 \u2014 \uC790\uB3D9\uD654\uB41C \uD14C\uC2A4\uD2B8\uB97C \uC791\uC131\uD558\uB77C" },
    { rationalization: "\uB108\uBB34 \uB2E8\uC21C\uD574\uC11C \uD14C\uC2A4\uD2B8 \uBD88\uD544\uC694", rebuttal: "\uB2E8\uC21C\uD55C \uCF54\uB4DC\uB3C4 \uD68C\uADC0\uD55C\uB2E4 \u2014 \uD14C\uC2A4\uD2B8\uB294 \uBBF8\uB798\uC758 \uBCC0\uACBD\uC744 \uBCF4\uD638\uD55C\uB2E4" },
    { rationalization: "happy path\uB9CC \uD14C\uC2A4\uD2B8\uD558\uBA74 \uB428", rebuttal: "\uBC84\uADF8\uB294 edge case\uC5D0\uC11C \uBC1C\uC0DD\uD55C\uB2E4 \u2014 \uACBD\uACC4 \uC870\uAC74\uC744 \uD14C\uC2A4\uD2B8\uD558\uB77C" },
    { rationalization: "\uB2E4\uB978 \uD14C\uC2A4\uD2B8\uAC00 \uCEE4\uBC84\uD558\uACE0 \uC788\uC74C", rebuttal: "\uAC04\uC811 \uCEE4\uBC84\uB9AC\uC9C0\uB294 \uC2E0\uB8B0\uD560 \uC218 \uC5C6\uB2E4 \u2014 \uC9C1\uC811 \uD14C\uC2A4\uD2B8\uB97C \uC791\uC131\uD558\uB77C" },
    { rationalization: "\uD14C\uC2A4\uD2B8\uAC00 \uAE68\uC9C0\uBA74 \uB098\uC911\uC5D0 \uACE0\uCE58\uACA0\uC74C", rebuttal: "\uAE68\uC9C4 \uD14C\uC2A4\uD2B8\uB294 \uC989\uC2DC \uC218\uC815\uD558\uB77C \u2014 \uBC29\uCE58\uD558\uBA74 \uC2E0\uD638\uB97C \uC783\uB294\uB2E4" }
  ],
  completing: [
    { rationalization: "\uD655\uC778\uD588\uC2B5\uB2C8\uB2E4 (\uC2E4\uD589 \uACB0\uACFC \uC5C6\uC774)", rebuttal: '"\uD655\uC778\uD588\uC2B5\uB2C8\uB2E4"\uB294 \uC99D\uAC70\uAC00 \uC544\uB2C8\uB2E4 \u2014 \uC2E4\uD589 \uB85C\uADF8\uB97C \uCCA8\uBD80\uD558\uB77C' },
    { rationalization: "\uD070 \uBB38\uC81C \uC5C6\uC5B4 \uBCF4\uC778\uB2E4", rebuttal: '"\uC5C6\uC5B4 \uBCF4\uC778\uB2E4"\uB294 \uAC80\uC99D\uC774 \uC544\uB2C8\uB2E4 \u2014 \uAD6C\uCCB4\uC801 \uD655\uC778 \uACB0\uACFC\uB97C \uC81C\uC2DC\uD558\uB77C' },
    { rationalization: "\uC2DC\uAC04\uC774 \uBD80\uC871\uD558\uB2C8 \uC774\uB300\uB85C \uCEE4\uBC0B", rebuttal: "\uBBF8\uC644\uC131 \uCEE4\uBC0B\uC740 \uB2E4\uC74C \uC0AC\uB78C\uC758 \uC2DC\uAC04\uC744 \uBE7C\uC557\uB294\uB2E4" },
    { rationalization: "\uC0AC\uC18C\uD55C \uBCC0\uACBD\uC774\uB2C8 \uB9AC\uBDF0 \uBD88\uD544\uC694", rebuttal: "\uC0AC\uC18C\uD55C \uBCC0\uACBD\uC5D0\uC11C \uC911\uB300\uD55C \uBC84\uADF8\uAC00 \uBC1C\uC0DD\uD55C\uB2E4 \u2014 \uD56D\uC0C1 \uAC80\uC99D\uD558\uB77C" },
    { rationalization: "\uC774\uC804 \uBC84\uC804\uACFC \uAC19\uC740 \uBC29\uC2DD\uC774\uB2C8 \uAD1C\uCC2E\uB2E4", rebuttal: "\uC774\uC804 \uBC29\uC2DD\uC774 \uC62C\uBC14\uB978\uC9C0 \uBA3C\uC800 \uD655\uC778\uD558\uB77C \u2014 \uAD00\uC131\uC740 \uADFC\uAC70\uAC00 \uC544\uB2C8\uB2E4" }
  ]
};
var AGENT_PHASE_MAP = {
  planner: "planning",
  architect: "planning",
  analyst: "planning",
  executor: "implementing",
  implementer: "implementing",
  developer: "implementing",
  "test-engineer": "testing",
  tester: "testing",
  qa: "testing",
  verifier: "completing",
  reviewer: "completing",
  shipper: "completing"
};
function resolveWorkflowPhase(instance) {
  if (!instance || !instance.steps) return "unknown";
  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps[currentStepIndex];
  if (!currentStep || !currentStep.agent) return "unknown";
  const agent = currentStep.agent.toLowerCase();
  if (AGENT_PHASE_MAP[agent]) return AGENT_PHASE_MAP[agent];
  for (const [key, phase] of Object.entries(AGENT_PHASE_MAP)) {
    if (agent.includes(key)) return phase;
  }
  return "unknown";
}
function buildRationalizationContext(phase, maxItems = 5) {
  if (phase === "unknown") return null;
  const entries = RATIONALIZATION_TABLE[phase];
  if (!entries || entries.length === 0) return null;
  const selected = entries.slice(0, maxItems);
  const phaseLabels = {
    planning: "\uACC4\uD68D",
    implementing: "\uAD6C\uD604",
    testing: "\uD14C\uC2A4\uD2B8",
    completing: "\uC644\uB8CC"
  };
  const lines = [
    `[behavioral-guard] \uD569\uB9AC\uD654 \uBC29\uC9C0 (${phaseLabels[phase]} \uB2E8\uACC4)`,
    "| \uD569\uB9AC\uD654 | \uBC18\uBC15 |",
    "|--------|------|"
  ];
  for (const entry of selected) {
    lines.push(`| ${entry.rationalization} | ${entry.rebuttal} |`);
  }
  return lines.join("\n");
}
var RED_FLAG_PATTERNS = [
  // hedging — 불확실한 표현
  { category: "hedging", pattern: /should\s+work/i, description: '"should work" \u2014 \uD14C\uC2A4\uD2B8\uB85C \uD655\uC778\uD558\uC138\uC694' },
  { category: "hedging", pattern: /probably\s+(?:fixed|works|correct|fine)/i, description: '"probably" \u2014 \uD655\uC2E4\uD55C \uAC80\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4' },
  { category: "hedging", pattern: /I\s+think\s+(?:it|this|that)\s+(?:works|is\s+(?:correct|fine|ok))/i, description: '"I think it works" \u2014 \uC2E4\uD589 \uACB0\uACFC\uB85C \uC99D\uBA85\uD558\uC138\uC694' },
  { category: "hedging", pattern: /것\s*같(?:다|습니다|아요)/i, description: '"~\uAC83 \uAC19\uB2E4" \u2014 \uCD94\uCE21\uC774 \uC544\uB2CC \uAC80\uC99D \uACB0\uACFC\uB97C \uC81C\uC2DC\uD558\uC138\uC694' },
  { category: "hedging", pattern: /아마\s+(?:될|맞|괜찮)/i, description: '"\uC544\uB9C8" \u2014 \uD655\uC2E4\uD55C \uADFC\uAC70\uB97C \uC81C\uC2DC\uD558\uC138\uC694' },
  // unverified_claim — 증거 없는 주장
  { category: "unverified_claim", pattern: /I\s+(?:believe|verified|confirmed)\s+(?:it(?:'s|\s+is)\s+correct)/i, description: '\uC99D\uAC70 \uC5C6\uB294 "\uD655\uC778" \uC8FC\uC7A5 \u2014 \uC2E4\uD589 \uB85C\uADF8\uB97C \uCCA8\uBD80\uD558\uC138\uC694' },
  { category: "unverified_claim", pattern: /확인했습니다/i, description: '"\uD655\uC778\uD588\uC2B5\uB2C8\uB2E4" \u2014 \uC2E4\uD589 \uACB0\uACFC/\uB85C\uADF8\uB97C \uD568\uAED8 \uC81C\uC2DC\uD558\uC138\uC694' },
  { category: "unverified_claim", pattern: /(?:looks|seems)\s+(?:good|correct|fine)\s+to\s+me/i, description: '"looks good to me" \u2014 \uAD6C\uCCB4\uC801 \uAC80\uC99D \uACB0\uACFC\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4' },
  { category: "unverified_claim", pattern: /문제\s*(?:없|없을\s*것)/i, description: '"\uBB38\uC81C\uC5C6\uB2E4" \u2014 \uC5B4\uB5BB\uAC8C \uD655\uC778\uD588\uB294\uC9C0 \uC124\uBA85\uD558\uC138\uC694' },
  // assumption — 검증 없는 가정
  { category: "assumption", pattern: /didn'?t\s+change\s+so\s+it(?:'s|\s+is)\s+fine/i, description: '"\uC548 \uBC14\uAFE8\uC73C\uB2C8 \uAD1C\uCC2E\uB2E4" \u2014 \uD68C\uADC0 \uD14C\uC2A4\uD2B8\uB97C \uC2E4\uD589\uD558\uC138\uC694' },
  { category: "assumption", pattern: /안\s*바뀌었으?니\s*괜찮/i, description: '"\uC548 \uBC14\uB00C\uC5C8\uC73C\uB2C8 \uAD1C\uCC2E\uB2E4" \u2014 \uAD00\uB828 \uD14C\uC2A4\uD2B8\uB97C \uC2E4\uD589\uD558\uC138\uC694' },
  { category: "assumption", pattern: /(?:no|shouldn'?t\s+(?:be|have))\s+(?:side\s+effects?|impact)/i, description: "\uBD80\uC791\uC6A9 \uC5C6\uB2E4\uACE0 \uAC00\uC815 \u2014 \uC601\uD5A5 \uBC94\uC704\uB97C \uD655\uC778\uD558\uC138\uC694" },
  { category: "assumption", pattern: /영향\s*(?:없|없을)/i, description: '"\uC601\uD5A5 \uC5C6\uB2E4" \u2014 \uCC38\uC870\uD558\uB294 \uCF54\uB4DC\uB97C \uD655\uC778\uD558\uC138\uC694' },
  // skipping — 단계 건너뛰기
  { category: "skipping", pattern: /too\s+simple\s+to\s+test/i, description: '"\uB108\uBB34 \uB2E8\uC21C\uD574\uC11C \uD14C\uC2A4\uD2B8 \uBD88\uD544\uC694" \u2014 \uB2E8\uC21C\uD55C \uCF54\uB4DC\uB3C4 \uD68C\uADC0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4' },
  { category: "skipping", pattern: /(?:add|write)\s+tests?\s+later/i, description: '"\uB098\uC911\uC5D0 \uD14C\uC2A4\uD2B8 \uCD94\uAC00" \u2014 \uC9C0\uAE08 \uC791\uC131\uD558\uC138\uC694' },
  { category: "skipping", pattern: /나중에\s*(?:테스트|검증|확인)/i, description: '"\uB098\uC911\uC5D0 \uD14C\uC2A4\uD2B8/\uAC80\uC99D" \u2014 \uC9C0\uAE08 \uC218\uD589\uD558\uC138\uC694' },
  { category: "skipping", pattern: /(?:skip|don'?t\s+need)\s+(?:testing|tests|verification)/i, description: '"\uD14C\uC2A4\uD2B8 \uBD88\uD544\uC694" \u2014 \uBAA8\uB4E0 \uBCC0\uACBD\uC740 \uAC80\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4' }
];
var COMPLETION_INTENT_PATTERNS = [
  /(?:let'?s?\s+)?(?:commit|push)\s/i,
  /create\s+(?:a\s+)?(?:PR|pull\s+request)/i,
  /(?:it(?:'s|\s+is)\s+)?done/i,
  /ready\s+(?:to\s+)?(?:merge|ship|deploy|commit)/i,
  /(?:mark|set)\s+(?:as\s+)?(?:complete|done|finished)/i,
  /커밋\s*(?:해|하자|할게|합시다)/i,
  /PR\s*(?:생성|만들|올려)/i,
  /완료(?:했|됐|입니다|하겠)/i,
  /머지\s*(?:해|하자|할게)/i,
  /작업\s*(?:끝|마무리|종료)/i,
  /배포\s*(?:해|하자|할게|준비)/i
];
function detectRedFlags(text) {
  if (!text || text.trim().length === 0) {
    return { hasRedFlags: false, matches: [] };
  }
  const matches = [];
  const seen = /* @__PURE__ */ new Set();
  for (const { category, pattern, description } of RED_FLAG_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const key = `${category}:${description}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({ category, matched: match[0], description });
      }
    }
  }
  return { hasRedFlags: matches.length > 0, matches };
}
function detectCompletionIntent(text) {
  if (!text || text.trim().length === 0) return false;
  return COMPLETION_INTENT_PATTERNS.some((p) => p.test(text));
}
function buildRedFlagContext(result) {
  if (!result.hasRedFlags || result.matches.length === 0) return "";
  const lines = [
    `[behavioral-guard] \uC801\uC2E0\uD638 \uAC10\uC9C0 (${result.matches.length}\uAC74)`
  ];
  const byCategory = /* @__PURE__ */ new Map();
  for (const m of result.matches) {
    const arr = byCategory.get(m.category) || [];
    arr.push(m);
    byCategory.set(m.category, arr);
  }
  const categoryLabels = {
    hedging: "\uBD88\uD655\uC2E4\uD55C \uD45C\uD604",
    unverified_claim: "\uC99D\uAC70 \uC5C6\uB294 \uC8FC\uC7A5",
    assumption: "\uAC80\uC99D \uC5C6\uB294 \uAC00\uC815",
    skipping: "\uB2E8\uACC4 \uAC74\uB108\uB6F0\uAE30"
  };
  for (const [cat, items] of byCategory) {
    lines.push(`- ${categoryLabels[cat] || cat}:`);
    for (const item of items) {
      lines.push(`  - "${item.matched}" \u2192 ${item.description}`);
    }
  }
  lines.push("");
  lines.push("\uAD8C\uC7A5 \uD589\uB3D9: \uC704 \uD56D\uBAA9\uB4E4\uC744 \uC2E4\uD589 \uACB0\uACFC/\uD14C\uC2A4\uD2B8/\uB85C\uADF8\uB85C \uB4B7\uBC1B\uCE68\uD558\uC138\uC694.");
  return lines.join("\n");
}
function buildCompletionChecklist() {
  return [
    "[behavioral-guard] \uC644\uB8CC \uC804 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8",
    "- [ ] \uBAA8\uB4E0 \uBCC0\uACBD\uC5D0 \uB300\uD55C \uD14C\uC2A4\uD2B8\uAC00 \uC2E4\uD589\uB418\uC5C8\uB294\uAC00?",
    "- [ ] \uD14C\uC2A4\uD2B8 \uACB0\uACFC(pass/fail)\uB97C \uD655\uC778\uD588\uB294\uAC00?",
    "- [ ] \uD0C0\uC785\uCCB4\uD06C(tsc --noEmit)\uAC00 \uD1B5\uACFC\uD558\uB294\uAC00?",
    '- [ ] "\uAC83 \uAC19\uB2E4", "\uC544\uB9C8" \uAC19\uC740 \uCD94\uCE21 \uC5C6\uC774 \uC99D\uAC70 \uAE30\uBC18\uC73C\uB85C \uC791\uC5C5\uD588\uB294\uAC00?',
    "- [ ] \uBCC0\uACBD \uBC94\uC704 \uBC16\uC758 \uD68C\uADC0\uAC00 \uC5C6\uB294\uC9C0 \uD655\uC778\uD588\uB294\uAC00?"
  ].join("\n");
}
var IMPLEMENTATION_INTENT_PATTERNS = [
  /\bimplement\s+(the\s+)?(following\s+)?plan\b/i,
  /\bexecute\s+(the\s+)?(this\s+)?(following\s+)?plan\b/i,
  /(?:이|다음|위)\s*(?:계획|플랜).*(?:구현|실행|진행)/i,
  /(?:계획|플랜)\s*(?:을|를)?\s*(?:구현|실행|진행)/i,
  /plan\s*(?:을|를)?\s*(?:실행|구현|진행)/i,
  /(?:플랜|계획)\s*대로/i
];
function getPlanStatus(cwd) {
  const paths = planSearchPaths(cwd);
  for (const p of paths) {
    if (!existsSync3(p)) continue;
    try {
      const content = readFileSync3(p, "utf-8");
      if (/\bAPPROVED\b/.test(content)) return "APPROVED";
      if (/\bDRAFT\b/.test(content)) return "DRAFT";
      if (/\bCOMPLETED\b/.test(content)) return "COMPLETED";
      return "EXISTS";
    } catch {
      continue;
    }
  }
  return "NONE";
}
function getTodoStatus(cwd) {
  const paths = todoSearchPaths(cwd);
  for (const p of paths) {
    if (!existsSync3(p)) continue;
    try {
      const content = readFileSync3(p, "utf-8");
      const done = (content.match(/\[x\]/gi) || []).length;
      const remaining = (content.match(/\[ \]/g) || []).length;
      const total = done + remaining;
      return { exists: true, allDone: total > 0 && remaining === 0, doneCount: done, totalCount: total };
    } catch {
      continue;
    }
  }
  return { exists: false, allDone: false, doneCount: 0, totalCount: 0 };
}
function hasImplementationIntent(cleanPrompt) {
  return IMPLEMENTATION_INTENT_PATTERNS.some((p) => p.test(cleanPrompt));
}
function checkImplementationReadiness(cleanPrompt, cwd) {
  if (!existsSync3(join4(cwd, "carpdm-harness.config.json"))) return { status: "pass" };
  if (!hasImplementationIntent(cleanPrompt)) return { status: "pass" };
  const planStatus = getPlanStatus(cwd);
  const todoStatus = getTodoStatus(cwd);
  if (planStatus === "NONE" || planStatus === "COMPLETED") {
    return { status: "force-plan-gate" };
  }
  if (planStatus === "DRAFT") {
    return {
      status: "plan-not-approved",
      message: `[WORKFLOW GUARD: PLAN NOT APPROVED]

plan.md\uAC00 DRAFT \uC0C1\uD0DC\uC785\uB2C8\uB2E4. \uAD6C\uD604\uC744 \uC2DC\uC791\uD558\uAE30 \uC804\uC5D0:
1. plan.md\uB97C \uAC80\uD1A0\uD558\uACE0 \uC2B9\uC778(APPROVED)\uC73C\uB85C \uBCC0\uACBD\uD558\uC138\uC694
2. \uC2B9\uC778 \uD6C4 todo.md\uB97C \uC791\uC131\uD558\uC138\uC694
3. \uADF8 \uD6C4 \uAD6C\uD604\uC744 \uC2DC\uC791\uD558\uC138\uC694`
    };
  }
  if (!todoStatus.exists) {
    return {
      status: "todo-required",
      message: `[WORKFLOW GUARD: TODO REQUIRED]

plan.md\uAC00 APPROVED \uC0C1\uD0DC\uC774\uC9C0\uB9CC todo.md\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.
\uAD6C\uD604\uC744 \uC2DC\uC791\uD558\uAE30 \uC804\uC5D0:
1. plan.md\uC758 \uAD6C\uD604 \uACC4\uD68D(Step)\uC744 \uAE30\uBC18\uC73C\uB85C .agent/todo.md\uB97C \uC791\uC131\uD558\uC138\uC694
2. \uCCAB \uBC88\uC9F8 \uD56D\uBAA9\uC5D0 \u2190 CURRENT \uB9C8\uCEE4\uB97C \uCD94\uAC00\uD558\uC138\uC694
3. \uADF8 \uD6C4 Step 1\uBD80\uD130 \uAD6C\uD604\uC744 \uC2DC\uC791\uD558\uC138\uC694`
    };
  }
  if (todoStatus.allDone) {
    return {
      status: "todo-stale",
      message: `[WORKFLOW GUARD: TODO STALE]

todo.md\uC758 \uBAA8\uB4E0 \uD56D\uBAA9\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4 (${todoStatus.doneCount}/${todoStatus.totalCount}).
\uC0C8 \uAD6C\uD604 \uC791\uC5C5\uC744 \uC704\uD574:
1. plan.md\uC758 \uC0C8 \uAD6C\uD604 \uACC4\uD68D\uC744 \uAE30\uBC18\uC73C\uB85C .agent/todo.md\uB97C \uAC31\uC2E0\uD558\uC138\uC694
2. \uCCAB \uBC88\uC9F8 \uD56D\uBAA9\uC5D0 \u2190 CURRENT \uB9C8\uCEE4\uB97C \uCD94\uAC00\uD558\uC138\uC694
3. \uADF8 \uD6C4 Step 1\uBD80\uD130 \uAD6C\uD604\uC744 \uC2DC\uC791\uD558\uC138\uC694`
    };
  }
  return { status: "pass" };
}

// src/types/behavioral-guard.ts
var DEFAULT_BEHAVIORAL_GUARD_CONFIG = {
  rationalization: "on",
  redFlagDetection: "on"
};

// src/hooks/prompt-enricher.ts
function readCache(cachePath, ttlMs) {
  try {
    if (!existsSync4(cachePath)) return null;
    const raw = readFileSync4(cachePath, "utf-8");
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > ttlMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}
function writeCache(cachePath, data) {
  try {
    const dir = join5(cachePath, "..");
    if (!existsSync4(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const entry = { data, timestamp: Date.now() };
    writeFileSync(cachePath, JSON.stringify(entry), "utf-8");
  } catch {
  }
}
function readKnowledgeContext(cwd, branch) {
  if (!branch) return null;
  const branchDir = knowledgeBranchDir(cwd, branch);
  if (!existsSync4(branchDir)) return null;
  const lines = [`[Knowledge Context]`, `Branch: ${branch}`];
  const MAX_LINES_PER_FILE = 15;
  const targetFiles = ["design.md", "decisions.md", "spec.md"];
  for (const filename of targetFiles) {
    const filePath = join5(branchDir, filename);
    if (!existsSync4(filePath)) continue;
    let content;
    try {
      content = readFileSync4(filePath, "utf-8");
    } catch {
      continue;
    }
    let body = content;
    if (body.startsWith("---")) {
      const endIdx = body.indexOf("---", 3);
      if (endIdx !== -1) body = body.substring(endIdx + 3);
    }
    body = body.trim();
    if (!body || body.split("\n").length <= 2) continue;
    const truncated = body.split("\n").slice(0, MAX_LINES_PER_FILE).join("\n");
    lines.push("", `--- ${filename} ---`, truncated);
  }
  if (lines.length <= 2) return null;
  return lines.join("\n");
}
function getCurrentBranch(cwd) {
  const cachePath = join5(cwd, ".harness", "cache", "branch-cache.json");
  const cached = readCache(cachePath, 3e4);
  if (cached !== null) return cached;
  try {
    const branch = execSync("git branch --show-current", { cwd, stdio: "pipe" }).toString().trim() || null;
    if (branch) writeCache(cachePath, branch);
    return branch;
  } catch {
    return null;
  }
}
function buildStepWarnings(instance) {
  const warnings = [];
  if (!instance.steps) return warnings;
  for (const step of instance.steps) {
    if (step.status === "waiting_checkpoint") {
      warnings.push(`[WARN] \uCCB4\uD06C\uD3EC\uC778\uD2B8 \uB300\uAE30 \uC911: \uB2E8\uACC4 ${step.order} (${step.agent}) \u2014 ${step.checkpoint ?? "?"}`);
    }
    if (step.status === "failed") {
      warnings.push(`[WARN] \uC2E4\uD328 \uB2E8\uACC4: \uB2E8\uACC4 ${step.order} (${step.agent}) \u2014 ${step.action}`);
    }
  }
  return warnings;
}
function buildWorkflowContext(instance, cwd) {
  const contextLines = [];
  contextLines.push(`[harness-workflow] ${instance.workflowType ?? "?"} (${instance.id ?? "?"})`);
  contextLines.push(`\uC9C4\uD589: ${instance.currentStep ?? "?"}/${instance.totalSteps ?? "?"} | \uC0C1\uD0DC: ${instance.status}`);
  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps?.[currentStepIndex];
  if (currentStep) {
    contextLines.push(`\uD604\uC7AC: ${currentStep.agent ?? "?"} \u2014 ${currentStep.action ?? "?"}`);
    if (instance.status === "waiting_checkpoint") {
      contextLines.push(`[ACTION] \uCCB4\uD06C\uD3EC\uC778\uD2B8 \uC2B9\uC778 \uB300\uAE30: ${currentStep.checkpoint ?? "?"} -> harness_workflow({ action: "approve" })`);
    } else if (instance.status === "failed_step") {
      contextLines.push(`[ACTION] \uB2E8\uACC4 \uC2E4\uD328 -> harness_workflow({ action: "retry" }) \uB610\uB294 harness_workflow({ action: "skip" })`);
    } else {
      const nextStepIndex = currentStepIndex + 1;
      if (instance.steps && nextStepIndex < instance.steps.length) {
        const nextStep = instance.steps[nextStepIndex];
        const skillHint = nextStep.omcSkill ? ` (${nextStep.omcSkill})` : "";
        contextLines.push(`\uB2E4\uC74C: ${nextStep.agent ?? "?"} \u2014 ${nextStep.action ?? "?"}${skillHint}`);
      }
      contextLines.push(`\uB2E8\uACC4 \uC644\uB8CC \uC2DC: harness_workflow({ action: "advance" })`);
    }
  }
  const warnings = buildStepWarnings(instance);
  if (warnings.length > 0) {
    contextLines.push(...warnings);
  }
  const omcMode = detectOmcMode(cwd);
  if (omcMode) {
    contextLines.push(`OMC \uBAA8\uB4DC: ${omcMode}`);
  }
  const rufloSwarm = detectRufloSwarm(cwd);
  if (rufloSwarm) {
    contextLines.push(`ruflo: ${rufloSwarm}`);
  }
  return contextLines.join("\n");
}
function loadBehavioralGuardConfig(cwd) {
  try {
    const configPath = join5(cwd, "carpdm-harness.config.json");
    if (!existsSync4(configPath)) return { ...DEFAULT_BEHAVIORAL_GUARD_CONFIG };
    const config = JSON.parse(readFileSync4(configPath, "utf-8"));
    const guard = config.behavioralGuard;
    if (!guard) return { ...DEFAULT_BEHAVIORAL_GUARD_CONFIG };
    return {
      rationalization: guard.rationalization || DEFAULT_BEHAVIORAL_GUARD_CONFIG.rationalization,
      redFlagDetection: guard.redFlagDetection || DEFAULT_BEHAVIORAL_GUARD_CONFIG.redFlagDetection
    };
  } catch {
    return { ...DEFAULT_BEHAVIORAL_GUARD_CONFIG };
  }
}
function buildStandaloneRedFlagContext(prompt) {
  const isCompletion = detectCompletionIntent(prompt);
  if (!isCompletion) return null;
  const redFlagResult = detectRedFlags(prompt);
  if (redFlagResult.hasRedFlags) {
    return buildRedFlagContext(redFlagResult);
  }
  return buildCompletionChecklist();
}
function main() {
  let input;
  try {
    const raw = readFileSync4("/dev/stdin", "utf-8");
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
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const guardConfig = loadBehavioralGuardConfig(cwd);
  let knowledgeContext = null;
  try {
    const branch = getCurrentBranch(cwd);
    knowledgeContext = readKnowledgeContext(cwd, branch);
  } catch {
  }
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (!instance || !instance.status || instance.status === "completed" || instance.status === "aborted") {
    const parts = [];
    if (knowledgeContext) parts.push(knowledgeContext);
    if (prompt) {
      const readiness = checkImplementationReadiness(prompt, cwd);
      if (readiness.status === "force-plan-gate") {
        parts.push("[WORKFLOW GUARD: PLAN REQUIRED]\n\nplan.md\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. /plan-gate \uC2A4\uD0AC\uC744 \uBA3C\uC800 \uC2E4\uD589\uD558\uC138\uC694.");
      } else if (readiness.status !== "pass" && readiness.message) {
        parts.push(readiness.message);
      }
    }
    if (prompt && guardConfig.redFlagDetection === "on") {
      const extraContext = buildStandaloneRedFlagContext(prompt);
      if (extraContext) parts.push(extraContext);
    }
    outputResult("continue", parts.length > 0 ? parts.join("\n\n") : void 0);
    return;
  }
  const contextParts = [];
  if (knowledgeContext) {
    contextParts.push(knowledgeContext);
  }
  contextParts.push(buildWorkflowContext(instance, cwd));
  if (guardConfig.rationalization === "on") {
    const phase = resolveWorkflowPhase(instance);
    const rationalizationCtx = buildRationalizationContext(phase);
    if (rationalizationCtx) {
      contextParts.push(rationalizationCtx);
    }
  }
  if (prompt && guardConfig.redFlagDetection === "on") {
    const isCompletion = detectCompletionIntent(prompt);
    if (isCompletion) {
      const redFlagResult = detectRedFlags(prompt);
      if (redFlagResult.hasRedFlags) {
        contextParts.push(buildRedFlagContext(redFlagResult));
      } else {
        contextParts.push(buildCompletionChecklist());
      }
    }
  }
  outputResult("continue", contextParts.join("\n\n"));
}
main();
//# sourceMappingURL=prompt-enricher.js.map