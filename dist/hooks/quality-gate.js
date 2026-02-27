// src/hooks/quality-gate.ts
import { readFileSync, existsSync, readdirSync } from "fs";
import { join as join2 } from "path";
import { execSync } from "child_process";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
var OMC_TEAM_MODES = ["team", "swarm", "ultrapilot"];
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

// src/types/behavioral-guard.ts
var DEFAULT_BEHAVIORAL_GUARD_CONFIG = {
  rationalization: "on",
  redFlagDetection: "on"
};

// src/hooks/quality-gate.ts
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
  const toolInput = input.tool_input || {};
  const command = toolInput.command || "";
  if (toolName !== "Bash" || !/git\s+commit/.test(command)) {
    outputResult("continue");
    return;
  }
  const cwd = input.cwd || process.cwd();
  const configPath = join2(cwd, "carpdm-harness.config.json");
  if (!existsSync(configPath)) {
    outputResult("continue");
    return;
  }
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    outputResult("continue");
    return;
  }
  const qualityGate = config.qualityGate || {};
  const mode = qualityGate.mode || "warn";
  if (mode === "off") {
    outputResult("continue");
    return;
  }
  if (isOmcTeamMode(cwd)) {
    outputResult("continue", "[quality-gate] OMC team/swarm \uBAA8\uB4DC \uD65C\uC131 - \uD488\uC9C8 \uAC8C\uC774\uD2B8 \uB85C\uAE45\uB9CC \uC218\uD589");
    return;
  }
  let stagedFiles = [];
  try {
    const staged = execSync("git diff --cached --name-only", { cwd, stdio: "pipe" }).toString().trim();
    stagedFiles = staged ? staged.split("\n").filter(Boolean) : [];
  } catch {
    outputResult("continue");
    return;
  }
  if (stagedFiles.length === 0) {
    outputResult("continue");
    return;
  }
  const warnings = [];
  const secretPatterns = [
    /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}['"]/i,
    /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    /(?:secret|token)\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}['"]/i,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/,
    /ghp_[A-Za-z0-9]{36,}/
  ];
  let secretFound = false;
  const secretFiles = [];
  for (const file of stagedFiles) {
    const filePath = join2(cwd, file);
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, "utf-8");
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          secretFound = true;
          secretFiles.push(file);
          break;
        }
      }
    } catch {
    }
  }
  if (secretFound) {
    warnings.push(`Secured: [ERROR] \uC2DC\uD06C\uB9BF \uD328\uD134 \uAC10\uC9C0 - ${secretFiles.slice(0, 3).join(", ")}`);
  } else {
    warnings.push("Secured: [OK] \uC2DC\uD06C\uB9BF \uBBF8\uAC10\uC9C0");
  }
  try {
    const branch = execSync("git branch --show-current", { cwd, stdio: "pipe" }).toString().trim();
    const branchConvention = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|hotfix|release|main|master|develop|dev)\//;
    const issueRefPattern = /(?:#\d+|[A-Z]{2,}-\d+)/;
    if (branch && branch !== "main" && branch !== "master" && branch !== "develop" && branch !== "dev") {
      if (branchConvention.test(branch)) {
        warnings.push(`Trackable: [OK] \uBE0C\uB79C\uCE58 \uCEE8\uBCA4\uC158 \uC900\uC218 (${branch})`);
      } else {
        warnings.push(`Trackable: [WARN] \uBE0C\uB79C\uCE58 \uCEE8\uBCA4\uC158 \uBBF8\uC900\uC218 (${branch})`);
      }
    } else {
      warnings.push(`Trackable: [WARN] \uAE30\uBCF8 \uBE0C\uB79C\uCE58(${branch})\uC5D0 \uC9C1\uC811 \uCEE4\uBC0B \u2014 /work-start\uB85C feature \uBE0C\uB79C\uCE58 \uC0DD\uC131\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4`);
    }
    if (!issueRefPattern.test(branch)) {
      warnings.push("Trackable: [WARN] \uBE0C\uB79C\uCE58\uC5D0 \uC774\uC288 \uBC88\uD638 \uBBF8\uD3EC\uD568 \u2014 \uCEE4\uBC0B \uBA54\uC2DC\uC9C0\uC5D0 (#\uC774\uC288\uBC88\uD638)\uB97C \uD3EC\uD568\uD558\uC138\uC694");
    }
  } catch {
    warnings.push("Trackable: [INFO] \uBE0C\uB79C\uCE58 \uD655\uC778 \uC2E4\uD328");
  }
  const behavioralGuard = config.behavioralGuard || {};
  const redFlagMode = behavioralGuard.redFlagDetection || DEFAULT_BEHAVIORAL_GUARD_CONFIG.redFlagDetection;
  if (redFlagMode === "on") {
    const commitMsgMatch = command.match(/git\s+commit\s+(?:.*\s)?-m\s+["']([^"']+)["']/);
    if (commitMsgMatch) {
      const commitMsg = commitMsgMatch[1];
      const redFlagResult = detectRedFlags(commitMsg);
      if (redFlagResult.hasRedFlags) {
        const redFlagReport = buildRedFlagContext(redFlagResult);
        warnings.push(`RedFlag: [WARN] \uCEE4\uBC0B \uBA54\uC2DC\uC9C0\uC5D0\uC11C \uC801\uC2E0\uD638 \uAC10\uC9C0
${redFlagReport}`);
      }
    }
  }
  const report = [
    `[quality-gate] \uCEE4\uBC0B \uAC10\uC9C0. \uBE60\uB978 \uBCF4\uC548/\uCD94\uC801 \uAC80\uC99D \uACB0\uACFC:`,
    ...warnings.map((w) => `- ${w}`),
    `\uC804\uCCB4 TRUST 5 \uAC80\uC99D\uC740 harness_quality_check({ projectRoot: "${cwd}" }) \uC2E4\uD589\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.`
  ].join("\n");
  if (mode === "block" && secretFound) {
    outputResult("block", report);
    return;
  }
  outputResult("continue", report);
}
function isOmcTeamMode(cwd) {
  const stateDir = omcStateDir(cwd);
  if (!existsSync(stateDir)) return false;
  try {
    const stateFiles = readdirSync(stateDir).filter((f) => f.endsWith("-state.json"));
    for (const file of stateFiles) {
      try {
        const state = JSON.parse(readFileSync(join2(stateDir, file), "utf-8"));
        if (state.active) {
          const mode = file.replace("-state.json", "");
          if (OMC_TEAM_MODES.includes(mode)) {
            return true;
          }
        }
      } catch {
      }
    }
  } catch {
  }
  return false;
}
function outputResult(result, additionalContext) {
  const output = { result };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}
main();
//# sourceMappingURL=quality-gate.js.map