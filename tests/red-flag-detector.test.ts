import { describe, it, expect } from 'vitest';
import {
  detectRedFlags,
  detectCompletionIntent,
  buildRedFlagContext,
  buildCompletionChecklist,
} from '../src/core/red-flag-detector.js';

describe('detectRedFlags', () => {
  describe('hedging 패턴', () => {
    it('should detect "should work"', () => {
      const result = detectRedFlags('This should work now');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('hedging');
    });

    it('should detect "probably fixed"', () => {
      const result = detectRedFlags('The bug is probably fixed');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('hedging');
    });

    it('should detect "I think it works"', () => {
      const result = detectRedFlags('I think it works correctly');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('hedging');
    });

    it('should detect Korean hedging "것 같다"', () => {
      const result = detectRedFlags('수정된 것 같습니다');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('hedging');
    });

    it('should detect Korean hedging "아마 될"', () => {
      const result = detectRedFlags('아마 될 것입니다');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('hedging');
    });
  });

  describe('unverified_claim 패턴', () => {
    it('should detect "I verified it\'s correct"', () => {
      const result = detectRedFlags("I verified it's correct");
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('unverified_claim');
    });

    it('should detect "확인했습니다"', () => {
      const result = detectRedFlags('모두 확인했습니다');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('unverified_claim');
    });

    it('should detect "looks good to me"', () => {
      const result = detectRedFlags('This looks good to me');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('unverified_claim');
    });
  });

  describe('assumption 패턴', () => {
    it('should detect "didn\'t change so it\'s fine"', () => {
      const result = detectRedFlags("I didn't change so it's fine");
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('assumption');
    });

    it('should detect "no side effects"', () => {
      const result = detectRedFlags('There are no side effects');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('assumption');
    });

    it('should detect Korean "안 바뀌었으니 괜찮"', () => {
      const result = detectRedFlags('그 파일은 안 바뀌었으니 괜찮습니다');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('assumption');
    });
  });

  describe('skipping 패턴', () => {
    it('should detect "too simple to test"', () => {
      const result = detectRedFlags('This is too simple to test');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('skipping');
    });

    it('should detect "add tests later"', () => {
      const result = detectRedFlags("I'll add tests later");
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('skipping');
    });

    it('should detect Korean "나중에 테스트"', () => {
      const result = detectRedFlags('나중에 테스트 추가할게요');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches[0].category).toBe('skipping');
    });
  });

  describe('false positive 방지', () => {
    it('should not flag normal technical text', () => {
      const result = detectRedFlags('Implemented the login function with bcrypt hashing');
      expect(result.hasRedFlags).toBe(false);
    });

    it('should not flag empty text', () => {
      const result = detectRedFlags('');
      expect(result.hasRedFlags).toBe(false);
    });

    it('should not flag code-like content', () => {
      const result = detectRedFlags('const result = await fetchData()');
      expect(result.hasRedFlags).toBe(false);
    });

    it('should handle null-like inputs gracefully', () => {
      const result = detectRedFlags('   ');
      expect(result.hasRedFlags).toBe(false);
    });
  });

  describe('복합 감지', () => {
    it('should detect multiple categories in one text', () => {
      const result = detectRedFlags('This should work, I think. Add tests later.');
      expect(result.hasRedFlags).toBe(true);
      expect(result.matches.length).toBeGreaterThanOrEqual(2);
      const categories = result.matches.map(m => m.category);
      expect(categories).toContain('hedging');
      expect(categories).toContain('skipping');
    });
  });
});

describe('detectCompletionIntent', () => {
  it('should detect English commit intent', () => {
    expect(detectCompletionIntent('Let me commit this')).toBe(true);
  });

  it('should detect English PR creation intent', () => {
    expect(detectCompletionIntent('create a PR for this')).toBe(true);
  });

  it('should detect "it\'s done"', () => {
    expect(detectCompletionIntent("it's done")).toBe(true);
  });

  it('should detect "ready to merge"', () => {
    expect(detectCompletionIntent('ready to merge')).toBe(true);
  });

  it('should detect Korean commit intent', () => {
    expect(detectCompletionIntent('커밋해줘')).toBe(true);
  });

  it('should detect Korean PR creation', () => {
    expect(detectCompletionIntent('PR 생성해주세요')).toBe(true);
  });

  it('should detect Korean completion', () => {
    expect(detectCompletionIntent('작업 완료했습니다')).toBe(true);
  });

  it('should not flag normal prompts', () => {
    expect(detectCompletionIntent('로그인 기능을 추가해줘')).toBe(false);
  });

  it('should handle empty input', () => {
    expect(detectCompletionIntent('')).toBe(false);
  });
});

describe('buildRedFlagContext', () => {
  it('should return empty string for no flags', () => {
    const result = buildRedFlagContext({ hasRedFlags: false, matches: [] });
    expect(result).toBe('');
  });

  it('should format detected flags with categories', () => {
    const result = buildRedFlagContext({
      hasRedFlags: true,
      matches: [
        { category: 'hedging', matched: 'should work', description: 'test desc' },
      ],
    });
    expect(result).toContain('[behavioral-guard]');
    expect(result).toContain('적신호 감지');
    expect(result).toContain('불확실한 표현');
    expect(result).toContain('should work');
  });

  it('should group by category', () => {
    const result = buildRedFlagContext({
      hasRedFlags: true,
      matches: [
        { category: 'hedging', matched: 'should work', description: 'desc1' },
        { category: 'skipping', matched: 'add tests later', description: 'desc2' },
      ],
    });
    expect(result).toContain('불확실한 표현');
    expect(result).toContain('단계 건너뛰기');
  });
});

describe('buildCompletionChecklist', () => {
  it('should return checklist with behavioral-guard tag', () => {
    const checklist = buildCompletionChecklist();
    expect(checklist).toContain('[behavioral-guard]');
    expect(checklist).toContain('완료 전 체크리스트');
    expect(checklist).toContain('테스트');
  });
});
