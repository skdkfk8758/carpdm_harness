import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  omcConfigPath,
  omcNotepadPath,
  omcStatePath,
  omcGlobalStatePath,
  harnessUpdateCheckPath,
  harnessOnboardedMarkerPath,
  harnessCapabilitiesPath,
  OMC_REGISTRY_URL,
} from '../core/omc-compat.js';

interface HookInput {
  cwd?: string;
  directory?: string;
  sessionId?: string;
  session_id?: string;
  sessionid?: string;
  [key: string]: unknown;
}

interface HookOutput {
  result: 'continue';
  additionalContext?: string;
}

function readJsonFile(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJsonFile(path: string, data: unknown): boolean {
  try {
    const dir = join(path, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (parts1[i] || 0) - (parts2[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function checkOmcUpdates(currentVersion: string): Promise<{ latestVersion: string; currentVersion: string } | null> {
  const cacheFile = harnessUpdateCheckPath();
  const now = Date.now();
  const CACHE_DURATION = 24 * 60 * 60 * 1000;

  const cached = readJsonFile(cacheFile);
  if (cached && typeof cached.timestamp === 'number' && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.updateAvailable
      ? { latestVersion: cached.latestVersion as string, currentVersion: cached.currentVersion as string }
      : null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(OMC_REGISTRY_URL, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json() as { version: string };
    const latestVersion = data.version;
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

    writeJsonFile(cacheFile, { timestamp: now, latestVersion, currentVersion, updateAvailable });

    return updateAvailable ? { latestVersion, currentVersion } : null;
  } catch {
    return null;
  }
}

function extractNotepadPriorityContext(directory: string): string | null {
  const notepadPath = omcNotepadPath(directory);
  if (!existsSync(notepadPath)) return null;

  try {
    const content = readFileSync(notepadPath, 'utf-8');
    const PRIORITY_HEADER = '## Priority Context';
    const WORKING_HEADER = '## Working Memory';
    const regex = new RegExp(`${PRIORITY_HEADER}\\n([\\s\\S]*?)(?=\\n## [^#]|$)`);
    const match = content.match(regex);
    if (!match) return null;

    // Working Memory 이전까지만 추출
    let section = match[1];
    const workingIdx = section.indexOf(WORKING_HEADER);
    if (workingIdx !== -1) section = section.slice(0, workingIdx);

    // HTML 코멘트 제거 후 trim
    section = section.replace(/<!--[\s\S]*?-->/g, '').trim();
    return section || null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  let input: HookInput = {};
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = JSON.parse(raw) as HookInput;
  } catch {
    outputResult();
    return;
  }

  const cwd = input.cwd || input.directory || process.cwd();
  const sessionId = (input.sessionId || input.session_id || input.sessionid || '') as string;
  const messages: string[] = [];

  // ── 1. harness 기본 정보 ──────────────────────────────────────────────────
  const configPath = join(cwd, 'carpdm-harness.config.json');
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;

      const infoLines: string[] = [
        `[carpdm-harness v4] preset: ${config.preset || 'unknown'}`,
        `모듈: ${((config.modules as string[]) || []).join(', ')}`,
        config.updatedAt ? `마지막 업데이트: ${config.updatedAt}` : '',
      ];

      // OMC 버전
      const omcCfgPath = omcConfigPath();
      if (existsSync(omcCfgPath)) {
        try {
          const omcConfig = JSON.parse(readFileSync(omcCfgPath, 'utf-8')) as Record<string, unknown>;
          infoLines.push(`OMC: v${omcConfig.version || 'unknown'}`);
        } catch {
          infoLines.push('OMC: 감지됨');
        }
      }

      // capabilities 캐시
      const capabilitiesPath = harnessCapabilitiesPath(cwd);
      if (existsSync(capabilitiesPath)) {
        try {
          const caps = JSON.parse(readFileSync(capabilitiesPath, 'utf-8')) as Record<string, unknown>;
          const tools = (caps.tools || {}) as Record<string, Record<string, unknown>>;
          const detected = Object.entries(tools)
            .filter(([, v]) => v.detected)
            .map(([k]) => k);
          if (detected.length > 0) {
            infoLines.push(`외부 도구: ${detected.join(', ')}`);
          }
        } catch {
          // 무시
        }
      }

      // 첫 세션 온보딩 감지
      const onboardedMarker = harnessOnboardedMarkerPath(cwd);
      if (!existsSync(onboardedMarker)) {
        infoLines.push(
          '[AGENT SUGGEST] 첫 세션 감지! agents/onboarding-guide.md를 참조하여 온보딩 절차를 진행하세요.',
        );
        try {
          const markerDir = dirname(onboardedMarker);
          mkdirSync(markerDir, { recursive: true });
          writeFileSync(onboardedMarker, new Date().toISOString(), 'utf-8');
        } catch {
          // 무시
        }
      }

      const infoText = infoLines.filter(Boolean).join('\n');
      messages.push(`<session-restore>\n\n[CARPDM-HARNESS]\n\n${infoText}\n\n</session-restore>\n\n---\n`);
    } catch {
      // config 읽기 실패 — 무시
    }
  }

  // ── 2. OMC 업데이트 체크 ──────────────────────────────────────────────────
  try {
    const omcConfig = readJsonFile(omcConfigPath());
    const currentVersion = (omcConfig?.version as string) || '0.0.0';
    const updateInfo = await checkOmcUpdates(currentVersion);
    if (updateInfo) {
      messages.push(
        `<session-restore>\n\n[OMC UPDATE AVAILABLE]\n\nA new version of oh-my-claudecode is available: v${updateInfo.latestVersion} (current: v${updateInfo.currentVersion})\n\nTo update, run: omc update\n\n</session-restore>\n\n---\n`,
      );
    }
  } catch {
    // 업데이트 체크 실패 — 무시
  }

  // ── 3. ultrawork/ralph 세션 복원 ──────────────────────────────────────────
  try {
    const ultraworkState =
      (readJsonFile(omcStatePath(cwd, 'ultrawork')) ||
        readJsonFile(omcGlobalStatePath('ultrawork'))) as Record<string, unknown> | null;

    if (
      ultraworkState?.active &&
      (!ultraworkState.session_id || ultraworkState.session_id === sessionId)
    ) {
      messages.push(
        `<session-restore>\n\n[ULTRAWORK MODE RESTORED]\n\nYou have an active ultrawork session from ${ultraworkState.started_at}.\nOriginal task: ${ultraworkState.original_prompt}\n\nContinue working in ultrawork mode until all tasks are complete.\n\n</session-restore>\n\n---\n`,
      );
    }
  } catch {
    // 무시
  }

  // ── 4. notepad Priority Context 주입 ─────────────────────────────────────
  try {
    const priorityContext = extractNotepadPriorityContext(cwd);
    if (priorityContext) {
      messages.push(
        `<session-restore>\n\n[NOTEPAD PRIORITY CONTEXT LOADED]\n\n<notepad-priority>\n\n## Priority Context\n\n${priorityContext}\n\n</notepad-priority>\n\n</session-restore>\n\n---\n`,
      );
    }
  } catch {
    // 무시
  }

  // ── 5. MCP 도구 디스커버리 리마인더 ──────────────────────────────────────
  messages.push(
    `<session-restore>\n\n[MCP TOOL DISCOVERY REQUIRED]\n\nMCP tools (ask_codex, ask_gemini) are deferred and NOT in your tool list yet.\nBefore first use, call ToolSearch("mcp") to discover all available MCP tools.\nIf ToolSearch returns no results, MCP servers are not configured -- use Claude agent fallbacks instead.\n\n</session-restore>\n\n---\n`,
  );

  outputResult(messages.length > 0 ? messages.join('\n') : undefined);
}

function outputResult(additionalContext?: string): void {
  const output: HookOutput = { result: 'continue' };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}

main().catch(() => outputResult());
