/**
 * Behavioral Validator — 행동 가드 통합 모듈
 *
 * 3가지 행동 검증을 단일 모듈로 통합:
 * 1. 합리화 방지 (rationalization guard) — 워크플로우 단계별 합리화 패턴 탐지
 * 2. 적신호 탐지 (red-flag detection) — 불확실/미검증 표현 감지
 * 3. 구현 준비 검증 (implementation readiness) — plan/todo 상태 확인
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  WorkflowPhase,
  RationalizationTable,
  RedFlagPattern,
  RedFlagMatch,
  RedFlagDetectionResult,
} from '../types/behavioral-guard.js';
import type { WorkflowStateData } from '../hooks/hook-utils.js';
import { planSearchPaths, todoSearchPaths } from './project-paths.js';

// ─── 1. 합리화 방지 (Rationalization Guard) ─────────────────────

const RATIONALIZATION_TABLE: RationalizationTable = {
  planning: [
    { rationalization: '요구사항이 명확하니 계획 건너뛰자', rebuttal: '명확해 보여도 암묵적 가정이 숨어 있다 — 계획은 가정을 드러낸다' },
    { rationalization: '비슷한 작업 해봤으니 바로 시작하자', rebuttal: '과거 경험이 현재 컨텍스트와 다를 수 있다 — 차이점을 먼저 확인하라' },
    { rationalization: '시간이 없으니 설계 없이 코딩하자', rebuttal: '설계 없는 코딩은 되돌아오는 시간이 더 길다' },
    { rationalization: '작은 변경이라 계획 불필요', rebuttal: '작은 변경도 파급 효과가 클 수 있다 — 영향 범위를 먼저 파악하라' },
    { rationalization: '일단 만들고 나중에 고치자', rebuttal: '"나중"은 오지 않는다 — 처음부터 올바르게 만들어라' },
  ],
  implementing: [
    { rationalization: '나중에 테스트 추가하겠음', rebuttal: '사후 테스트는 실패 증거를 남기지 못한다 — Red-Green-Refactor를 따르라' },
    { rationalization: '이 정도면 동작할 것이다', rebuttal: '"동작할 것이다"는 검증이 아니다 — 실행하여 증명하라' },
    { rationalization: '에러 처리는 나중에', rebuttal: '에러 처리 없는 코드는 프로덕션에서 실패한다' },
    { rationalization: '일단 하드코딩하고 나중에 리팩토링', rebuttal: '하드코딩은 기술 부채가 된다 — 최소한의 추상화를 지금 하라' },
    { rationalization: '타입 에러는 any로 우회하자', rebuttal: 'any는 타입 시스템을 무력화한다 — 정확한 타입을 사용하라' },
  ],
  testing: [
    { rationalization: '이미 수동으로 확인함', rebuttal: '수동 테스트는 반복 불가능하고 불완전하다 — 자동화된 테스트를 작성하라' },
    { rationalization: '너무 단순해서 테스트 불필요', rebuttal: '단순한 코드도 회귀한다 — 테스트는 미래의 변경을 보호한다' },
    { rationalization: 'happy path만 테스트하면 됨', rebuttal: '버그는 edge case에서 발생한다 — 경계 조건을 테스트하라' },
    { rationalization: '다른 테스트가 커버하고 있음', rebuttal: '간접 커버리지는 신뢰할 수 없다 — 직접 테스트를 작성하라' },
    { rationalization: '테스트가 깨지면 나중에 고치겠음', rebuttal: '깨진 테스트는 즉시 수정하라 — 방치하면 신호를 잃는다' },
  ],
  completing: [
    { rationalization: '확인했습니다 (실행 결과 없이)', rebuttal: '"확인했습니다"는 증거가 아니다 — 실행 로그를 첨부하라' },
    { rationalization: '큰 문제 없어 보인다', rebuttal: '"없어 보인다"는 검증이 아니다 — 구체적 확인 결과를 제시하라' },
    { rationalization: '시간이 부족하니 이대로 커밋', rebuttal: '미완성 커밋은 다음 사람의 시간을 빼앗는다' },
    { rationalization: '사소한 변경이니 리뷰 불필요', rebuttal: '사소한 변경에서 중대한 버그가 발생한다 — 항상 검증하라' },
    { rationalization: '이전 버전과 같은 방식이니 괜찮다', rebuttal: '이전 방식이 올바른지 먼저 확인하라 — 관성은 근거가 아니다' },
  ],
};

const AGENT_PHASE_MAP: Record<string, WorkflowPhase> = {
  planner: 'planning',
  architect: 'planning',
  analyst: 'planning',
  executor: 'implementing',
  implementer: 'implementing',
  developer: 'implementing',
  'test-engineer': 'testing',
  tester: 'testing',
  qa: 'testing',
  verifier: 'completing',
  reviewer: 'completing',
  shipper: 'completing',
};

export function resolveWorkflowPhase(instance: WorkflowStateData): WorkflowPhase {
  if (!instance || !instance.steps) return 'unknown';

  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps[currentStepIndex];
  if (!currentStep || !currentStep.agent) return 'unknown';

  const agent = currentStep.agent.toLowerCase();

  if (AGENT_PHASE_MAP[agent]) return AGENT_PHASE_MAP[agent];

  for (const [key, phase] of Object.entries(AGENT_PHASE_MAP)) {
    if (agent.includes(key)) return phase;
  }

  return 'unknown';
}

export function buildRationalizationContext(phase: WorkflowPhase, maxItems = 5): string | null {
  if (phase === 'unknown') return null;

  const entries = RATIONALIZATION_TABLE[phase];
  if (!entries || entries.length === 0) return null;

  const selected = entries.slice(0, maxItems);

  const phaseLabels: Record<string, string> = {
    planning: '계획',
    implementing: '구현',
    testing: '테스트',
    completing: '완료',
  };

  const lines: string[] = [
    `[behavioral-guard] 합리화 방지 (${phaseLabels[phase]} 단계)`,
    '| 합리화 | 반박 |',
    '|--------|------|',
  ];

  for (const entry of selected) {
    lines.push(`| ${entry.rationalization} | ${entry.rebuttal} |`);
  }

  return lines.join('\n');
}

// ─── 2. 적신호 탐지 (Red-Flag Detection) ────────────────────────

const RED_FLAG_PATTERNS: RedFlagPattern[] = [
  // hedging — 불확실한 표현
  { category: 'hedging', pattern: /should\s+work/i, description: '"should work" — 테스트로 확인하세요' },
  { category: 'hedging', pattern: /probably\s+(?:fixed|works|correct|fine)/i, description: '"probably" — 확실한 검증이 필요합니다' },
  { category: 'hedging', pattern: /I\s+think\s+(?:it|this|that)\s+(?:works|is\s+(?:correct|fine|ok))/i, description: '"I think it works" — 실행 결과로 증명하세요' },
  { category: 'hedging', pattern: /것\s*같(?:다|습니다|아요)/i, description: '"~것 같다" — 추측이 아닌 검증 결과를 제시하세요' },
  { category: 'hedging', pattern: /아마\s+(?:될|맞|괜찮)/i, description: '"아마" — 확실한 근거를 제시하세요' },

  // unverified_claim — 증거 없는 주장
  { category: 'unverified_claim', pattern: /I\s+(?:believe|verified|confirmed)\s+(?:it(?:'s|\s+is)\s+correct)/i, description: '증거 없는 "확인" 주장 — 실행 로그를 첨부하세요' },
  { category: 'unverified_claim', pattern: /확인했습니다/i, description: '"확인했습니다" — 실행 결과/로그를 함께 제시하세요' },
  { category: 'unverified_claim', pattern: /(?:looks|seems)\s+(?:good|correct|fine)\s+to\s+me/i, description: '"looks good to me" — 구체적 검증 결과가 필요합니다' },
  { category: 'unverified_claim', pattern: /문제\s*(?:없|없을\s*것)/i, description: '"문제없다" — 어떻게 확인했는지 설명하세요' },

  // assumption — 검증 없는 가정
  { category: 'assumption', pattern: /didn'?t\s+change\s+so\s+it(?:'s|\s+is)\s+fine/i, description: '"안 바꿨으니 괜찮다" — 회귀 테스트를 실행하세요' },
  { category: 'assumption', pattern: /안\s*바뀌었으?니\s*괜찮/i, description: '"안 바뀌었으니 괜찮다" — 관련 테스트를 실행하세요' },
  { category: 'assumption', pattern: /(?:no|shouldn'?t\s+(?:be|have))\s+(?:side\s+effects?|impact)/i, description: '부작용 없다고 가정 — 영향 범위를 확인하세요' },
  { category: 'assumption', pattern: /영향\s*(?:없|없을)/i, description: '"영향 없다" — 참조하는 코드를 확인하세요' },

  // skipping — 단계 건너뛰기
  { category: 'skipping', pattern: /too\s+simple\s+to\s+test/i, description: '"너무 단순해서 테스트 불필요" — 단순한 코드도 회귀할 수 있습니다' },
  { category: 'skipping', pattern: /(?:add|write)\s+tests?\s+later/i, description: '"나중에 테스트 추가" — 지금 작성하세요' },
  { category: 'skipping', pattern: /나중에\s*(?:테스트|검증|확인)/i, description: '"나중에 테스트/검증" — 지금 수행하세요' },
  { category: 'skipping', pattern: /(?:skip|don'?t\s+need)\s+(?:testing|tests|verification)/i, description: '"테스트 불필요" — 모든 변경은 검증이 필요합니다' },
];

const COMPLETION_INTENT_PATTERNS: RegExp[] = [
  /(?:let'?s?\s+)?(?:commit|push)\s/i,
  /create\s+(?:a\s+)?(?:PR|pull\s+request)/i,
  /(?:it(?:'s|\s+is)\s+)?done/i,
  /ready\s+(?:to\s+)?(?:merge|ship|deploy|commit)/i,
  /(?:mark|set)\s+(?:as\s+)?(?:complete|done|finished)/i,
  /커밋\s*(?:해|하자|할게|합시다)/i,
  /PR\s*(?:생성|만들|올려)/i,
  /완료(?:했|됐|입니다|하겠)/i,
  /머지\s*(?:해|하자|할게)/i,
  /작업\s*(?:끝|마무리|종료)/i,
  /배포\s*(?:해|하자|할게|준비)/i,
];

export function detectRedFlags(text: string): RedFlagDetectionResult {
  if (!text || text.trim().length === 0) {
    return { hasRedFlags: false, matches: [] };
  }

  const matches: RedFlagMatch[] = [];
  const seen = new Set<string>();

  for (const { category, pattern, description } of RED_FLAG_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const key = `${category}:${description}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({ category, matched: match[0], description });
      }
    }
  }

  return { hasRedFlags: matches.length > 0, matches };
}

export function detectCompletionIntent(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  return COMPLETION_INTENT_PATTERNS.some(p => p.test(text));
}

export function buildRedFlagContext(result: RedFlagDetectionResult): string {
  if (!result.hasRedFlags || result.matches.length === 0) return '';

  const lines: string[] = [
    `[behavioral-guard] 적신호 감지 (${result.matches.length}건)`,
  ];

  const byCategory = new Map<string, RedFlagMatch[]>();
  for (const m of result.matches) {
    const arr = byCategory.get(m.category) || [];
    arr.push(m);
    byCategory.set(m.category, arr);
  }

  const categoryLabels: Record<string, string> = {
    hedging: '불확실한 표현',
    unverified_claim: '증거 없는 주장',
    assumption: '검증 없는 가정',
    skipping: '단계 건너뛰기',
  };

  for (const [cat, items] of byCategory) {
    lines.push(`- ${categoryLabels[cat] || cat}:`);
    for (const item of items) {
      lines.push(`  - "${item.matched}" → ${item.description}`);
    }
  }

  lines.push('');
  lines.push('권장 행동: 위 항목들을 실행 결과/테스트/로그로 뒷받침하세요.');

  return lines.join('\n');
}

export function buildCompletionChecklist(): string {
  return [
    '[behavioral-guard] 완료 전 체크리스트',
    '- [ ] 모든 변경에 대한 테스트가 실행되었는가?',
    '- [ ] 테스트 결과(pass/fail)를 확인했는가?',
    '- [ ] 타입체크(tsc --noEmit)가 통과하는가?',
    '- [ ] "것 같다", "아마" 같은 추측 없이 증거 기반으로 작업했는가?',
    '- [ ] 변경 범위 밖의 회귀가 없는지 확인했는가?',
  ].join('\n');
}

// ─── 3. 구현 준비 검증 (Implementation Readiness) ───────────────

export const IMPLEMENTATION_INTENT_PATTERNS: RegExp[] = [
  /\bimplement\s+(the\s+)?(following\s+)?plan\b/i,
  /\bexecute\s+(the\s+)?(this\s+)?(following\s+)?plan\b/i,
  /(?:이|다음|위)\s*(?:계획|플랜).*(?:구현|실행|진행)/i,
  /(?:계획|플랜)\s*(?:을|를)?\s*(?:구현|실행|진행)/i,
  /plan\s*(?:을|를)?\s*(?:실행|구현|진행)/i,
  /(?:플랜|계획)\s*대로/i,
];

export type PlanStatus = 'NONE' | 'DRAFT' | 'APPROVED' | 'COMPLETED' | 'EXISTS';

export interface TodoStatus {
  exists: boolean;
  allDone: boolean;
  doneCount: number;
  totalCount: number;
}

export interface ReadinessCheckResult {
  status: 'pass' | 'force-plan-gate' | 'plan-not-approved' | 'todo-required' | 'todo-stale';
  message?: string;
}

export function getPlanStatus(cwd: string): PlanStatus {
  const paths = planSearchPaths(cwd);
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, 'utf-8');
      if (/\bAPPROVED\b/.test(content)) return 'APPROVED';
      if (/\bDRAFT\b/.test(content)) return 'DRAFT';
      if (/\bCOMPLETED\b/.test(content)) return 'COMPLETED';
      return 'EXISTS';
    } catch { continue; }
  }
  return 'NONE';
}

export function getTodoStatus(cwd: string): TodoStatus {
  const paths = todoSearchPaths(cwd);
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, 'utf-8');
      const done = (content.match(/\[x\]/gi) || []).length;
      const remaining = (content.match(/\[ \]/g) || []).length;
      const total = done + remaining;
      return { exists: true, allDone: total > 0 && remaining === 0, doneCount: done, totalCount: total };
    } catch { continue; }
  }
  return { exists: false, allDone: false, doneCount: 0, totalCount: 0 };
}

export function hasImplementationIntent(cleanPrompt: string): boolean {
  return IMPLEMENTATION_INTENT_PATTERNS.some(p => p.test(cleanPrompt));
}

export function checkImplementationReadiness(cleanPrompt: string, cwd: string): ReadinessCheckResult {
  if (!existsSync(join(cwd, 'carpdm-harness.config.json'))) return { status: 'pass' };

  if (!hasImplementationIntent(cleanPrompt)) return { status: 'pass' };

  const planStatus = getPlanStatus(cwd);
  const todoStatus = getTodoStatus(cwd);

  if (planStatus === 'NONE' || planStatus === 'COMPLETED') {
    return { status: 'force-plan-gate' };
  }

  if (planStatus === 'DRAFT') {
    return {
      status: 'plan-not-approved',
      message: `[WORKFLOW GUARD: PLAN NOT APPROVED]

plan.md가 DRAFT 상태입니다. 구현을 시작하기 전에:
1. plan.md를 검토하고 승인(APPROVED)으로 변경하세요
2. 승인 후 todo.md를 작성하세요
3. 그 후 구현을 시작하세요`,
    };
  }

  if (!todoStatus.exists) {
    return {
      status: 'todo-required',
      message: `[WORKFLOW GUARD: TODO REQUIRED]

plan.md가 APPROVED 상태이지만 todo.md가 없습니다.
구현을 시작하기 전에:
1. plan.md의 구현 계획(Step)을 기반으로 .agent/todo.md를 작성하세요
2. 첫 번째 항목에 ← CURRENT 마커를 추가하세요
3. 그 후 Step 1부터 구현을 시작하세요`,
    };
  }

  if (todoStatus.allDone) {
    return {
      status: 'todo-stale',
      message: `[WORKFLOW GUARD: TODO STALE]

todo.md의 모든 항목이 완료되었습니다 (${todoStatus.doneCount}/${todoStatus.totalCount}).
새 구현 작업을 위해:
1. plan.md의 새 구현 계획을 기반으로 .agent/todo.md를 갱신하세요
2. 첫 번째 항목에 ← CURRENT 마커를 추가하세요
3. 그 후 Step 1부터 구현을 시작하세요`,
    };
  }

  return { status: 'pass' };
}
