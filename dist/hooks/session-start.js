// src/hooks/session-start.ts
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join as join2, dirname } from "path";

// src/core/omc-compat.ts
import { join } from "path";
import { homedir } from "os";
function omcStatePath(projectRoot, mode) {
  return join(projectRoot, ".omc", "state", `${mode}-state.json`);
}
function omcGlobalStatePath(mode) {
  return join(homedir(), ".omc", "state", `${mode}-state.json`);
}
function omcNotepadPath(projectRoot) {
  return join(projectRoot, ".omc", "notepad.md");
}
function omcConfigPath() {
  return join(homedir(), ".claude", ".omc-config.json");
}
function harnessUpdateCheckPath() {
  return join(homedir(), ".harness", "update-check.json");
}
function harnessOnboardedMarkerPath(projectRoot) {
  return join(projectRoot, ".harness", "state", "onboarded");
}
function harnessCapabilitiesPath(projectRoot) {
  return join(projectRoot, ".harness", "capabilities.json");
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

// src/hooks/session-start.ts
function readJsonFile(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}
function writeJsonFile(path, data) {
  try {
    const dir = join2(path, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}
function compareVersions(v1, v2) {
  const parts1 = v1.replace(/^v/, "").split(".").map(Number);
  const parts2 = v2.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (parts1[i] || 0) - (parts2[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
async function checkNpmUpdates(registryUrl, currentVersion, cacheKey) {
  const cacheFile = harnessUpdateCheckPath();
  const now = Date.now();
  const CACHE_DURATION = 24 * 60 * 60 * 1e3;
  const cached = readJsonFile(cacheFile);
  const cacheEntry = cached?.[cacheKey];
  if (cacheEntry && typeof cacheEntry.timestamp === "number" && now - cacheEntry.timestamp < CACHE_DURATION) {
    return cacheEntry.updateAvailable ? { latestVersion: cacheEntry.latestVersion, currentVersion: cacheEntry.currentVersion } : null;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2e3);
    const response = await fetch(registryUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    const latestVersion = data.version;
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
    const updatedCache = { ...cached || {}, [cacheKey]: { timestamp: now, latestVersion, currentVersion, updateAvailable } };
    writeJsonFile(cacheFile, updatedCache);
    return updateAvailable ? { latestVersion, currentVersion } : null;
  } catch {
    return null;
  }
}
function countFiles(dir, ext) {
  try {
    if (!existsSync(dir)) return 0;
    return readdirSync(dir).filter((f) => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}
function extractNotepadPriorityContext(directory) {
  const notepadPath = omcNotepadPath(directory);
  if (!existsSync(notepadPath)) return null;
  try {
    const content = readFileSync(notepadPath, "utf-8");
    const PRIORITY_HEADER = "## Priority Context";
    const WORKING_HEADER = "## Working Memory";
    const regex = new RegExp(`${PRIORITY_HEADER}\\n([\\s\\S]*?)(?=\\n## [^#]|$)`);
    const match = content.match(regex);
    if (!match) return null;
    let section = match[1];
    const workingIdx = section.indexOf(WORKING_HEADER);
    if (workingIdx !== -1) section = section.slice(0, workingIdx);
    section = section.replace(/<!--[\s\S]*?-->/g, "").trim();
    return section || null;
  } catch {
    return null;
  }
}
async function main() {
  let input = {};
  try {
    const raw = readFileSync("/dev/stdin", "utf-8");
    input = JSON.parse(raw);
  } catch {
    outputResult();
    return;
  }
  const cwd = input.cwd || input.directory || process.cwd();
  const sessionId = input.sessionId || input.session_id || input.sessionid || "";
  const messages = [];
  const configPath = join2(cwd, "carpdm-harness.config.json");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      const infoLines = [
        `[carpdm-harness v4] preset: ${config.preset || "unknown"}`,
        `\uBAA8\uB4C8: ${(config.modules || []).join(", ")}`,
        config.updatedAt ? `\uB9C8\uC9C0\uB9C9 \uC5C5\uB370\uC774\uD2B8: ${config.updatedAt}` : ""
      ];
      const omcCfgPath = omcConfigPath();
      if (existsSync(omcCfgPath)) {
        try {
          const omcConfig = JSON.parse(readFileSync(omcCfgPath, "utf-8"));
          infoLines.push(`OMC: v${omcConfig.version || "unknown"}`);
        } catch {
          infoLines.push("OMC: \uAC10\uC9C0\uB428");
        }
      }
      const capabilitiesPath = harnessCapabilitiesPath(cwd);
      if (existsSync(capabilitiesPath)) {
        try {
          const caps = JSON.parse(readFileSync(capabilitiesPath, "utf-8"));
          const tools = caps.tools || {};
          const detected = Object.entries(tools).filter(([, v]) => v.detected).map(([k]) => k);
          if (detected.length > 0) {
            infoLines.push(`\uC678\uBD80 \uB3C4\uAD6C: ${detected.join(", ")}`);
          }
        } catch {
        }
      }
      const onboardedMarker = harnessOnboardedMarkerPath(cwd);
      if (!existsSync(onboardedMarker)) {
        infoLines.push(
          "[AGENT SUGGEST] \uCCAB \uC138\uC158 \uAC10\uC9C0! agents/onboarding-guide.md\uB97C \uCC38\uC870\uD558\uC5EC \uC628\uBCF4\uB529 \uC808\uCC28\uB97C \uC9C4\uD589\uD558\uC138\uC694."
        );
        try {
          const markerDir = dirname(onboardedMarker);
          mkdirSync(markerDir, { recursive: true });
          writeFileSync(onboardedMarker, (/* @__PURE__ */ new Date()).toISOString(), "utf-8");
        } catch {
        }
      }
      const infoText = infoLines.filter(Boolean).join("\n");
      messages.push(`<session-restore>

[CARPDM-HARNESS]

${infoText}

</session-restore>

---
`);
    } catch {
    }
  }
  try {
    const { execSync } = await import("child_process");
    const branch = execSync("git branch --show-current", { cwd, stdio: "pipe" }).toString().trim();
    if (branch) {
      const isMain = branch === "main" || branch === "master";
      const branchInfo = isMain ? `\uBE0C\uB79C\uCE58: ${branch} (\uAE30\uBCF8) \u2014 \uC0C8 \uC791\uC5C5 \uC2DC\uC791: /work-start "<\uC791\uC5C5 \uC124\uBA85>"` : `\uBE0C\uB79C\uCE58: ${branch} \u2014 \uC791\uC5C5 \uC644\uB8CC: /work-finish`;
      const infoIdx = messages.findIndex((m) => m.includes("[CARPDM-HARNESS]"));
      if (infoIdx >= 0) {
        messages[infoIdx] = messages[infoIdx].replace(
          "</session-restore>",
          `${branchInfo}

</session-restore>`
        );
      }
    }
  } catch {
  }
  try {
    const lessonsPath = existsSync(join2(cwd, ".agent", "lessons.md")) ? join2(cwd, ".agent", "lessons.md") : existsSync(join2(cwd, "lessons.md")) ? join2(cwd, "lessons.md") : null;
    if (lessonsPath) {
      const lessonsContent = readFileSync(lessonsPath, "utf-8");
      const lessonEntries = [];
      const lines = lessonsContent.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^- \*\*상황\*\*/)) {
          let block = lines[i];
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].match(/^\s+(- [❌✅]|-)/) || lines[j].match(/^\s+카테고리:/)) {
              block += "\n" + lines[j];
            } else {
              break;
            }
          }
          lessonEntries.push(block);
        }
      }
      if (lessonEntries.length > 0) {
        const recent = lessonEntries.slice(-5);
        const infoIdx = messages.findIndex((m) => m.includes("[CARPDM-HARNESS]"));
        if (infoIdx >= 0) {
          messages[infoIdx] = messages[infoIdx].replace(
            "</session-restore>",
            `
[LESSONS] \uC774\uC804 \uC138\uC158 \uAD50\uD6C8 (${recent.length}/${lessonEntries.length}\uAC1C):
${recent.join("\n")}

</session-restore>`
          );
        }
      }
    }
  } catch {
  }
  try {
    const handoffPath = join2(cwd, ".agent", "handoff.md");
    if (existsSync(handoffPath)) {
      const handoffContent = readFileSync(handoffPath, "utf-8");
      const trimmed = handoffContent.replace(/^#.*\n/gm, "").replace(/^>.*\n/gm, "").trim();
      if (trimmed.length > 50) {
        messages.push(
          `<session-restore>

[PREVIOUS SESSION HANDOFF]

${handoffContent}

</session-restore>

---
`
        );
      }
    }
  } catch {
  }
  try {
    const ontologyDir = join2(cwd, ".agent", "ontology");
    const structurePath = join2(ontologyDir, "ONTOLOGY-STRUCTURE.md");
    if (existsSync(structurePath)) {
      const summaryParts = [];
      try {
        const structContent = readFileSync(structurePath, "utf-8");
        const filesMatch = structContent.match(/전체 파일 수\s*\|\s*([^\n|]+)/);
        const dirsMatch = structContent.match(/전체 디렉토리 수\s*\|\s*([^\n|]+)/);
        if (filesMatch || dirsMatch) {
          summaryParts.push(`- \uAD6C\uC870: \uD30C\uC77C ${filesMatch?.[1]?.trim() ?? "?"}\uAC1C, \uB514\uB809\uD1A0\uB9AC ${dirsMatch?.[1]?.trim() ?? "?"}\uAC1C`);
        }
        const langLines = [...structContent.matchAll(/\| (\w+) \| ([\d,]+) \|/g)];
        if (langLines.length > 0) {
          const top3 = langLines.slice(0, 3).map((m) => `${m[1]}(${m[2]})`);
          summaryParts.push(`- \uC5B8\uC5B4: ${top3.join(", ")}`);
        }
      } catch {
      }
      try {
        const domainPath = join2(ontologyDir, "ONTOLOGY-DOMAIN.md");
        if (existsSync(domainPath)) {
          const domainContent = readFileSync(domainPath, "utf-8");
          const summaryMatch = domainContent.match(/## Project Summary\n\n(.+)/);
          if (summaryMatch && !summaryMatch[1].includes("_(\uC694\uC57D \uC5C6\uC74C)_")) {
            summaryParts.push(`- \uC694\uC57D: ${summaryMatch[1].trim().slice(0, 200)}`);
          }
        }
      } catch {
      }
      try {
        const semanticsPath = join2(ontologyDir, "ONTOLOGY-SEMANTICS.md");
        if (existsSync(semanticsPath)) {
          const semContent = readFileSync(semanticsPath, "utf-8");
          const anchorSection = semContent.indexOf("@MX:ANCHOR");
          if (anchorSection !== -1) {
            const sectionText = semContent.slice(anchorSection, semContent.indexOf("\n### ", anchorSection + 1));
            const anchors = [...sectionText.matchAll(/\| `([^`]+)` \| `[^`]*` \| (\d+) \|/g)];
            if (anchors.length > 0) {
              const top5 = anchors.slice(0, 5).map((m) => `${m[1]}(fan_in=${m[2]})`);
              summaryParts.push(`- @MX:ANCHOR (\uC218\uC815 \uC8FC\uC758): ${top5.join(", ")}`);
            }
          }
        }
      } catch {
      }
      if (summaryParts.length > 0) {
        const infoIdx = messages.findIndex((m) => m.includes("[CARPDM-HARNESS]"));
        if (infoIdx >= 0) {
          messages[infoIdx] = messages[infoIdx].replace(
            "</session-restore>",
            `
[ONTOLOGY] \uD504\uB85C\uC81D\uD2B8 \uC9C0\uC2DD \uB9F5:
${summaryParts.join("\n")}

</session-restore>`
          );
        }
      }
    }
  } catch {
  }
  const updateLines = [];
  try {
    const harnessConfig = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : null;
    const harnessVersion = harnessConfig?.version || "0.0.0";
    const pkgPath = join2(cwd, "node_modules", "carpdm-harness", "package.json");
    const installedVersion = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf-8")).version : harnessVersion;
    const harnessUpdate = await checkNpmUpdates(HARNESS_REGISTRY_URL, installedVersion || "0.0.0", "harness");
    if (harnessUpdate) {
      updateLines.push(`  harness: v${harnessUpdate.currentVersion} \u2192 v${harnessUpdate.latestVersion}`);
    }
  } catch {
  }
  try {
    const omcConfig = readJsonFile(omcConfigPath());
    const currentVersion = omcConfig?.version || "0.0.0";
    const omcUpdate = await checkNpmUpdates(OMC_REGISTRY_URL, currentVersion, "omc");
    if (omcUpdate) {
      updateLines.push(`  OMC: v${omcUpdate.currentVersion} \u2192 v${omcUpdate.latestVersion}`);
    }
  } catch {
  }
  if (updateLines.length > 0) {
    messages.push(
      `<session-restore>

[UPDATES AVAILABLE]

${updateLines.join("\n")}

\uC5C5\uB370\uC774\uD2B8: /update-all \uC2E4\uD589
\uD655\uC778\uB9CC: /update-check \uC2E4\uD589

</session-restore>

---
`
    );
  }
  try {
    const componentLines = [];
    const commandsDir = join2(cwd, ".claude", "commands");
    const hooksDir = join2(cwd, ".claude", "hooks");
    const skillCount = countFiles(commandsDir, ".md");
    const hookCount = countFiles(hooksDir, ".sh");
    if (skillCount > 0) componentLines.push(`Skills: ${skillCount}\uAC1C`);
    if (hookCount > 0) componentLines.push(`Hooks: ${hookCount}\uAC1C`);
    const pluginJsonPath = join2(cwd, ".claude-plugin", "plugin.json");
    if (existsSync(pluginJsonPath)) {
      try {
        const plugin = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
        const servers = plugin.mcpServers;
        if (servers && typeof servers === "object") {
          componentLines.push(`MCP: ${Object.keys(servers).join(", ")}`);
        }
      } catch {
      }
    }
    if (componentLines.length > 0) {
      const infoIdx = messages.findIndex((m) => m.includes("[CARPDM-HARNESS]"));
      if (infoIdx >= 0) {
        messages[infoIdx] = messages[infoIdx].replace(
          "</session-restore>",
          `\uCEF4\uD3EC\uB10C\uD2B8: ${componentLines.join(" | ")}

</session-restore>`
        );
      }
    }
  } catch {
  }
  try {
    const ultraworkState = readJsonFile(omcStatePath(cwd, "ultrawork")) || readJsonFile(omcGlobalStatePath("ultrawork"));
    if (ultraworkState?.active && (!ultraworkState.session_id || ultraworkState.session_id === sessionId)) {
      messages.push(
        `<session-restore>

[ULTRAWORK MODE RESTORED]

You have an active ultrawork session from ${ultraworkState.started_at}.
Original task: ${ultraworkState.original_prompt}

Continue working in ultrawork mode until all tasks are complete.

</session-restore>

---
`
      );
    }
  } catch {
  }
  try {
    const priorityContext = extractNotepadPriorityContext(cwd);
    if (priorityContext) {
      messages.push(
        `<session-restore>

[NOTEPAD PRIORITY CONTEXT LOADED]

<notepad-priority>

## Priority Context

${priorityContext}

</notepad-priority>

</session-restore>

---
`
      );
    }
  } catch {
  }
  messages.push(
    `<session-restore>

[MCP TOOL DISCOVERY REQUIRED]

MCP tools (ask_codex, ask_gemini) are deferred and NOT in your tool list yet.
Before first use, call ToolSearch("mcp") to discover all available MCP tools.
If ToolSearch returns no results, MCP servers are not configured -- use Claude agent fallbacks instead.

</session-restore>

---
`
  );
  outputResult(messages.length > 0 ? messages.join("\n") : void 0);
}
function outputResult(additionalContext) {
  const output = { result: "continue" };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}
main().catch(() => outputResult());
//# sourceMappingURL=session-start.js.map