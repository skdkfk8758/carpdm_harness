import type { RedFlagPattern, RedFlagMatch, RedFlagDetectionResult } from '../types/behavioral-guard.js';

// === 적신호 패턴 정의 ===

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

// === 완료 의도 패턴 ===

const COMPLETION_INTENT_PATTERNS: RegExp[] = [
  // 영어
  /(?:let'?s?\s+)?(?:commit|push)\s/i,
  /create\s+(?:a\s+)?(?:PR|pull\s+request)/i,
  /(?:it(?:'s|\s+is)\s+)?done/i,
  /ready\s+(?:to\s+)?(?:merge|ship|deploy|commit)/i,
  /(?:mark|set)\s+(?:as\s+)?(?:complete|done|finished)/i,
  // 한국어
  /커밋\s*(?:해|하자|할게|합시다)/i,
  /PR\s*(?:생성|만들|올려)/i,
  /완료(?:했|됐|입니다|하겠)/i,
  /머지\s*(?:해|하자|할게)/i,
  /작업\s*(?:끝|마무리|종료)/i,
  /배포\s*(?:해|하자|할게|준비)/i,
];

// === 공개 API ===

/**
 * 텍스트에서 적신호 패턴을 감지합니다.
 */
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

/**
 * 완료 의도가 포함된 텍스트인지 감지합니다.
 */
export function detectCompletionIntent(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  return COMPLETION_INTENT_PATTERNS.some(p => p.test(text));
}

/**
 * 적신호 감지 결과를 사람/에이전트가 읽을 수 있는 컨텍스트로 변환합니다.
 */
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

/**
 * 완료 전 검증 체크리스트를 생성합니다.
 */
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
