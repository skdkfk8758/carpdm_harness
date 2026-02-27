// src/hooks/remember-handler.ts
import { readFileSync as readFileSync2, writeFileSync, existsSync as existsSync2, mkdirSync } from "fs";

// src/hooks/hook-utils.ts
import { readFileSync, existsSync, readdirSync } from "fs";
import { join as join2 } from "path";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
function omcDir(projectRoot) {
  return join(projectRoot, ".omc");
}
function omcNotepadPath(projectRoot) {
  return join(projectRoot, ".omc", "notepad.md");
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
  if (!existsSync2(notepadPath)) return NOTEPAD_TEMPLATE;
  try {
    return readFileSync2(notepadPath, "utf-8");
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