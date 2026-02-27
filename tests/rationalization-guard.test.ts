import { describe, it, expect } from 'vitest';
import {
  resolveWorkflowPhase,
  buildRationalizationContext,
} from '../src/core/rationalization-guard.js';
import type { WorkflowStateData } from '../src/hooks/hook-utils.js';

function makeInstance(agent: string, currentStep = 1): WorkflowStateData {
  return {
    id: 'test-wf-001',
    workflowType: 'standard',
    status: 'running',
    currentStep,
    totalSteps: 4,
    steps: [
      { order: 1, agent, action: 'test action', status: 'running' },
      { order: 2, agent: 'executor', action: 'implement', status: 'pending' },
      { order: 3, agent: 'test-engineer', action: 'test', status: 'pending' },
      { order: 4, agent: 'verifier', action: 'verify', status: 'pending' },
    ],
  };
}

describe('resolveWorkflowPhase', () => {
  describe('정확한 agent 매핑', () => {
    it('should map "planner" to planning', () => {
      expect(resolveWorkflowPhase(makeInstance('planner'))).toBe('planning');
    });

    it('should map "architect" to planning', () => {
      expect(resolveWorkflowPhase(makeInstance('architect'))).toBe('planning');
    });

    it('should map "executor" to implementing', () => {
      expect(resolveWorkflowPhase(makeInstance('executor'))).toBe('implementing');
    });

    it('should map "test-engineer" to testing', () => {
      expect(resolveWorkflowPhase(makeInstance('test-engineer'))).toBe('testing');
    });

    it('should map "verifier" to completing', () => {
      expect(resolveWorkflowPhase(makeInstance('verifier'))).toBe('completing');
    });

    it('should map "reviewer" to completing', () => {
      expect(resolveWorkflowPhase(makeInstance('reviewer'))).toBe('completing');
    });
  });

  describe('부분 매칭', () => {
    it('should match agent containing "planner" substring', () => {
      expect(resolveWorkflowPhase(makeInstance('senior-planner'))).toBe('planning');
    });

    it('should match agent containing "executor" substring', () => {
      expect(resolveWorkflowPhase(makeInstance('deep-executor'))).toBe('implementing');
    });

    it('should match agent containing "tester" substring', () => {
      expect(resolveWorkflowPhase(makeInstance('qa-tester'))).toBe('testing');
    });
  });

  describe('unknown 처리', () => {
    it('should return unknown for unrecognized agent', () => {
      expect(resolveWorkflowPhase(makeInstance('custom-agent'))).toBe('unknown');
    });

    it('should return unknown for missing steps', () => {
      expect(resolveWorkflowPhase({ status: 'running' } as WorkflowStateData)).toBe('unknown');
    });

    it('should return unknown for null instance', () => {
      expect(resolveWorkflowPhase(null as unknown as WorkflowStateData)).toBe('unknown');
    });

    it('should return unknown for empty agent', () => {
      expect(resolveWorkflowPhase(makeInstance(''))).toBe('unknown');
    });
  });

  describe('currentStep 기반 매핑', () => {
    it('should use correct step when currentStep=3', () => {
      const instance = makeInstance('planner', 3);
      // step 3 has agent 'test-engineer'
      expect(resolveWorkflowPhase(instance)).toBe('testing');
    });

    it('should use correct step when currentStep=4', () => {
      const instance = makeInstance('planner', 4);
      // step 4 has agent 'verifier'
      expect(resolveWorkflowPhase(instance)).toBe('completing');
    });
  });
});

describe('buildRationalizationContext', () => {
  it('should return null for unknown phase', () => {
    expect(buildRationalizationContext('unknown')).toBeNull();
  });

  it('should return planning context', () => {
    const result = buildRationalizationContext('planning');
    expect(result).not.toBeNull();
    expect(result).toContain('[behavioral-guard]');
    expect(result).toContain('계획 단계');
    expect(result).toContain('합리화');
    expect(result).toContain('반박');
  });

  it('should return implementing context', () => {
    const result = buildRationalizationContext('implementing');
    expect(result).not.toBeNull();
    expect(result).toContain('구현 단계');
  });

  it('should return testing context', () => {
    const result = buildRationalizationContext('testing');
    expect(result).not.toBeNull();
    expect(result).toContain('테스트 단계');
  });

  it('should return completing context', () => {
    const result = buildRationalizationContext('completing');
    expect(result).not.toBeNull();
    expect(result).toContain('완료 단계');
  });

  it('should respect maxItems parameter', () => {
    const result = buildRationalizationContext('planning', 2);
    expect(result).not.toBeNull();
    // 테이블 헤더 3줄 + 항목 2줄 = 5줄
    const lines = result!.split('\n');
    expect(lines.length).toBe(5);
  });

  it('should format as markdown table', () => {
    const result = buildRationalizationContext('implementing');
    expect(result).toContain('| 합리화 | 반박 |');
    expect(result).toContain('|--------|------|');
  });
});
