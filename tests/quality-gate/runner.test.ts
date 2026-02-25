import { describe, it, expect } from 'vitest';
import { QualityGateRunner } from '../../src/core/quality-gate/runner.js';
import type { ValidationContext } from '../../src/types/quality-gate.js';
import { TRUST_CRITERIA_ORDER } from '../../src/types/quality-gate.js';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    projectRoot: ROOT,
    targetFiles: [],
    config: { mode: 'warn', thresholds: {}, skip: [] },
    ...overrides,
  };
}

describe('QualityGateRunner', () => {
  it('전체 5개 기준 실행 시 results에 5개 키가 모두 존재한다', async () => {
    const runner = new QualityGateRunner();
    const report = await runner.run(makeContext());

    for (const criterion of TRUST_CRITERIA_ORDER) {
      expect(report.results).toHaveProperty(criterion);
      expect(report.results[criterion]).toHaveProperty('criterion', criterion);
      expect(report.results[criterion]).toHaveProperty('score');
      expect(report.results[criterion]).toHaveProperty('passed');
    }
  });

  it('overallScore가 5개 score의 평균이다', async () => {
    const runner = new QualityGateRunner();
    const report = await runner.run(makeContext());

    const scores = TRUST_CRITERIA_ORDER.map(c => report.results[c].score);
    const expectedAvg = Math.round(scores.reduce((a, b) => a + b, 0) / 5);
    expect(report.overallScore).toBe(expectedAvg);
  });

  it('mode=off 시 gateAction이 pass이다', async () => {
    const runner = new QualityGateRunner();
    const report = await runner.run(makeContext({
      config: { mode: 'off', thresholds: {}, skip: [] },
    }));

    expect(report.gateAction).toBe('pass');
  });

  it('skip된 기준은 기본 pass(100점)로 포함된다', async () => {
    const runner = new QualityGateRunner();
    const report = await runner.run(makeContext({
      config: { mode: 'warn', skip: ['tested', 'readable'] },
    }));

    expect(report.results.tested.passed).toBe(true);
    expect(report.results.tested.score).toBe(100);
    expect(report.results.tested.summary).toContain('건너뜀');

    expect(report.results.readable.passed).toBe(true);
    expect(report.results.readable.score).toBe(100);
  });

  it('빈 파일 목록으로 실행 시 에러 없이 완료된다', async () => {
    const runner = new QualityGateRunner();
    const report = await runner.run(makeContext({ targetFiles: [] }));

    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('overallScore');
    expect(report).toHaveProperty('gateAction');
    expect(typeof report.overallScore).toBe('number');
  });

  it('report에 timestamp, projectRoot, targetFiles가 포함된다', async () => {
    const runner = new QualityGateRunner();
    const report = await runner.run(makeContext({ targetFiles: ['test.ts'] }));

    expect(report.timestamp).toBeTruthy();
    expect(report.projectRoot).toBe(ROOT);
    expect(report.targetFiles).toEqual(['test.ts']);
  });
});
