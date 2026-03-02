import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import {
  parseHookInput,
  outputResult,
  loadActiveWorkflowFromFiles,
  detectOmcMode,
  detectRufloSwarm,
} from './hook-utils.js';
import type { WorkflowStateData } from './hook-utils.js';
import {
  resolveWorkflowPhase,
  buildRationalizationContext,
  detectRedFlags,
  detectCompletionIntent,
  buildRedFlagContext,
  buildCompletionChecklist,
  checkImplementationReadiness,
} from '../core/behavioral-validator.js';
import { DEFAULT_BEHAVIORAL_GUARD_CONFIG } from '../types/behavioral-guard.js';
import type { BehavioralGuardConfig } from '../types/behavioral-guard.js';
import { knowledgeBranchDir } from '../core/omc-compat.js';

interface PromptEnricherInput {
  cwd?: string;
  prompt?: string;
  sessionId?: string;
  session_id?: string;
  sessionid?: string;
  [key: string]: unknown;
}

// ===== 파일 기반 캐시 유틸 =====

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function readCache<T>(cachePath: string, ttlMs: number): T | null {
  try {
    if (!existsSync(cachePath)) return null;
    const raw = readFileSync(cachePath, 'utf-8');
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.timestamp > ttlMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(cachePath: string, data: T): void {
  try {
    const dir = join(cachePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    writeFileSync(cachePath, JSON.stringify(entry), 'utf-8');
  } catch {
    // 캐시 쓰기 실패는 무시
  }
}

// ===== Knowledge Vault 컨텍스트 =====

/**
 * 현재 브랜치의 Knowledge Vault 문서에서 컨텍스트를 추출합니다.
 * .knowledge/branches/{branch}/ 내 design.md, decisions.md, spec.md에서 핵심 내용을 읽습니다.
 */
function readKnowledgeContext(cwd: string, branch: string | null): string | null {
  if (!branch) return null;
  const branchDir = knowledgeBranchDir(cwd, branch);
  if (!existsSync(branchDir)) return null;

  const lines: string[] = [`[Knowledge Context]`, `Branch: ${branch}`];
  const MAX_LINES_PER_FILE = 15;
  const targetFiles = ['design.md', 'decisions.md', 'spec.md'];

  for (const filename of targetFiles) {
    const filePath = join(branchDir, filename);
    if (!existsSync(filePath)) continue;

    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    // 프론트매터 제거 후 비어있지 않은 본문만 추출
    let body = content;
    if (body.startsWith('---')) {
      const endIdx = body.indexOf('---', 3);
      if (endIdx !== -1) body = body.substring(endIdx + 3);
    }
    body = body.trim();
    if (!body || body.split('\n').length <= 2) continue;

    const truncated = body.split('\n').slice(0, MAX_LINES_PER_FILE).join('\n');
    lines.push('', `--- ${filename} ---`, truncated);
  }

  // 유의미한 컨텐츠가 없으면 null
  if (lines.length <= 2) return null;

  return lines.join('\n');
}

/**
 * 현재 git 브랜치를 반환합니다.
 * 파일 기반 캐시(30초 TTL)로 execSync 호출을 최소화합니다.
 */
function getCurrentBranch(cwd: string): string | null {
  const cachePath = join(cwd, '.harness', 'cache', 'branch-cache.json');
  const cached = readCache<string>(cachePath, 30_000);
  if (cached !== null) return cached;

  try {
    const branch = execSync('git branch --show-current', { cwd, stdio: 'pipe' }).toString().trim() || null;
    if (branch) writeCache(cachePath, branch);
    return branch;
  } catch {
    return null;
  }
}

// ===== 워크플로우 컨텍스트 주입 =====

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

  // ruflo 활성 상태 감지
  const rufloSwarm = detectRufloSwarm(cwd);
  if (rufloSwarm) {
    contextLines.push(`ruflo: ${rufloSwarm}`);
  }

  return contextLines.join('\n');
}

// ===== 행동 가드 헬퍼 =====

function loadBehavioralGuardConfig(cwd: string): BehavioralGuardConfig {
  try {
    const configPath = join(cwd, 'carpdm-harness.config.json');
    if (!existsSync(configPath)) return { ...DEFAULT_BEHAVIORAL_GUARD_CONFIG };
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const guard = config.behavioralGuard as Partial<BehavioralGuardConfig> | undefined;
    if (!guard) return { ...DEFAULT_BEHAVIORAL_GUARD_CONFIG };
    return {
      rationalization: guard.rationalization || DEFAULT_BEHAVIORAL_GUARD_CONFIG.rationalization,
      redFlagDetection: guard.redFlagDetection || DEFAULT_BEHAVIORAL_GUARD_CONFIG.redFlagDetection,
    };
  } catch {
    return { ...DEFAULT_BEHAVIORAL_GUARD_CONFIG };
  }
}

function buildStandaloneRedFlagContext(prompt: string): string | null {
  const isCompletion = detectCompletionIntent(prompt);
  if (!isCompletion) return null;

  const redFlagResult = detectRedFlags(prompt);
  if (redFlagResult.hasRedFlags) {
    return buildRedFlagContext(redFlagResult);
  }
  return buildCompletionChecklist();
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

  // behavioralGuard 설정 로드
  const guardConfig = loadBehavioralGuardConfig(cwd);

  // 1단계: Knowledge Vault 브랜치 컨텍스트 (워크플로우 유무와 무관하게 수집)
  let knowledgeContext: string | null = null;
  try {
    const branch = getCurrentBranch(cwd);
    knowledgeContext = readKnowledgeContext(cwd, branch);
  } catch {
    // Knowledge Context 실패 시 무시
  }

  // 2단계: 활성 워크플로우 컨텍스트 주입 + 합리화 방지 + 적신호 탐지
  const { instance } = loadActiveWorkflowFromFiles(cwd);
  if (!instance || !instance.status || instance.status === 'completed' || instance.status === 'aborted') {
    // 워크플로우 없어도 Knowledge Context + 구현 준비 검증 + 적신호 감지 시 주입
    const parts: string[] = [];
    if (knowledgeContext) parts.push(knowledgeContext);

    // 구현 준비 상태 검증 — plan/todo 없이 구현 시도 감지
    if (prompt) {
      const readiness = checkImplementationReadiness(prompt, cwd);
      if (readiness.status === 'force-plan-gate') {
        parts.push('[WORKFLOW GUARD: PLAN REQUIRED]\n\nplan.md가 없습니다. /plan-gate 스킬을 먼저 실행하세요.');
      } else if (readiness.status !== 'pass' && readiness.message) {
        parts.push(readiness.message);
      }
    }

    if (prompt && guardConfig.redFlagDetection === 'on') {
      const extraContext = buildStandaloneRedFlagContext(prompt);
      if (extraContext) parts.push(extraContext);
    }
    outputResult('continue', parts.length > 0 ? parts.join('\n\n') : undefined);
    return;
  }

  const contextParts: string[] = [];

  // Knowledge Vault 브랜치 컨텍스트
  if (knowledgeContext) {
    contextParts.push(knowledgeContext);
  }

  // 기존 워크플로우 컨텍스트
  contextParts.push(buildWorkflowContext(instance, cwd));

  // 합리화 방지 컨텍스트 (phase 기반)
  if (guardConfig.rationalization === 'on') {
    const phase = resolveWorkflowPhase(instance);
    const rationalizationCtx = buildRationalizationContext(phase);
    if (rationalizationCtx) {
      contextParts.push(rationalizationCtx);
    }
  }

  // 적신호 탐지 (완료 의도 감지 시)
  if (prompt && guardConfig.redFlagDetection === 'on') {
    const isCompletion = detectCompletionIntent(prompt);
    if (isCompletion) {
      const redFlagResult = detectRedFlags(prompt);
      if (redFlagResult.hasRedFlags) {
        contextParts.push(buildRedFlagContext(redFlagResult));
      } else {
        contextParts.push(buildCompletionChecklist());
      }
    }
  }

  outputResult('continue', contextParts.join('\n\n'));
}

main();
