import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
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
  HARNESS_REGISTRY_URL,
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

interface UpdateCheckResult {
  latestVersion: string;
  currentVersion: string;
}

async function checkNpmUpdates(
  registryUrl: string,
  currentVersion: string,
  cacheKey: string,
): Promise<UpdateCheckResult | null> {
  const cacheFile = harnessUpdateCheckPath();
  const now = Date.now();
  const CACHE_DURATION = 24 * 60 * 60 * 1000;

  const cached = readJsonFile(cacheFile) as Record<string, unknown> | null;
  const cacheEntry = cached?.[cacheKey] as Record<string, unknown> | undefined;
  if (cacheEntry && typeof cacheEntry.timestamp === 'number' && (now - cacheEntry.timestamp) < CACHE_DURATION) {
    return cacheEntry.updateAvailable
      ? { latestVersion: cacheEntry.latestVersion as string, currentVersion: cacheEntry.currentVersion as string }
      : null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(registryUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json() as { version: string };
    const latestVersion = data.version;
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

    const updatedCache = { ...(cached || {}), [cacheKey]: { timestamp: now, latestVersion, currentVersion, updateAvailable } };
    writeJsonFile(cacheFile, updatedCache);

    return updateAvailable ? { latestVersion, currentVersion } : null;
  } catch {
    return null;
  }
}

function countFiles(dir: string, ext: string): number {
  try {
    if (!existsSync(dir)) return 0;
    return readdirSync(dir).filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
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

  // ── 1.5. 브랜치 상태 + /work-start 안내 ─────────────────────────────────────
  try {
    const { execSync } = await import('node:child_process');
    const branch = execSync('git branch --show-current', { cwd, stdio: 'pipe' }).toString().trim();
    if (branch) {
      const isMain = branch === 'main' || branch === 'master';
      const branchInfo = isMain
        ? `브랜치: ${branch} (기본) — 새 작업 시작: /work-start "<작업 설명>"`
        : `브랜치: ${branch} — 작업 완료: /work-finish`;

      // 기존 harness 정보 블록에 브랜치 정보 추가
      const infoIdx = messages.findIndex(m => m.includes('[CARPDM-HARNESS]'));
      if (infoIdx >= 0) {
        messages[infoIdx] = messages[infoIdx].replace(
          '</session-restore>',
          `${branchInfo}\n\n</session-restore>`,
        );
      }
    }
  } catch {
    // git 미설치 또는 비 git 프로젝트 — 무시
  }

  // ── 1.6. lessons.md 최근 교훈 주입 ──────────────────────────────────────────
  try {
    const lessonsPath = existsSync(join(cwd, '.agent', 'lessons.md'))
      ? join(cwd, '.agent', 'lessons.md')
      : existsSync(join(cwd, 'lessons.md'))
        ? join(cwd, 'lessons.md')
        : null;

    if (lessonsPath) {
      const lessonsContent = readFileSync(lessonsPath, 'utf-8');
      // 실제 교훈 항목만 추출 (- **상황**: 으로 시작하는 블록)
      const lessonEntries: string[] = [];
      const lines = lessonsContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^- \*\*상황\*\*/)) {
          // 교훈 블록 수집 (현재 줄 + 들여쓰기된 후속 줄)
          let block = lines[i];
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].match(/^\s+(- [❌✅]|-)/) || lines[j].match(/^\s+카테고리:/)) {
              block += '\n' + lines[j];
            } else {
              break;
            }
          }
          lessonEntries.push(block);
        }
      }

      if (lessonEntries.length > 0) {
        // 최근 5개만 주입
        const recent = lessonEntries.slice(-5);
        const infoIdx = messages.findIndex(m => m.includes('[CARPDM-HARNESS]'));
        if (infoIdx >= 0) {
          messages[infoIdx] = messages[infoIdx].replace(
            '</session-restore>',
            `\n[LESSONS] 이전 세션 교훈 (${recent.length}/${lessonEntries.length}개):\n${recent.join('\n')}\n\n</session-restore>`,
          );
        }
      }
    }
  } catch {
    // lessons.md 읽기 실패 — 무시
  }

  // ── 1.7. handoff.md 인수인계 컨텍스트 주입 ────────────────────────────────
  try {
    const handoffPath = join(cwd, '.agent', 'handoff.md');
    if (existsSync(handoffPath)) {
      const handoffContent = readFileSync(handoffPath, 'utf-8');
      // 비어있지 않은 handoff만 주입
      const trimmed = handoffContent.replace(/^#.*\n/gm, '').replace(/^>.*\n/gm, '').trim();
      if (trimmed.length > 50) {
        messages.push(
          `<session-restore>\n\n[PREVIOUS SESSION HANDOFF]\n\n${handoffContent}\n\n</session-restore>\n\n---\n`,
        );
      }
    }
  } catch {
    // handoff.md 읽기 실패 — 무시
  }

  // ── 1.8. 온톨로지 요약 자동 주입 ──────────────────────────────────────────
  try {
    const ontologyDir = join(cwd, '.agent', 'ontology');
    const structurePath = join(ontologyDir, 'ONTOLOGY-STRUCTURE.md');

    if (existsSync(structurePath)) {
      const summaryParts: string[] = [];

      // Structure: 파일/디렉토리 수 + 언어 상위 3개
      try {
        const structContent = readFileSync(structurePath, 'utf-8');
        const filesMatch = structContent.match(/전체 파일 수\s*\|\s*([^\n|]+)/);
        const dirsMatch = structContent.match(/전체 디렉토리 수\s*\|\s*([^\n|]+)/);
        if (filesMatch || dirsMatch) {
          summaryParts.push(`- 구조: 파일 ${filesMatch?.[1]?.trim() ?? '?'}개, 디렉토리 ${dirsMatch?.[1]?.trim() ?? '?'}개`);
        }
        const langLines = [...structContent.matchAll(/\| (\w+) \| ([\d,]+) \|/g)];
        if (langLines.length > 0) {
          const top3 = langLines.slice(0, 3).map(m => `${m[1]}(${m[2]})`);
          summaryParts.push(`- 언어: ${top3.join(', ')}`);
        }
      } catch { /* 무시 */ }

      // Domain: 프로젝트 요약 (1줄)
      try {
        const domainPath = join(ontologyDir, 'ONTOLOGY-DOMAIN.md');
        if (existsSync(domainPath)) {
          const domainContent = readFileSync(domainPath, 'utf-8');
          const summaryMatch = domainContent.match(/## Project Summary\n\n(.+)/);
          if (summaryMatch && !summaryMatch[1].includes('_(요약 없음)_')) {
            summaryParts.push(`- 요약: ${summaryMatch[1].trim().slice(0, 200)}`);
          }
        }
      } catch { /* 무시 */ }

      // Semantics: @MX:ANCHOR 상위 5개 (수정 시 영향 큰 심볼)
      try {
        const semanticsPath = join(ontologyDir, 'ONTOLOGY-SEMANTICS.md');
        if (existsSync(semanticsPath)) {
          const semContent = readFileSync(semanticsPath, 'utf-8');
          // ANCHOR 섹션 내 항목만 (fan_in 컬럼이 있는 테이블)
          const anchorSection = semContent.indexOf('@MX:ANCHOR');
          if (anchorSection !== -1) {
            const sectionText = semContent.slice(anchorSection, semContent.indexOf('\n### ', anchorSection + 1));
            const anchors = [...sectionText.matchAll(/\| `([^`]+)` \| `[^`]*` \| (\d+) \|/g)];
            if (anchors.length > 0) {
              const top5 = anchors.slice(0, 5).map(m => `${m[1]}(fan_in=${m[2]})`);
              summaryParts.push(`- @MX:ANCHOR (수정 주의): ${top5.join(', ')}`);
            }
          }
        }
      } catch { /* 무시 */ }

      if (summaryParts.length > 0) {
        const infoIdx = messages.findIndex(m => m.includes('[CARPDM-HARNESS]'));
        if (infoIdx >= 0) {
          messages[infoIdx] = messages[infoIdx].replace(
            '</session-restore>',
            `\n[ONTOLOGY] 프로젝트 지식 맵:\n${summaryParts.join('\n')}\n\n</session-restore>`,
          );
        }
      }
    }
  } catch {
    // 온톨로지 읽기 실패 — 무시
  }

  // ── 2. 업데이트 체크 (harness + OMC) ────────────────────────────────────────
  const updateLines: string[] = [];

  // 2-1. carpdm-harness 자체 업데이트
  try {
    const harnessConfig = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
      : null;
    const harnessVersion = (harnessConfig?.version as string) || '0.0.0';
    // package.json에서 실제 설치 버전 확인
    const pkgPath = join(cwd, 'node_modules', 'carpdm-harness', 'package.json');
    const installedVersion = existsSync(pkgPath)
      ? (JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>).version as string
      : harnessVersion;
    const harnessUpdate = await checkNpmUpdates(HARNESS_REGISTRY_URL, installedVersion || '0.0.0', 'harness');
    if (harnessUpdate) {
      updateLines.push(`  harness: v${harnessUpdate.currentVersion} → v${harnessUpdate.latestVersion}`);
    }
  } catch {
    // 무시
  }

  // 2-2. OMC 업데이트
  try {
    const omcConfig = readJsonFile(omcConfigPath());
    const currentVersion = (omcConfig?.version as string) || '0.0.0';
    const omcUpdate = await checkNpmUpdates(OMC_REGISTRY_URL, currentVersion, 'omc');
    if (omcUpdate) {
      updateLines.push(`  OMC: v${omcUpdate.currentVersion} → v${omcUpdate.latestVersion}`);
    }
  } catch {
    // 무시
  }

  if (updateLines.length > 0) {
    messages.push(
      `<session-restore>\n\n[UPDATES AVAILABLE]\n\n${updateLines.join('\n')}\n\n업데이트: /update-all 실행\n확인만: /update-check 실행\n\n</session-restore>\n\n---\n`,
    );
  }

  // ── 2-3. 설치 컴포넌트 요약 ────────────────────────────────────────────────
  try {
    const componentLines: string[] = [];
    const commandsDir = join(cwd, '.claude', 'commands');
    const hooksDir = join(cwd, '.claude', 'hooks');
    const skillCount = countFiles(commandsDir, '.md');
    const hookCount = countFiles(hooksDir, '.sh');

    if (skillCount > 0) componentLines.push(`Skills: ${skillCount}개`);
    if (hookCount > 0) componentLines.push(`Hooks: ${hookCount}개`);

    // MCP 서버 확인 (plugin.json 또는 .mcp.json)
    const pluginJsonPath = join(cwd, '.claude-plugin', 'plugin.json');
    if (existsSync(pluginJsonPath)) {
      try {
        const plugin = JSON.parse(readFileSync(pluginJsonPath, 'utf-8')) as Record<string, unknown>;
        const servers = plugin.mcpServers as Record<string, unknown> | string | undefined;
        if (servers && typeof servers === 'object') {
          componentLines.push(`MCP: ${Object.keys(servers).join(', ')}`);
        }
      } catch {
        // 무시
      }
    }

    if (componentLines.length > 0) {
      const infoIdx = messages.findIndex(m => m.includes('[CARPDM-HARNESS]'));
      if (infoIdx >= 0) {
        // 기존 harness 정보 블록에 컴포넌트 요약 추가
        messages[infoIdx] = messages[infoIdx].replace(
          '</session-restore>',
          `컴포넌트: ${componentLines.join(' | ')}\n\n</session-restore>`,
        );
      }
    }
  } catch {
    // 무시
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
