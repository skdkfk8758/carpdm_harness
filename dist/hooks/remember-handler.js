// src/hooks/remember-handler.ts
import { readFileSync as readFileSync3, writeFileSync, existsSync as existsSync3, mkdirSync } from "fs";

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
function omcDir(projectRoot) {
  return join(projectRoot, ".omc");
}
function omcNotepadPath(projectRoot) {
  return join(projectRoot, ".omc", "notepad.md");
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

// src/hooks/remember-handler.ts
var NOTEPAD_TEMPLATE = `# Notepad
<!-- Auto-managed by OMC. Manual edits preserved in MANUAL section. -->

## Priority Context
<!-- ALWAYS loaded. Keep under 500 chars. Critical discoveries only. -->

## Working Memory
<!-- Session notes. Auto-pruned after 7 days. -->

## MANUAL
<!-- User content. Never auto-pruned. -->
`;
var TARGET_TOOLS = /* @__PURE__ */ new Set(["Task", "task", "TaskCreate", "TaskUpdate", "TodoWrite"]);
function getResponseText(toolResponse) {
  if (typeof toolResponse === "string") return toolResponse;
  if (toolResponse && typeof toolResponse === "object") {
    const obj = toolResponse;
    if (typeof obj["output"] === "string") return obj["output"];
    if (typeof obj["content"] === "string") return obj["content"];
    try {
      return JSON.stringify(toolResponse);
    } catch {
      return "";
    }
  }
  return "";
}
function parseRememberTags(text) {
  const priority = [];
  const working = [];
  const priorityRegex = /<remember\s+priority>([\s\S]*?)<\/remember>/gi;
  let m;
  while ((m = priorityRegex.exec(text)) !== null) {
    const content = m[1].trim();
    if (content) priority.push(content);
  }
  const workingRegex = /<remember(?!\s+priority)>([\s\S]*?)<\/remember>/gi;
  while ((m = workingRegex.exec(text)) !== null) {
    const content = m[1].trim();
    if (content) working.push(content);
  }
  return { priority, working };
}
function readNotepad(notepadPath) {
  if (!existsSync3(notepadPath)) return NOTEPAD_TEMPLATE;
  try {
    return readFileSync3(notepadPath, "utf-8");
  } catch {
    return NOTEPAD_TEMPLATE;
  }
}
function updatePrioritySection(content, additions) {
  const marker = "## Priority Context";
  const nextMarker = "## Working Memory";
  const idx = content.indexOf(marker);
  const nextIdx = content.indexOf(nextMarker);
  if (idx === -1) return content;
  const before = content.slice(0, idx + marker.length);
  const after = nextIdx !== -1 ? content.slice(nextIdx) : "";
  const sectionRaw = nextIdx !== -1 ? content.slice(idx + marker.length, nextIdx) : content.slice(idx + marker.length);
  const commentLines = sectionRaw.split("\n").filter((l) => l.trim().startsWith("<!--"));
  const existingText = sectionRaw.split("\n").filter((l) => l.trim() && !l.trim().startsWith("<!--")).join("\n").trim();
  const combined = [existingText, ...additions].filter(Boolean).join("\n");
  const truncated = combined.length > 500 ? combined.slice(0, 497) + "..." : combined;
  const newSection = "\n" + commentLines.join("\n") + (commentLines.length ? "\n" : "") + (truncated ? truncated + "\n" : "") + "\n";
  return before + newSection + after;
}
function updateWorkingSection(content, additions) {
  const marker = "## Working Memory";
  const nextMarker = "## MANUAL";
  const idx = content.indexOf(marker);
  const nextIdx = content.indexOf(nextMarker);
  if (idx === -1) return content;
  const before = content.slice(0, idx + marker.length);
  const after = nextIdx !== -1 ? content.slice(nextIdx) : "";
  const sectionRaw = nextIdx !== -1 ? content.slice(idx + marker.length, nextIdx) : content.slice(idx + marker.length);
  const commentLines = sectionRaw.split("\n").filter((l) => l.trim().startsWith("<!--"));
  const existingBody = sectionRaw.split("\n").filter((l) => !l.trim().startsWith("<!--")).join("\n");
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ");
  const newEntries = additions.map((a) => `[${timestamp}] ${a}`).join("\n");
  const newSection = "\n" + commentLines.join("\n") + (commentLines.length ? "\n" : "") + existingBody.trimEnd() + (existingBody.trim() ? "\n" : "") + newEntries + "\n\n";
  return before + newSection + after;
}
function main() {
  let input;
  try {
    const raw = readFileSync3("/dev/stdin", "utf-8");
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
  const toolName = input.tool_name || "";
  if (!TARGET_TOOLS.has(toolName)) {
    process.stdout.write(JSON.stringify({ result: "continue" }));
    return;
  }
  const cwd = input.cwd || process.cwd();
  const responseText = getResponseText(input.tool_response);
  const { priority, working } = parseRememberTags(responseText);
  if (priority.length === 0 && working.length === 0) {
    process.stdout.write(JSON.stringify({ result: "continue" }));
    return;
  }
  const omcBaseDir = omcDir(cwd);
  const notepadPath = omcNotepadPath(cwd);
  try {
    mkdirSync(omcBaseDir, { recursive: true });
  } catch {
  }
  try {
    let notepad = readNotepad(notepadPath);
    if (priority.length > 0) {
      notepad = updatePrioritySection(notepad, priority);
    }
    if (working.length > 0) {
      notepad = updateWorkingSection(notepad, working);
    }
    writeFileSync(notepadPath, notepad, "utf-8");
  } catch {
  }
  process.stdout.write(JSON.stringify({ result: "continue" }));
}
main();
//# sourceMappingURL=remember-handler.js.map