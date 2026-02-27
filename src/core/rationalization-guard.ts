import type {
  WorkflowPhase,
  RationalizationTable,
} from '../types/behavioral-guard.js';
import type { WorkflowStateData } from '../hooks/hook-utils.js';

// === 합리화 테이블 (Phase별 상수) ===

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

// === Agent → Phase 매핑 ===

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

// === 공개 API ===

/**
 * 워크플로우 인스턴스에서 현재 단계(phase)를 추론합니다.
 */
export function resolveWorkflowPhase(instance: WorkflowStateData): WorkflowPhase {
  if (!instance || !instance.steps) return 'unknown';

  const currentStepIndex = (instance.currentStep ?? 1) - 1;
  const currentStep = instance.steps[currentStepIndex];
  if (!currentStep || !currentStep.agent) return 'unknown';

  const agent = currentStep.agent.toLowerCase();

  // 정확한 매칭
  if (AGENT_PHASE_MAP[agent]) return AGENT_PHASE_MAP[agent];

  // 부분 매칭
  for (const [key, phase] of Object.entries(AGENT_PHASE_MAP)) {
    if (agent.includes(key)) return phase;
  }

  return 'unknown';
}

/**
 * Phase에 맞는 합리화 방지 컨텍스트를 생성합니다.
 * unknown phase이면 null을 반환합니다.
 */
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
