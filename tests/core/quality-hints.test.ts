import { describe, it, expect } from 'vitest';
import { buildBar, IMPROVEMENT_HINTS, buildImprovementHints } from '../../src/core/quality-hints.js';
import type { TrustCriterion, ValidatorResult } from '../../src/types/quality-gate.js';

function makeResult(score: number, checks: Array<{ name: string; passed: boolean }> = []): ValidatorResult {
  return {
    score,
    passed: score >= 60,
    checks: checks.map(c => ({
      name: c.name,
      passed: c.passed,
      message: c.passed ? 'ok' : 'fail',
      severity: c.passed ? ('info' as const) : ('error' as const),
    })),
  };
}

function makeAllResults(overrides: Partial<Record<TrustCriterion, ValidatorResult>> = {}): Record<TrustCriterion, ValidatorResult> {
  return {
    tested: makeResult(80),
    readable: makeResult(80),
    unified: makeResult(80),
    secured: makeResult(80),
    trackable: makeResult(80),
    ...overrides,
  };
}

describe('quality-hints', () => {
  describe('buildBar', () => {
    it('0점 → 빈칸 10개', () => {
      expect(buildBar(0)).toBe('░░░░░░░░░░');
    });

    it('50점 → 채움 5개 + 빈칸 5개', () => {
      expect(buildBar(50)).toBe('█████░░░░░');
    });

    it('100점 → 채움 10개', () => {
      expect(buildBar(100)).toBe('██████████');
    });

    it('75점 → 반올림하여 채움 8개', () => {
      expect(buildBar(75)).toBe('████████░░');
    });
  });

  describe('IMPROVEMENT_HINTS', () => {
    it('5개 TRUST 기준 모두 존재하며 비어있지 않다', () => {
      const criteria: TrustCriterion[] = ['tested', 'readable', 'unified', 'secured', 'trackable'];
      for (const c of criteria) {
        expect(IMPROVEMENT_HINTS).toHaveProperty(c);
        expect(Object.keys(IMPROVEMENT_HINTS[c]).length).toBeGreaterThan(0);
      }
    });
  });

  describe('buildImprovementHints', () => {
    it('60점 이상 기준은 힌트를 생성하지 않는다', () => {
      const results = makeAllResults();
      expect(buildImprovementHints(results)).toEqual([]);
    });

    it('60점 미만 + 실패 check가 있으면 힌트를 생성한다', () => {
      const results = makeAllResults({
        tested: makeResult(30, [
          { name: '테스트 파일 존재', passed: false },
        ]),
      });

      const hints = buildImprovementHints(results);
      expect(hints.length).toBe(1);
      expect(hints[0]).toContain('tested');
      expect(hints[0]).toContain('30점');
    });

    it('60점 미만이어도 실패 check가 IMPROVEMENT_HINTS에 없으면 힌트 없음', () => {
      const results = makeAllResults({
        tested: makeResult(20, [
          { name: '존재하지않는검사명', passed: false },
        ]),
      });

      expect(buildImprovementHints(results)).toEqual([]);
    });

    it('null result를 안전하게 건너뛴다', () => {
      const results = makeAllResults();
      (results as Record<string, unknown>).tested = null;

      expect(() => buildImprovementHints(results as Record<TrustCriterion, ValidatorResult>)).not.toThrow();
    });

    it('여러 기준이 60점 미만이면 각각 힌트를 생성한다', () => {
      const results = makeAllResults({
        tested: makeResult(30, [{ name: '테스트 파일 존재', passed: false }]),
        secured: makeResult(40, [{ name: '시크릿 스캔', passed: false }]),
      });

      const hints = buildImprovementHints(results);
      expect(hints.length).toBe(2);
      expect(hints[0]).toContain('tested');
      expect(hints[1]).toContain('secured');
    });
  });
});
