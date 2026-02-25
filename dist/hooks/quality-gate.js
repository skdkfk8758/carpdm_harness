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