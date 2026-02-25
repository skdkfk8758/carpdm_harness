// src/hooks/prompt-enricher.ts
import { readFileSync as readFileSync3, writeFileSync, mkdirSync, existsSync as existsSync3, unlinkSync } from "fs";
import { join as join4 } from "path";
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
  "autopilot",
  "team",
  "ultrawork",
  "ecomode"
];
var OMC_CANCEL_MODES = [
  "ralph",
  "autopilot",
  "team",
  "ultrawork",
  "ecomode",
  "pipeline"
];
var OMC_KEYWORD_PRIORITY = [
  "cancel",
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
  if (!existsSync3(localDir)) {
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
  if (!existsSync3(globalDir)) {
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
      if (existsSync3(localPath)) unlinkSync(localPath);
    } catch {
    }
    try {
      if (existsSync3(globalPath)) unlinkSync(globalPath);
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
    const globalPath = join4(homedir2(), ".claude", "settings.json");
    if (existsSync3(globalPath)) {
      const settings = JSON.parse(readFileSync3(globalPath, "utf-8"));
      if (checkEnvValue(settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)) return true;
    }
  } catch {
  }
  if (cwd) {
    try {
      const localPath = join4(cwd, ".claude", "settings.local.json");
      if (existsSync3(localPath)) {
        const settings = JSON.parse(readFileSync3(localPath, "utf-8"));
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
  if (/\b(research)\b/i.test(cleanPrompt) || /\banalyze\s+data\b/i.test(cleanPrompt) || /\bstatistics\b/i.test(cleanPrompt)) {
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
function getCurrentBranch(cwd) {
  try {
    return execSync("git branch --show-current", { cwd, stdio: "pipe" }).toString().trim() || null;
  } catch {
    return null;
  }
}
function hasActiveWork(cwd) {
  try {
    const workStatePath = join4(cwd, ".harness", "state", "current-work.json");
    if (!existsSync3(workStatePath)) return false;
    const state = JSON.parse(readFileSync3(workStatePath, "utf-8"));
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
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (!instance || !instance.status || instance.status === "completed" || instance.status === "aborted") {
    outputResult("continue");
    return;
  }
  const workflowContext = buildWorkflowContext(instance, cwd);
  outputResult("continue", workflowContext);
}
main();
//# sourceMappingURL=prompt-enricher.js.map