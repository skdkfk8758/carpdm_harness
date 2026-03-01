// src/hooks/prompt-enricher.ts
import { readFileSync as readFileSync4, writeFileSync, mkdirSync, existsSync as existsSync4, unlinkSync } from "fs";
import { join as join6 } from "path";
import { homedir as homedir2 } from "os";
import { execSync } from "child_process";

// src/hooks/hook-utils.ts
import { readFileSync, existsSync, readdirSync } from "fs";
import { join as join2 } from "path";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
var OMC_STATEFUL_MODES = [
  "ralph",
  "ralph-todo",
  "autopilot",
  "team",
  "ultrawork",
  "ecomode"
];
var OMC_CANCEL_MODES = [
  "ralph",
  "ralph-todo",
  "autopilot",
  "team",
  "ultrawork",
  "ecomode",
  "pipeline"
];
var OMC_KEYWORD_PRIORITY = [
  "cancel",
  "ralph-todo",
  "ralph",
  "autopilot",
  "team",
  "ultrawork",
  "ecomode",
  "pipeline",
  "ralplan",
  "plan",
  "tdd",
  "research",
  "ultrathink",
  "deepsearch",
  "analyze",
  "codex",
  "gemini"
];
function omcStateDir(projectRoot) {
  return join(projectRoot, ".omc", "state");
}
function omcGlobalStateDir() {
  return join(homedir(), ".omc", "state");
}
function omcStatePath(projectRoot, mode) {
  return join(projectRoot, ".omc", "state", `${mode}-state.json`);
}
function omcGlobalStatePath(mode) {
  return join(homedir(), ".omc", "state", `${mode}-state.json`);
}
function sanitizeBranchName(branch) {
  return branch.replace(/\//g, "-");
}
function knowledgeBranchDir(projectRoot, branch) {
  return join(projectRoot, ".knowledge", "branches", sanitizeBranchName(branch));
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
var MCP_DELEGATION_KEYWORDS = ["codex", "gemini"];
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

// src/core/rationalization-guard.ts
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

// src/core/red-flag-detector.ts
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
  // 영어
  /(?:let'?s?\s+)?(?:commit|push)\s/i,
  /create\s+(?:a\s+)?(?:PR|pull\s+request)/i,
  /(?:it(?:'s|\s+is)\s+)?done/i,
  /ready\s+(?:to\s+)?(?:merge|ship|deploy|commit)/i,
  /(?:mark|set)\s+(?:as\s+)?(?:complete|done|finished)/i,
  // 한국어
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

// src/types/behavioral-guard.ts
var DEFAULT_BEHAVIORAL_GUARD_CONFIG = {
  rationalization: "on",
  redFlagDetection: "on"
};

// src/core/skill-trigger-engine.ts
import { readFileSync as readFileSync2, existsSync as existsSync2 } from "fs";
import { join as join3 } from "path";
function loadTriggers(projectRoot) {
  const empty = { version: "1.0", keywordGroups: {}, triggers: [] };
  const basePath = join3(projectRoot, ".harness", "triggers.json");
  const base = loadManifestFile(basePath);
  const customPath = join3(projectRoot, ".harness", "custom-triggers.json");
  const custom = loadManifestFile(customPath);
  if (!base && !custom) return empty;
  if (!custom) return base ?? empty;
  if (!base) return custom;
  return {
    version: base.version,
    keywordGroups: { ...base.keywordGroups, ...custom.keywordGroups },
    triggers: [...base.triggers, ...custom.triggers]
  };
}
function loadManifestFile(filePath) {
  try {
    if (!existsSync2(filePath)) return null;
    const raw = readFileSync2(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function matchTriggers(manifest, ctx) {
  const { prompt, branch, conditions } = ctx;
  const cleanPrompt = prompt.toLowerCase();
  for (const entry of manifest.triggers) {
    for (const rule of entry.rules) {
      if (matchRule(rule, cleanPrompt, branch, conditions, manifest.keywordGroups)) {
        const extracts = extractPlaceholders(cleanPrompt, manifest.keywordGroups);
        if (branch) extracts.branch = branch;
        return { skill: entry.skill, rule, extracts };
      }
    }
  }
  return null;
}
function matchRule(rule, prompt, branch, conditions, groups) {
  if (!matchBranch(rule.branch, branch)) return false;
  if (rule.condition && !conditions[rule.condition]) return false;
  if (rule.noneOf) {
    for (const groupName of rule.noneOf) {
      if (matchGroup(groupName, prompt, groups)) return false;
    }
  }
  if (rule.patterns && rule.patterns.length > 0) {
    return rule.patterns.some((p) => {
      try {
        return new RegExp(p, "i").test(prompt);
      } catch {
        return false;
      }
    });
  }
  if (rule.allOf && rule.allOf.length > 0) {
    const allMatch = rule.allOf.every((groupName) => matchGroup(groupName, prompt, groups));
    if (!allMatch) return false;
    if (rule.anyOf && rule.anyOf.length > 0) {
      return rule.anyOf.some((groupName) => matchGroup(groupName, prompt, groups));
    }
    return true;
  }
  if (rule.anyOf && rule.anyOf.length > 0) {
    return rule.anyOf.some((groupName) => matchGroup(groupName, prompt, groups));
  }
  return false;
}
function matchBranch(ruleBranch, currentBranch) {
  if (ruleBranch === "any") return true;
  if (!currentBranch) return ruleBranch === "any";
  const isMain = currentBranch === "main" || currentBranch === "master" || currentBranch === "develop" || currentBranch === "dev";
  if (ruleBranch === "main") return isMain;
  if (ruleBranch === "feature") return !isMain;
  return false;
}
function matchGroup(groupName, prompt, groups) {
  const patterns = groups[groupName];
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((p) => {
    try {
      return new RegExp(p, "i").test(prompt);
    } catch {
      return false;
    }
  });
}
function extractPlaceholders(prompt, groups) {
  const extracts = {};
  for (const [name, patterns] of Object.entries(groups)) {
    for (const p of patterns) {
      try {
        const match = new RegExp(p, "i").exec(prompt);
        if (match) {
          extracts[name] = match[0];
          break;
        }
      } catch {
      }
    }
  }
  return extracts;
}
function resolveMessage(template, extracts) {
  return template.replace(/\{(\w+)\}/g, (_, key) => extracts[key] ?? "");
}

// src/core/implementation-readiness.ts
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "fs";
import { join as join5 } from "path";

// src/core/project-paths.ts
import { join as join4 } from "path";
function agentPlanPath(projectRoot) {
  return join4(projectRoot, ".agent", "plan.md");
}
function rootPlanPath(projectRoot) {
  return join4(projectRoot, "plan.md");
}
function planSearchPaths(projectRoot) {
  return [agentPlanPath(projectRoot), rootPlanPath(projectRoot)];
}
function agentTodoPath(projectRoot) {
  return join4(projectRoot, ".agent", "todo.md");
}
function rootTodoPath(projectRoot) {
  return join4(projectRoot, "todo.md");
}
function todoSearchPaths(projectRoot) {
  return [agentTodoPath(projectRoot), rootTodoPath(projectRoot)];
}

// src/core/implementation-readiness.ts
var IMPLEMENTATION_INTENT_PATTERNS = [
  // EN: "implement the plan", "implement following plan"
  /\bimplement\s+(the\s+)?(following\s+)?plan\b/i,
  // EN: "execute the plan", "execute this plan"
  /\bexecute\s+(the\s+)?(this\s+)?(following\s+)?plan\b/i,
  // KR: "계획 구현/실행/진행"
  /(?:이|다음|위)\s*(?:계획|플랜).*(?:구현|실행|진행)/i,
  /(?:계획|플랜)\s*(?:을|를)?\s*(?:구현|실행|진행)/i,
  // KR: "plan 실행해줘", "플랜대로 구현"
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
  if (!existsSync3(join5(cwd, "carpdm-harness.config.json"))) return { status: "pass" };
  if (!hasImplementationIntent(cleanPrompt)) return { status: "pass" };
  const planStatus = getPlanStatus(cwd);
  const todoStatus = getTodoStatus(cwd);
  if (planStatus === "NONE") {
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

// src/hooks/prompt-enricher.ts
var ULTRATHINK_MESSAGE = `<think-mode>

**ULTRATHINK MODE ENABLED** - Extended reasoning activated.

You are now in deep thinking mode. Take your time to:
1. Thoroughly analyze the problem from multiple angles
2. Consider edge cases and potential issues
3. Think through the implications of each approach
4. Reason step-by-step before acting

Use your extended thinking capabilities to provide the most thorough and well-reasoned response.

</think-mode>

---
`;
function sanitizeForKeywordDetection(text) {
  return text.replace(/<(\w[\w-]*)[\s>][\s\S]*?<\/\1>/g, "").replace(/<\w[\w-]*(?:\s[^>]*)?\s*\/>/g, "").replace(/https?:\/\/[^\s)>\]]+/g, "").replace(/(^|[\s"'`(])(\/)?(?:[\w.-]+\/)+[\w.-]+/gm, "$1").replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
}
function activateState(directory, prompt, stateName, sessionId) {
  const state = {
    active: true,
    started_at: (/* @__PURE__ */ new Date()).toISOString(),
    original_prompt: prompt,
    session_id: sessionId || void 0,
    reinforcement_count: 0,
    last_checked_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const localDir = omcStateDir(directory);
  if (!existsSync4(localDir)) {
    try {
      mkdirSync(localDir, { recursive: true });
    } catch {
    }
  }
  try {
    writeFileSync(omcStatePath(directory, stateName), JSON.stringify(state, null, 2));
  } catch {
  }
  const globalDir = omcGlobalStateDir();
  if (!existsSync4(globalDir)) {
    try {
      mkdirSync(globalDir, { recursive: true });
    } catch {
    }
  }
  try {
    writeFileSync(omcGlobalStatePath(stateName), JSON.stringify(state, null, 2));
  } catch {
  }
}
function clearStateFiles(directory, modeNames) {
  for (const name of modeNames) {
    const localPath = omcStatePath(directory, name);
    const globalPath = omcGlobalStatePath(name);
    try {
      if (existsSync4(localPath)) unlinkSync(localPath);
    } catch {
    }
    try {
      if (existsSync4(globalPath)) unlinkSync(globalPath);
    } catch {
    }
  }
}
function createSkillInvocation(skillName, originalPrompt, args = "") {
  const argsSection = args ? `
Arguments: ${args}` : "";
  return `[MAGIC KEYWORD: ${skillName.toUpperCase()}]

You MUST invoke the skill using the Skill tool:

Skill: oh-my-claudecode:${skillName}${argsSection}

User request:
${originalPrompt}

IMPORTANT: Invoke the skill IMMEDIATELY. Do not proceed without loading the skill instructions.`;
}
function createMultiSkillInvocation(skills, originalPrompt) {
  if (skills.length === 0) return "";
  if (skills.length === 1) {
    return createSkillInvocation(skills[0].name, originalPrompt, skills[0].args);
  }
  const skillBlocks = skills.map((s, i) => {
    const argsSection = s.args ? `
Arguments: ${s.args}` : "";
    return `### Skill ${i + 1}: ${s.name.toUpperCase()}
Skill: oh-my-claudecode:${s.name}${argsSection}`;
  }).join("\n\n");
  return `[MAGIC KEYWORDS DETECTED: ${skills.map((s) => s.name.toUpperCase()).join(", ")}]

You MUST invoke ALL of the following skills using the Skill tool, in order:

${skillBlocks}

User request:
${originalPrompt}

IMPORTANT: Invoke ALL skills listed above. Start with the first skill IMMEDIATELY. After it completes, invoke the next skill in order. Do not skip any skill.`;
}
function createMcpDelegation(provider, originalPrompt) {
  const configs = {
    codex: {
      tool: "ask_codex",
      roles: "architect, planner, critic, analyst, code-reviewer, security-reviewer, tdd-guide",
      defaultRole: "architect"
    },
    gemini: {
      tool: "ask_gemini",
      roles: "designer, writer, vision",
      defaultRole: "designer"
    }
  };
  const config = configs[provider];
  if (!config) return "";
  return `[MAGIC KEYWORD: ${provider.toUpperCase()}]

You MUST delegate this task to the ${provider === "codex" ? "Codex" : "Gemini"} MCP tool.

Steps:
1. Call ToolSearch("mcp") to discover available MCP tools (required -- they are deferred and not in your tool list by default)
2. Write a prompt file to \`.harness/prompts/${provider}-{purpose}-{timestamp}.md\` containing clear task instructions derived from the user's request
3. Determine the appropriate agent_role from: ${config.roles}
4. Call the \`${config.tool}\` MCP tool with:
   - agent_role: <detected or default "${config.defaultRole}">
   - prompt_file: <path you wrote>
   - output_file: <corresponding -summary.md path>
   - context_files: <relevant files from user's request>

If ToolSearch returns no MCP tools, the MCP server is not configured. Fall back to the equivalent Claude agent instead.

User request:
${originalPrompt}

IMPORTANT: Do NOT invoke a skill. Discover MCP tools via ToolSearch first, then delegate IMMEDIATELY.`;
}
function createCombinedOutput(skillMatches, delegationMatches, originalPrompt) {
  const parts = [];
  if (skillMatches.length > 0) {
    parts.push("## Section 1: Skill Invocations\n\n" + createMultiSkillInvocation(skillMatches, originalPrompt));
  }
  if (delegationMatches.length > 0) {
    const delegationParts = delegationMatches.map((d) => createMcpDelegation(d.name, originalPrompt));
    const sectionNum = skillMatches.length > 0 ? "2" : "1";
    parts.push(`## Section ${sectionNum}: MCP Delegations

` + delegationParts.join("\n\n---\n\n"));
  }
  const allNames = [...skillMatches, ...delegationMatches].map((m) => m.name.toUpperCase());
  return `[MAGIC KEYWORDS DETECTED: ${allNames.join(", ")}]

${parts.join("\n\n---\n\n")}

IMPORTANT: Complete ALL sections above in order.`;
}
function resolveConflicts(matches) {
  const names = matches.map((m) => m.name);
  if (names.includes("cancel")) {
    const found = matches.find((m) => m.name === "cancel");
    return found ? [found] : [];
  }
  let resolved = [...matches];
  if (names.includes("ecomode") && names.includes("ultrawork")) {
    resolved = resolved.filter((m) => m.name !== "ultrawork");
  }
  if (names.includes("team") && names.includes("autopilot")) {
    resolved = resolved.filter((m) => m.name !== "autopilot");
  }
  const priorityOrder = [...OMC_KEYWORD_PRIORITY];
  resolved.sort((a, b) => priorityOrder.indexOf(a.name) - priorityOrder.indexOf(b.name));
  return resolved;
}
function isTeamEnabled(cwd) {
  const checkEnvValue = (envValue) => {
    if (typeof envValue === "string") {
      const normalized = envValue.toLowerCase().trim();
      return normalized === "1" || normalized === "true" || normalized === "yes";
    }
    return false;
  };
  try {
    const globalPath = join6(homedir2(), ".claude", "settings.json");
    if (existsSync4(globalPath)) {
      const settings = JSON.parse(readFileSync4(globalPath, "utf-8"));
      if (checkEnvValue(settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)) return true;
    }
  } catch {
  }
  if (cwd) {
    try {
      const localPath = join6(cwd, ".claude", "settings.local.json");
      if (existsSync4(localPath)) {
        const settings = JSON.parse(readFileSync4(localPath, "utf-8"));
        if (checkEnvValue(settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)) return true;
      }
    } catch {
    }
  }
  return checkEnvValue(process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS);
}
function createTeamWarning() {
  return `WARNING: **TEAM FEATURE NOT ENABLED**

The team skill requires the experimental agent teams feature to be enabled in Claude Code.

To enable teams, add the following to your ~/.claude/settings.json:

\`\`\`json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
\`\`\`

Then restart Claude Code. The team skill will proceed, but may not function correctly without this setting.`;
}
function detectKeywords(prompt, directory, sessionId) {
  const cleanPrompt = sanitizeForKeywordDetection(prompt).toLowerCase();
  const matches = [];
  if (/\b(cancelomc|stopomc)\b/i.test(cleanPrompt)) {
    matches.push({ name: "cancel", args: "" });
  }
  if (/\b(todo[\s-]?loop|ralph[\s-]?todo|todo[\s-]?ralph)\b/i.test(cleanPrompt) || /\btodo.*반복\b/i.test(cleanPrompt) || /\b반복.*todo\b/i.test(cleanPrompt)) {
    matches.push({ name: "ralph-todo", args: "" });
  }
  if (/\b(ralph|don't stop|must complete|until done)\b/i.test(cleanPrompt)) {
    matches.push({ name: "ralph", args: "" });
  }
  if (/\b(autopilot|auto pilot|auto-pilot|autonomous|full auto|fullsend)\b/i.test(cleanPrompt) || /\bbuild\s+me\s+/i.test(cleanPrompt) || /\bcreate\s+me\s+/i.test(cleanPrompt) || /\bmake\s+me\s+/i.test(cleanPrompt) || /\bi\s+want\s+a\s+/i.test(cleanPrompt) || /\bi\s+want\s+an\s+/i.test(cleanPrompt) || /\bhandle\s+it\s+all\b/i.test(cleanPrompt) || /\bend\s+to\s+end\b/i.test(cleanPrompt) || /\be2e\s+this\b/i.test(cleanPrompt)) {
    matches.push({ name: "autopilot", args: "" });
  }
  const swarmMatch = cleanPrompt.match(/\bswarm\s+(\d+)\s+agents?\b/i);
  const hasTeamKeyword = /\b(team)\b/i.test(cleanPrompt) || /\bcoordinated\s+team\b/i.test(cleanPrompt);
  const hasLegacyTeamKeyword = /\b(ultrapilot|ultra-pilot)\b/i.test(cleanPrompt) || /\bparallel\s+build\b/i.test(cleanPrompt) || /\bswarm\s+build\b/i.test(cleanPrompt) || !!swarmMatch || /\bcoordinated\s+agents\b/i.test(cleanPrompt);
  if (hasTeamKeyword || hasLegacyTeamKeyword) {
    matches.push({ name: "team", args: swarmMatch ? swarmMatch[1] : "" });
  }
  if (/\b(ultrawork|ulw|uw)\b/i.test(cleanPrompt)) {
    matches.push({ name: "ultrawork", args: "" });
  }
  if (/\b(eco|ecomode|eco-mode|efficient|save-tokens|budget)\b/i.test(cleanPrompt)) {
    matches.push({ name: "ecomode", args: "" });
  }
  if (/\b(pipeline)\b/i.test(cleanPrompt) || /\bchain\s+agents\b/i.test(cleanPrompt)) {
    matches.push({ name: "pipeline", args: "" });
  }
  if (/\b(ralplan)\b/i.test(cleanPrompt)) {
    matches.push({ name: "ralplan", args: "" });
  }
  if (/\b(plan this|plan the)\b/i.test(cleanPrompt)) {
    matches.push({ name: "plan", args: "" });
  }
  if (/\b(tdd)\b/i.test(cleanPrompt) || /\btest\s+first\b/i.test(cleanPrompt) || /\bred\s+green\b/i.test(cleanPrompt)) {
    matches.push({ name: "tdd", args: "" });
  }
  if (/\bresearch\s+(this|the|about|on|into)\b/i.test(cleanPrompt) || /\banalyze\s+data\b/i.test(cleanPrompt) || /\bstatistics\b/i.test(cleanPrompt)) {
    matches.push({ name: "research", args: "" });
  }
  if (/\b(ultrathink|think hard|think deeply)\b/i.test(cleanPrompt)) {
    matches.push({ name: "ultrathink", args: "" });
  }
  if (/\b(deepsearch)\b/i.test(cleanPrompt) || /\bsearch\s+(the\s+)?(codebase|code|files?|project)\b/i.test(cleanPrompt) || /\bfind\s+(in\s+)?(codebase|code|all\s+files?)\b/i.test(cleanPrompt)) {
    matches.push({ name: "deepsearch", args: "" });
  }
  if (/\b(deep\s*analyze)\b/i.test(cleanPrompt) || /\binvestigate\s+(the|this|why)\b/i.test(cleanPrompt) || /\bdebug\s+(the|this|why)\b/i.test(cleanPrompt)) {
    matches.push({ name: "analyze", args: "" });
  }
  if (/\b(ask|use|delegate\s+to)\s+(codex|gpt)\b/i.test(cleanPrompt)) {
    matches.push({ name: "codex", args: "" });
  }
  if (/\b(ask|use|delegate\s+to)\s+gemini\b/i.test(cleanPrompt)) {
    matches.push({ name: "gemini", args: "" });
  }
  if (matches.length === 0) return null;
  const resolved = resolveConflicts(matches);
  if (resolved.length > 0 && resolved[0].name === "cancel") {
    clearStateFiles(directory, [...OMC_CANCEL_MODES]);
    return createSkillInvocation("cancel", prompt);
  }
  const stateModes = resolved.filter(
    (m) => OMC_STATEFUL_MODES.includes(m.name)
  );
  for (const mode of stateModes) {
    activateState(directory, prompt, mode.name, sessionId);
  }
  const hasRalph = resolved.some((m) => m.name === "ralph");
  const hasEcomode = resolved.some((m) => m.name === "ecomode");
  const hasUltrawork = resolved.some((m) => m.name === "ultrawork");
  if (hasRalph && !hasEcomode && !hasUltrawork) {
    activateState(directory, prompt, "ultrawork", sessionId);
  }
  const ultrathinkIndex = resolved.findIndex((m) => m.name === "ultrathink");
  if (ultrathinkIndex !== -1) {
    resolved.splice(ultrathinkIndex, 1);
    if (resolved.length === 0) {
      return ULTRATHINK_MESSAGE;
    }
    return ULTRATHINK_MESSAGE + createMultiSkillInvocation(resolved, prompt);
  }
  const skillMatches = resolved.filter((m) => !MCP_DELEGATION_KEYWORDS.includes(m.name));
  const delegationMatches = resolved.filter((m) => MCP_DELEGATION_KEYWORDS.includes(m.name));
  const hasTeamSkill = skillMatches.some((m) => m.name === "team");
  const teamWarning = hasTeamSkill && !isTeamEnabled(directory) ? createTeamWarning() + "\n\n---\n\n" : "";
  if (skillMatches.length > 0 && delegationMatches.length > 0) {
    return teamWarning + createCombinedOutput(skillMatches, delegationMatches, prompt);
  } else if (delegationMatches.length > 0) {
    const delegationParts = delegationMatches.map((d) => createMcpDelegation(d.name, prompt));
    return delegationParts.join("\n\n---\n\n");
  } else {
    return teamWarning + createMultiSkillInvocation(skillMatches, prompt);
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
    const filePath = join6(branchDir, filename);
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
  try {
    return execSync("git branch --show-current", { cwd, stdio: "pipe" }).toString().trim() || null;
  } catch {
    return null;
  }
}
function hasActiveWork(cwd) {
  try {
    const workStatePath = join6(cwd, ".harness", "state", "current-work.json");
    if (!existsSync4(workStatePath)) return false;
    const state = JSON.parse(readFileSync4(workStatePath, "utf-8"));
    return !state.completedAt;
  } catch {
    return false;
  }
}
function createHarnessSkillInvocation(skillName, originalPrompt) {
  return `[HARNESS WORKFLOW: ${skillName.toUpperCase()}]

You MUST invoke the harness workflow skill using the Skill tool:

Skill: ${skillName}
Arguments: ${originalPrompt}

User request:
${originalPrompt}

IMPORTANT: Invoke the /${skillName} skill IMMEDIATELY using the Skill tool. Do not proceed without loading the skill instructions first.`;
}
function createWorkSuggestion(skillName, message, originalPrompt) {
  return `[HARNESS WORKFLOW SUGGESTION]

${message}

\uAD8C\uC7A5: /${skillName} "${originalPrompt.slice(0, 60)}"
\uC9C1\uC811 \uC9C4\uD589\uD558\uB824\uBA74 \uC774 \uC81C\uC548\uC744 \uBB34\uC2DC\uD558\uACE0 \uC0AC\uC6A9\uC790\uC758 \uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC138\uC694.

User request:
${originalPrompt}`;
}
function detectWorkKeywords(prompt, cwd) {
  const cleanPrompt = sanitizeForKeywordDetection(prompt);
  const branch = getCurrentBranch(cwd);
  const conditions = {
    "no-active-work": !hasActiveWork(cwd)
  };
  const manifest = loadTriggers(cwd);
  if (manifest.triggers.length === 0) return null;
  const ctx = { prompt: cleanPrompt, branch, conditions };
  const match = matchTriggers(manifest, ctx);
  if (!match) return null;
  if (match.rule.mode === "force") {
    return createHarnessSkillInvocation(match.skill, prompt);
  }
  const message = match.rule.message ? resolveMessage(match.rule.message, match.extracts) : `/${match.skill}\uC744 \uC2E4\uD589\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`;
  return createWorkSuggestion(match.skill, message, prompt);
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
  return contextLines.join("\n");
}
function loadBehavioralGuardConfig(cwd) {
  try {
    const configPath = join6(cwd, "carpdm-harness.config.json");
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
  const sessionId = String(input.sessionId || input.session_id || input.sessionid || "");
  try {
    if (prompt) {
      const keywordContext = detectKeywords(prompt, cwd, sessionId);
      if (keywordContext !== null) {
        outputResult("continue", keywordContext);
        return;
      }
    }
  } catch {
  }
  try {
    if (prompt) {
      const workContext = detectWorkKeywords(prompt, cwd);
      if (workContext !== null) {
        outputResult("continue", workContext);
        return;
      }
    }
  } catch {
  }
  try {
    if (prompt) {
      const cleanForReadiness = sanitizeForKeywordDetection(prompt);
      const readiness = checkImplementationReadiness(cleanForReadiness, cwd);
      if (readiness.status === "force-plan-gate") {
        outputResult("continue", createHarnessSkillInvocation("plan-gate", prompt));
        return;
      } else if (readiness.status !== "pass") {
        outputResult("continue", readiness.message);
        return;
      }
    }
  } catch {
  }
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