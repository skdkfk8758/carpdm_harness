import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadTriggers,
  matchTriggers,
  resolveMessage,
} from '../src/core/skill-trigger-engine.js';
import type { TriggerManifest, MatchContext } from '../src/core/skill-trigger-engine.js';

describe('skill-trigger-engine', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'trigger-test-'));
    mkdirSync(join(testDir, '.harness'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const sampleManifest: TriggerManifest = {
    version: '1.0',
    keywordGroups: {
      bug: ['버그', 'bug', 'error', 'crash'],
      issue: ['#\\d+'],
      complex: ['크리티컬', 'critical', '아키텍처'],
      impl: ['구현', 'implement', 'fix', 'resolve'],
      task: ['(추가|구현).*(해\\s*줘|하자)'],
    },
    triggers: [
      {
        skill: 'plan-gate',
        rules: [
          { id: 'explicit-plan', mode: 'force', branch: 'any', patterns: ['계획\\s*수립', 'plan[\\s-]*gate'] },
          { id: 'critical-bug', mode: 'force', branch: 'any', allOf: ['bug', 'complex'] },
          { id: 'tracked-bug', mode: 'suggest', branch: 'any', allOf: ['bug', 'issue', 'impl'], message: '이슈({issue}) 버그 수정 — 인터뷰 권장' },
          { id: 'issue-impl', mode: 'suggest', branch: 'any', allOf: ['issue', 'impl'], noneOf: ['bug'], message: '이슈({issue}) 구현 — 인터뷰 권장' },
        ],
      },
      {
        skill: 'work-start',
        rules: [
          { id: 'explicit-start', mode: 'force', branch: 'main', condition: 'no-active-work', patterns: ['작업\\s*시작', 'work\\s*start'] },
          { id: 'task-suggest', mode: 'suggest', branch: 'main', condition: 'no-active-work', allOf: ['task'], message: '현재 {branch} 브랜치 — feature 브랜치 권장' },
        ],
      },
      {
        skill: 'work-finish',
        rules: [
          { id: 'explicit-finish', mode: 'force', branch: 'feature', patterns: ['작업\\s*완료', 'finish\\s*work'] },
        ],
      },
    ],
  };

  // ── loadTriggers ──

  describe('loadTriggers', () => {
    it('triggers.json이 없으면 빈 매니페스트를 반환한다', () => {
      const result = loadTriggers(testDir);
      expect(result.triggers).toHaveLength(0);
      expect(result.keywordGroups).toEqual({});
    });

    it('triggers.json을 정상 로드한다', () => {
      writeFileSync(join(testDir, '.harness', 'triggers.json'), JSON.stringify(sampleManifest));
      const result = loadTriggers(testDir);
      expect(result.triggers).toHaveLength(3);
      expect(result.keywordGroups.bug).toBeDefined();
    });

    it('custom-triggers.json을 병합한다', () => {
      writeFileSync(join(testDir, '.harness', 'triggers.json'), JSON.stringify(sampleManifest));
      const custom: TriggerManifest = {
        version: '1.0',
        keywordGroups: { deploy: ['배포', 'deploy'] },
        triggers: [{ skill: 'deploy', rules: [{ id: 'deploy', mode: 'force', branch: 'any', patterns: ['배포'] }] }],
      };
      writeFileSync(join(testDir, '.harness', 'custom-triggers.json'), JSON.stringify(custom));

      const result = loadTriggers(testDir);
      expect(result.triggers).toHaveLength(4);
      expect(result.keywordGroups.deploy).toEqual(['배포', 'deploy']);
    });

    it('잘못된 JSON 파일은 무시한다', () => {
      writeFileSync(join(testDir, '.harness', 'triggers.json'), 'invalid json');
      const result = loadTriggers(testDir);
      expect(result.triggers).toHaveLength(0);
    });
  });

  // ── matchTriggers ──

  describe('matchTriggers', () => {
    it('패턴 매칭 — 계획 수립 키워드를 감지한다', () => {
      const ctx: MatchContext = { prompt: '계획 수립해줘', branch: 'main', conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      expect(match!.skill).toBe('plan-gate');
      expect(match!.rule.id).toBe('explicit-plan');
      expect(match!.rule.mode).toBe('force');
    });

    it('패턴 매칭 — 영문 plan-gate를 감지한다', () => {
      const ctx: MatchContext = { prompt: 'please run plan gate', branch: null, conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      expect(match!.skill).toBe('plan-gate');
    });

    it('allOf 매칭 — bug + complex → force plan-gate', () => {
      const ctx: MatchContext = { prompt: '크리티컬 버그 발생', branch: 'feature', conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      expect(match!.skill).toBe('plan-gate');
      expect(match!.rule.id).toBe('critical-bug');
      expect(match!.rule.mode).toBe('force');
    });

    it('allOf 매칭 — bug + issue + impl → suggest plan-gate', () => {
      const ctx: MatchContext = { prompt: '#42 버그 fix 해줘', branch: 'main', conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      expect(match!.skill).toBe('plan-gate');
      expect(match!.rule.id).toBe('tracked-bug');
      expect(match!.rule.mode).toBe('suggest');
    });

    it('noneOf 매칭 — issue + impl + bug 없음 → suggest plan-gate', () => {
      const ctx: MatchContext = { prompt: '#42 이슈 implement 해줘', branch: 'main', conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      expect(match!.skill).toBe('plan-gate');
      expect(match!.rule.id).toBe('issue-impl');
    });

    it('noneOf 매칭 — bug 키워드 있으면 issue-impl 규칙 불통과', () => {
      const ctx: MatchContext = { prompt: '#42 bug implement 해줘', branch: 'main', conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      // bug가 있으므로 issue-impl이 아닌 tracked-bug가 매칭됨
      expect(match!.rule.id).toBe('tracked-bug');
    });

    it('브랜치 조건 — main 브랜치에서만 work-start 트리거', () => {
      const ctx: MatchContext = { prompt: '작업 시작', branch: 'main', conditions: { 'no-active-work': true } };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      expect(match!.skill).toBe('work-start');
    });

    it('브랜치 조건 — feature 브랜치에서 work-start 불트리거', () => {
      const ctx: MatchContext = { prompt: '작업 시작', branch: 'feat/test', conditions: { 'no-active-work': true } };
      const match = matchTriggers(sampleManifest, ctx);
      // work-start는 main 전용이므로 매칭 안 됨
      expect(match).toBeNull();
    });

    it('브랜치 조건 — feature 브랜치에서 work-finish 트리거', () => {
      const ctx: MatchContext = { prompt: '작업 완료', branch: 'feat/test', conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      expect(match!.skill).toBe('work-finish');
    });

    it('condition 미충족 — active work 있으면 work-start 불트리거', () => {
      const ctx: MatchContext = { prompt: '작업 시작', branch: 'main', conditions: { 'no-active-work': false } };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).toBeNull();
    });

    it('매칭 없는 프롬프트는 null 반환', () => {
      const ctx: MatchContext = { prompt: '날씨 알려줘', branch: 'main', conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).toBeNull();
    });

    it('first-match-wins — 앞 규칙이 우선', () => {
      const ctx: MatchContext = { prompt: '계획 수립 크리티컬 버그', branch: 'main', conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      expect(match!.rule.id).toBe('explicit-plan'); // critical-bug보다 앞
    });

    it('extracts — 이슈 번호를 추출한다', () => {
      const ctx: MatchContext = { prompt: '#42 버그 fix 해줘', branch: 'main', conditions: {} };
      const match = matchTriggers(sampleManifest, ctx);
      expect(match).not.toBeNull();
      expect(match!.extracts.issue).toBe('#42');
    });
  });

  // ── resolveMessage ──

  describe('resolveMessage', () => {
    it('플레이스홀더를 치환한다', () => {
      const result = resolveMessage('이슈({issue}) 수정 on {branch}', { issue: '#42', branch: 'main' });
      expect(result).toBe('이슈(#42) 수정 on main');
    });

    it('존재하지 않는 플레이스홀더는 빈 문자열로 대체', () => {
      const result = resolveMessage('이슈({issue}) 수정', {});
      expect(result).toBe('이슈() 수정');
    });
  });
});
