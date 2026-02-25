import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  parseHookInput,
  outputResult,
  loadActiveWorkflowFromFiles,
  detectOmcMode,
} from './hook-utils.js';
import type { WorkflowStateData } from './hook-utils.js';
import {
  omcStateDir,
  omcGlobalStateDir,
  omcStatePath,
  omcGlobalStatePath,
  OMC_CANCEL_MODES,
  OMC_STATEFUL_MODES,
  OMC_KEYWORD_PRIORITY,
  MCP_DELEGATION_KEYWORDS,
} from '../core/omc-compat.js';

interface PromptEnricherInput {
  cwd?: string;
  prompt?: string;
  sessionId?: string;
  session_id?: string;
  sessionid?: string;
  [key: string]: unknown;
}

interface KeywordMatch {
  name: string;
  args: string;
}

// ===== ULTRATHINK 메시지 =====

const ULTRATHINK_MESSAGE = `<think-mode>

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

// ===== 키워드 감지 유틸 함수 =====

/**
 * false positive 방지를 위해 XML 태그, URL, 파일경로, 코드블록을 제거합니다.
 * OMC keyword-detector.mjs의 sanitizeForKeywordDetection()과 동일한 로직.
 */
function sanitizeForKeywordDetection(text: string): string {
  return text
    // 1. XML 스타일 태그 블록 제거: <tag-name ...>...</tag-name>
    .replace(/<(\w[\w-]*)[\s>][\s\S]*?<\/\1>/g, '')
    // 2. 자기 닫힘 XML 태그 제거: <tag-name />, <tag-name attr="val" />
    .replace(/<\w[\w-]*(?:\s[^>]*)?\s*\/>/g, '')
    // 3. URL 제거: http://... 또는 https://...
    .replace(/https?:\/\/[^\s)>\]]+/g, '')
    // 4. 파일 경로 제거 (lookbehind 대신 capture group 사용 — 광범위 호환)
    .replace(/(^|[\s"'`(])(\/)?(?:[\w.-]+\/)+[\w.-]+/gm, '$1')
    // 5. 마크다운 코드블록 제거
    .replace(/```[\s\S]*?```/g, '')
    // 6. 인라인 코드 제거
    .replace(/`[^`]+`/g, '');
}

/**
 * 모드 state 파일을 로컬(.omc/state/)과 글로벌(~/.omc/state/) 양쪽에 씁니다.
 */
function activateState(
  directory: string,
  prompt: string,
  stateName: string,
  sessionId: string,
): void {
  const state = {
    active: true,
    started_at: new Date().toISOString(),
    original_prompt: prompt,
    session_id: sessionId || undefined,
    reinforcement_count: 0,
    last_checked_at: new Date().toISOString(),
  };

  const localDir = omcStateDir(directory);
  if (!existsSync(localDir)) {
    try { mkdirSync(localDir, { recursive: true }); } catch { /* 무시 */ }
  }
  try { writeFileSync(omcStatePath(directory, stateName), JSON.stringify(state, null, 2)); } catch { /* 무시 */ }

  const globalDir = omcGlobalStateDir();
  if (!existsSync(globalDir)) {
    try { mkdirSync(globalDir, { recursive: true }); } catch { /* 무시 */ }
  }
  try { writeFileSync(omcGlobalStatePath(stateName), JSON.stringify(state, null, 2)); } catch { /* 무시 */ }
}

/**
 * cancel 시 모든 모드 state 파일을 삭제합니다.
 */
function clearStateFiles(directory: string, modeNames: string[]): void {
  for (const name of modeNames) {
    const localPath = omcStatePath(directory, name);
    const globalPath = omcGlobalStatePath(name);
    try { if (existsSync(localPath)) unlinkSync(localPath); } catch { /* 무시 */ }
    try { if (existsSync(globalPath)) unlinkSync(globalPath); } catch { /* 무시 */ }
  }
}

/**
 * 스킬 호출 메시지를 생성합니다. [MAGIC KEYWORD: ...] 형식.
 */
function createSkillInvocation(skillName: string, originalPrompt: string, args = ''): string {
  const argsSection = args ? `\nArguments: ${args}` : '';
  return `[MAGIC KEYWORD: ${skillName.toUpperCase()}]

You MUST invoke the skill using the Skill tool:

Skill: oh-my-claudecode:${skillName}${argsSection}

User request:
${originalPrompt}

IMPORTANT: Invoke the skill IMMEDIATELY. Do not proceed without loading the skill instructions.`;
}

/**
 * 복수 스킬 호출 메시지를 생성합니다.
 */
function createMultiSkillInvocation(skills: KeywordMatch[], originalPrompt: string): string {
  if (skills.length === 0) return '';
  if (skills.length === 1) {
    return createSkillInvocation(skills[0].name, originalPrompt, skills[0].args);
  }

  const skillBlocks = skills.map((s, i) => {
    const argsSection = s.args ? `\nArguments: ${s.args}` : '';
    return `### Skill ${i + 1}: ${s.name.toUpperCase()}\nSkill: oh-my-claudecode:${s.name}${argsSection}`;
  }).join('\n\n');

  return `[MAGIC KEYWORDS DETECTED: ${skills.map(s => s.name.toUpperCase()).join(', ')}]

You MUST invoke ALL of the following skills using the Skill tool, in order:

${skillBlocks}

User request:
${originalPrompt}

IMPORTANT: Invoke ALL skills listed above. Start with the first skill IMMEDIATELY. After it completes, invoke the next skill in order. Do not skip any skill.`;
}

/**
 * MCP 위임 메시지를 생성합니다. (스킬 호출이 아닌 MCP 도구 직접 호출)
 */
function createMcpDelegation(provider: string, originalPrompt: string): string {
  const configs: Record<string, { tool: string; roles: string; defaultRole: string }> = {
    codex: {
      tool: 'ask_codex',
      roles: 'architect, planner, critic, analyst, code-reviewer, security-reviewer, tdd-guide',
      defaultRole: 'architect',
    },
    gemini: {
      tool: 'ask_gemini',
      roles: 'designer, writer, vision',
      defaultRole: 'designer',
    },
  };
  const config = configs[provider];
  if (!config) return '';

  return `[MAGIC KEYWORD: ${provider.toUpperCase()}]

You MUST delegate this task to the ${provider === 'codex' ? 'Codex' : 'Gemini'} MCP tool.

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

/**
 * 스킬 + MCP 위임이 혼재할 때 합친 출력을 생성합니다.
 */
function createCombinedOutput(
  skillMatches: KeywordMatch[],
  delegationMatches: KeywordMatch[],
  originalPrompt: string,
): string {
  const parts: string[] = [];

  if (skillMatches.length > 0) {
    parts.push('## Section 1: Skill Invocations\n\n' + createMultiSkillInvocation(skillMatches, originalPrompt));
  }

  if (delegationMatches.length > 0) {
    const delegationParts = delegationMatches.map(d => createMcpDelegation(d.name, originalPrompt));
    const sectionNum = skillMatches.length > 0 ? '2' : '1';
    parts.push(`## Section ${sectionNum}: MCP Delegations\n\n` + delegationParts.join('\n\n---\n\n'));
  }

  const allNames = [...skillMatches, ...delegationMatches].map(m => m.name.toUpperCase());
  return `[MAGIC KEYWORDS DETECTED: ${allNames.join(', ')}]\n\n${parts.join('\n\n---\n\n')}\n\nIMPORTANT: Complete ALL sections above in order.`;
}

/**
 * 감지된 키워드 간 충돌을 해소합니다.
 */
function resolveConflicts(matches: KeywordMatch[]): KeywordMatch[] {
  const names = matches.map(m => m.name);

  // Cancel은 단독
  if (names.includes('cancel')) {
    const found = matches.find(m => m.name === 'cancel');
    return found ? [found] : [];
  }

  let resolved = [...matches];

  // Ecomode > ultrawork
  if (names.includes('ecomode') && names.includes('ultrawork')) {
    resolved = resolved.filter(m => m.name !== 'ultrawork');
  }

  // Team > autopilot
  if (names.includes('team') && names.includes('autopilot')) {
    resolved = resolved.filter(m => m.name !== 'autopilot');
  }

  // 우선순위 정렬
  const priorityOrder: string[] = [...OMC_KEYWORD_PRIORITY];
  resolved.sort((a, b) => priorityOrder.indexOf(a.name) - priorityOrder.indexOf(b.name));

  return resolved;
}

/**
 * team 기능 활성화 여부를 확인합니다.
 * 글로벌 settings.json과 프로젝트 settings.local.json 모두 검사합니다.
 */
function isTeamEnabled(cwd?: string): boolean {
  const checkEnvValue = (envValue: unknown): boolean => {
    if (typeof envValue === 'string') {
      const normalized = envValue.toLowerCase().trim();
      return normalized === '1' || normalized === 'true' || normalized === 'yes';
    }
    return false;
  };

  // 1. 글로벌 settings.json 확인
  try {
    const globalPath = join(homedir(), '.claude', 'settings.json');
    if (existsSync(globalPath)) {
      const settings = JSON.parse(readFileSync(globalPath, 'utf-8')) as { env?: Record<string, string> };
      if (checkEnvValue(settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)) return true;
    }
  } catch {
    // 무시
  }

  // 2. 프로젝트 settings.local.json 확인
  if (cwd) {
    try {
      const localPath = join(cwd, '.claude', 'settings.local.json');
      if (existsSync(localPath)) {
        const settings = JSON.parse(readFileSync(localPath, 'utf-8')) as { env?: Record<string, string> };
        if (checkEnvValue(settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)) return true;
      }
    } catch {
      // 무시
    }
  }

  // 3. 환경변수 직접 확인 (Claude Code가 settings → env 매핑 후 프로세스에 주입)
  return checkEnvValue(process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS);
}

/**
 * team 기능 미활성화 경고 메시지를 생성합니다.
 */
function createTeamWarning(): string {
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

/**
 * 프롬프트에서 16종 매직 키워드를 감지하고 additionalContext 문자열을 반환합니다.
 * 감지되지 않으면 null 반환.
 */
function detectKeywords(
  prompt: string,
  directory: string,
  sessionId: string,
): string | null {
  const cleanPrompt = sanitizeForKeywordDetection(prompt).toLowerCase();

  const matches: KeywordMatch[] = [];

  // Cancel
  if (/\b(cancelomc|stopomc)\b/i.test(cleanPrompt)) {
    matches.push({ name: 'cancel', args: '' });
  }

  // Ralph
  if (/\b(ralph|don't stop|must complete|until done)\b/i.test(cleanPrompt)) {
    matches.push({ name: 'ralph', args: '' });
  }

  // Autopilot
  if (
    /\b(autopilot|auto pilot|auto-pilot|autonomous|full auto|fullsend)\b/i.test(cleanPrompt) ||
    /\bbuild\s+me\s+/i.test(cleanPrompt) ||
    /\bcreate\s+me\s+/i.test(cleanPrompt) ||
    /\bmake\s+me\s+/i.test(cleanPrompt) ||
    /\bi\s+want\s+a\s+/i.test(cleanPrompt) ||
    /\bi\s+want\s+an\s+/i.test(cleanPrompt) ||
    /\bhandle\s+it\s+all\b/i.test(cleanPrompt) ||
    /\bend\s+to\s+end\b/i.test(cleanPrompt) ||
    /\be2e\s+this\b/i.test(cleanPrompt)
  ) {
    matches.push({ name: 'autopilot', args: '' });
  }

  // Team (legacy ultrapilot/swarm 포함)
  const swarmMatch = cleanPrompt.match(/\bswarm\s+(\d+)\s+agents?\b/i);
  const hasTeamKeyword =
    /\b(team)\b/i.test(cleanPrompt) ||
    /\bcoordinated\s+team\b/i.test(cleanPrompt);
  const hasLegacyTeamKeyword =
    /\b(ultrapilot|ultra-pilot)\b/i.test(cleanPrompt) ||
    /\bparallel\s+build\b/i.test(cleanPrompt) ||
    /\bswarm\s+build\b/i.test(cleanPrompt) ||
    !!swarmMatch ||
    /\bcoordinated\s+agents\b/i.test(cleanPrompt);
  if (hasTeamKeyword || hasLegacyTeamKeyword) {
    matches.push({ name: 'team', args: swarmMatch ? swarmMatch[1] : '' });
  }

  // Ultrawork
  if (/\b(ultrawork|ulw|uw)\b/i.test(cleanPrompt)) {
    matches.push({ name: 'ultrawork', args: '' });
  }

  // Ecomode
  if (/\b(eco|ecomode|eco-mode|efficient|save-tokens|budget)\b/i.test(cleanPrompt)) {
    matches.push({ name: 'ecomode', args: '' });
  }

  // Pipeline
  if (/\b(pipeline)\b/i.test(cleanPrompt) || /\bchain\s+agents\b/i.test(cleanPrompt)) {
    matches.push({ name: 'pipeline', args: '' });
  }

  // Ralplan
  if (/\b(ralplan)\b/i.test(cleanPrompt)) {
    matches.push({ name: 'ralplan', args: '' });
  }

  // Plan
  if (/\b(plan this|plan the)\b/i.test(cleanPrompt)) {
    matches.push({ name: 'plan', args: '' });
  }

  // TDD
  if (
    /\b(tdd)\b/i.test(cleanPrompt) ||
    /\btest\s+first\b/i.test(cleanPrompt) ||
    /\bred\s+green\b/i.test(cleanPrompt)
  ) {
    matches.push({ name: 'tdd', args: '' });
  }

  // Research
  if (
    /\b(research)\b/i.test(cleanPrompt) ||
    /\banalyze\s+data\b/i.test(cleanPrompt) ||
    /\bstatistics\b/i.test(cleanPrompt)
  ) {
    matches.push({ name: 'research', args: '' });
  }

  // Ultrathink
  if (/\b(ultrathink|think hard|think deeply)\b/i.test(cleanPrompt)) {
    matches.push({ name: 'ultrathink', args: '' });
  }

  // Deepsearch
  if (
    /\b(deepsearch)\b/i.test(cleanPrompt) ||
    /\bsearch\s+(the\s+)?(codebase|code|files?|project)\b/i.test(cleanPrompt) ||
    /\bfind\s+(in\s+)?(codebase|code|all\s+files?)\b/i.test(cleanPrompt)
  ) {
    matches.push({ name: 'deepsearch', args: '' });
  }

  // Analyze
  if (
    /\b(deep\s*analyze)\b/i.test(cleanPrompt) ||
    /\binvestigate\s+(the|this|why)\b/i.test(cleanPrompt) ||
    /\bdebug\s+(the|this|why)\b/i.test(cleanPrompt)
  ) {
    matches.push({ name: 'analyze', args: '' });
  }

  // Codex/GPT (intent phrase 필수)
  if (/\b(ask|use|delegate\s+to)\s+(codex|gpt)\b/i.test(cleanPrompt)) {
    matches.push({ name: 'codex', args: '' });
  }

  // Gemini (intent phrase 필수)
  if (/\b(ask|use|delegate\s+to)\s+gemini\b/i.test(cleanPrompt)) {
    matches.push({ name: 'gemini', args: '' });
  }

  if (matches.length === 0) return null;

  const resolved = resolveConflicts(matches);

  // Cancel: state 삭제 후 스킬 호출
  if (resolved.length > 0 && resolved[0].name === 'cancel') {
    clearStateFiles(directory, [...OMC_CANCEL_MODES]);
    return createSkillInvocation('cancel', prompt);
  }

  // State 파일 활성화
  const stateModes = resolved.filter(m =>
    (OMC_STATEFUL_MODES as readonly string[]).includes(m.name),
  );
  for (const mode of stateModes) {
    activateState(directory, prompt, mode.name, sessionId);
  }

  // Ralph + ultrawork 없고 ecomode 없으면 ultrawork도 활성화
  const hasRalph = resolved.some(m => m.name === 'ralph');
  const hasEcomode = resolved.some(m => m.name === 'ecomode');
  const hasUltrawork = resolved.some(m => m.name === 'ultrawork');
  if (hasRalph && !hasEcomode && !hasUltrawork) {
    activateState(directory, prompt, 'ultrawork', sessionId);
  }

  // Ultrathink: 메시지 앞에 prepend
  const ultrathinkIndex = resolved.findIndex(m => m.name === 'ultrathink');
  if (ultrathinkIndex !== -1) {
    resolved.splice(ultrathinkIndex, 1);
    if (resolved.length === 0) {
      return ULTRATHINK_MESSAGE;
    }
    return ULTRATHINK_MESSAGE + createMultiSkillInvocation(resolved, prompt);
  }

  // 스킬 vs MCP 분리
  const skillMatches = resolved.filter(m => !(MCP_DELEGATION_KEYWORDS as readonly string[]).includes(m.name));
  const delegationMatches = resolved.filter(m => (MCP_DELEGATION_KEYWORDS as readonly string[]).includes(m.name));

  // Team 경고
  const hasTeamSkill = skillMatches.some(m => m.name === 'team');
  const teamWarning = hasTeamSkill && !isTeamEnabled(directory) ? createTeamWarning() + '\n\n---\n\n' : '';

  if (skillMatches.length > 0 && delegationMatches.length > 0) {
    return teamWarning + createCombinedOutput(skillMatches, delegationMatches, prompt);
  } else if (delegationMatches.length > 0) {
    const delegationParts = delegationMatches.map(d => createMcpDelegation(d.name, prompt));
    return delegationParts.join('\n\n---\n\n');
  } else {
    return teamWarning + createMultiSkillInvocation(skillMatches, prompt);
  }
}

// ===== 기존 워크플로우 컨텍스트 주입 =====

/**
 * 미해결 체크포인트나 실패 단계에 대한 경고를 생성합니다.
 */
function buildStepWarnings(instance: WorkflowStateData): string[] {
  const warnings: string[] = [];

  if (!instance.steps) return warnings;

  for (const step of instance.steps) {
    if (step.status === 'waiting_checkpoint') {
      warnings.push(`[WARN] 체크포인트 대기 중: 단계 ${step.order} (${step.agent}) — ${step.checkpoint ?? '?'}`);
    }
    if (step.status === 'failed') {
      warnings.push(`[WARN] 실패 단계: 단계 ${step.order} (${step.agent}) — ${step.action}`);
    }
  }

  return warnings;
}

/**
 * 활성 워크플로우 컨텍스트 문자열을 생성합니다.
 */
function buildWorkflowContext(instance: WorkflowStateData, cwd: string): string {
  const contextLines: string[] = [];

  // 워크플로우 상태 요약
  contextLines.push(`[harness-workflow] ${instance.workflowType ?? '?'} (${instance.id ?? '?'})`);
  contextLines.push(`진행: ${instance.currentStep ?? '?'}/${instance.totalSteps ?? '?'} | 상태: ${instance.status}`);

  // 현재 단계 정보
  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps?.[currentStepIndex];
  if (currentStep) {
    contextLines.push(`현재: ${currentStep.agent ?? '?'} — ${currentStep.action ?? '?'}`);

    if (instance.status === 'waiting_checkpoint') {
      contextLines.push(`[ACTION] 체크포인트 승인 대기: ${currentStep.checkpoint ?? '?'} -> harness_workflow({ action: "approve" })`);
    } else if (instance.status === 'failed_step') {
      contextLines.push(`[ACTION] 단계 실패 -> harness_workflow({ action: "retry" }) 또는 harness_workflow({ action: "skip" })`);
    } else {
      const nextStepIndex = currentStepIndex + 1;
      if (instance.steps && nextStepIndex < instance.steps.length) {
        const nextStep = instance.steps[nextStepIndex];
        const skillHint = nextStep.omcSkill ? ` (${nextStep.omcSkill})` : '';
        contextLines.push(`다음: ${nextStep.agent ?? '?'} — ${nextStep.action ?? '?'}${skillHint}`);
      }
      contextLines.push(`단계 완료 시: harness_workflow({ action: "advance" })`);
    }
  }

  // 미해결 체크포인트/실패 단계 경고
  const warnings = buildStepWarnings(instance);
  if (warnings.length > 0) {
    contextLines.push(...warnings);
  }

  // OMC 활성 모드 감지
  const omcMode = detectOmcMode(cwd);
  if (omcMode) {
    contextLines.push(`OMC 모드: ${omcMode}`);
  }

  return contextLines.join('\n');
}

// ===== 메인 =====

function main(): void {
  let input: PromptEnricherInput | null;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = parseHookInput<PromptEnricherInput>(raw);
  } catch {
    outputResult('continue');
    return;
  }

  if (!input) {
    outputResult('continue');
    return;
  }

  const cwd = input.cwd || process.cwd();
  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  const sessionId = String(input.sessionId || input.session_id || input.sessionid || '');

  try {
    // 1단계: 매직 키워드 감지 — 감지되면 그것만 출력
    if (prompt) {
      const keywordContext = detectKeywords(prompt, cwd, sessionId);
      if (keywordContext !== null) {
        outputResult('continue', keywordContext);
        return;
      }
    }
  } catch {
    // 키워드 감지 실패 시 워크플로우 컨텍스트 주입으로 폴백
  }

  // 2단계: 활성 워크플로우 컨텍스트 주입
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (!instance || !instance.status || instance.status === 'completed' || instance.status === 'aborted') {
    outputResult('continue');
    return;
  }

  const workflowContext = buildWorkflowContext(instance, cwd);
  outputResult('continue', workflowContext);
}

main();
