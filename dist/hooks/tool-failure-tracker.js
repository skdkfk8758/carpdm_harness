// src/hooks/tool-failure-tracker.ts
import { readFileSync as readFileSync2, writeFileSync, existsSync as existsSync2, mkdirSync } from "fs";
import { resolve, normalize } from "path";

// src/hooks/hook-utils.ts
import { readFileSync, existsSync, readdirSync } from "fs";
import { join as join2 } from "path";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
function harnessStateDir(projectRoot) {
  return join(projectRoot, ".harness", "state");
}
function harnessToolErrorPath(projectRoot) {
  return join(projectRoot, ".harness", "state", "last-tool-error.json");
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

// src/hooks/tool-failure-tracker.ts
var RETRY_WINDOW_MS = 6e4;
function isPathContained(targetPath, containerPath) {
  const resolvedTarget = resolve(normalize(targetPath));
  const resolvedContainer = resolve(normalize(containerPath));
  return resolvedTarget.startsWith(resolvedContainer + "/") || resolvedTarget === resolvedContainer;
}
function previewJson(value, maxLen = 200) {
  if (value === void 0 || value === null) return "";
  try {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    return str.length > maxLen ? str.slice(0, maxLen - 3) + "..." : str;
  } catch {
    return "";
  }
}
function truncate(str, maxLen = 500) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen - 3) + "..." : str;
}
function main() {
  let input;
  try {
    const raw = readFileSync2("/dev/stdin", "utf-8");
    const parsed = parseHookInput(raw);
    if (!parsed) {
      process.stdout.write(JSON.stringify({ result: "continue" }));
      return;
    }
    input = parsed;
  } catch {
    process.stdout.write(JSON.stringify({ result: "continue" }));
    return;
  }
  if (input.is_interrupt === true) {
    process.stdout.write(JSON.stringify({ result: "continue" }));
    return;
  }
  const cwd = input.cwd || process.cwd();
  const stateDir = harnessStateDir(cwd);
  if (!isPathContained(stateDir, cwd)) {
    process.stdout.write(JSON.stringify({ result: "continue" }));
    return;
  }
  try {
    mkdirSync(stateDir, { recursive: true });
  } catch {
    process.stdout.write(JSON.stringify({ result: "continue" }));
    return;
  }
  const errorFilePath = harnessToolErrorPath(cwd);
  const toolName = input.tool_name || "unknown";
  const now = /* @__PURE__ */ new Date();
  const timestamp = now.toISOString();
  let retryCount = 0;
  if (existsSync2(errorFilePath)) {
    try {
      const prev = JSON.parse(readFileSync2(errorFilePath, "utf-8"));
      const prevTime = new Date(prev.timestamp).getTime();
      const elapsed = now.getTime() - prevTime;
      if (prev.tool_name === toolName && elapsed <= RETRY_WINDOW_MS) {
        retryCount = (prev.retry_count || 0) + 1;
      }
    } catch {
    }
  }
  const record = {
    tool_name: toolName,
    tool_input_preview: previewJson(input.tool_input, 200),
    error: truncate(input.error || "", 500),
    timestamp,
    retry_count: retryCount
  };
  try {
    writeFileSync(errorFilePath, JSON.stringify(record, null, 2), "utf-8");
  } catch {
  }
  process.stdout.write(JSON.stringify({ result: "continue" }));
}
main();
//# sourceMappingURL=tool-failure-tracker.js.map