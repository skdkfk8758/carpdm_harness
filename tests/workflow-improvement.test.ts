import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function readText(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

// ─── 1. 타입/설정 테스트 ───
describe('타입/설정 검증', () => {
  describe('HarnessConfig planGuard 필드', () => {
    it('DEFAULT_CONFIG에 planGuard 필드가 존재한다', async () => {
      const { DEFAULT_CONFIG } = await import('../src/types/config.js');
      expect(DEFAULT_CONFIG).toHaveProperty('planGuard');
    });

    it('DEFAULT_CONFIG.planGuard 값이 block 또는 warn이다', async () => {
      const { DEFAULT_CONFIG } = await import('../src/types/config.js');
      expect(['block', 'warn']).toContain(DEFAULT_CONFIG.planGuard);
    });

    it('HarnessConfig 인터페이스 정의 파일에 planGuard 타입이 선언되어 있다', () => {
      const content = readText('src/types/config.ts');
      expect(content).toContain("planGuard?: 'block' | 'warn'");
    });
  });

  describe('PipelineStep omcSkill 필드', () => {
    it('PipelineStep 인터페이스에 omcSkill 필드가 선언되어 있다', () => {
      const content = readText('src/types/workflow.ts');
      expect(content).toContain('omcSkill?');
    });

    it('PipelineStep 타입 정의 파일에 omcSkill이 string 타입으로 선언되어 있다', () => {
      const content = readText('src/types/workflow.ts');
      expect(content).toContain('omcSkill?: string');
    });
  });
});

// ─── 2. 워크플로우 매핑 테스트 ───
describe('워크플로우 매핑 검증', () => {
  describe('WORKFLOW_DEFINITIONS omcSkill 접두사', () => {
    it('omcSkill이 있는 모든 단계의 값이 /oh-my-claudecode: 접두사를 가진다', async () => {
      const { WORKFLOW_DEFINITIONS } = await import('../src/types/workflow.js');
      for (const [workflowName, def] of Object.entries(WORKFLOW_DEFINITIONS)) {
        for (const step of def.pipeline) {
          if (step.omcSkill !== undefined) {
            expect(
              step.omcSkill,
              `워크플로우 "${workflowName}" 단계 ${step.order} (${step.agent})의 omcSkill이 잘못된 접두사를 가짐`,
            ).toMatch(/^\/oh-my-claudecode:/);
          }
        }
      }
    });
  });

  describe('5개 워크플로우 정의', () => {
    it('feature 워크플로우가 정의되어 있다', async () => {
      const { WORKFLOW_DEFINITIONS } = await import('../src/types/workflow.js');
      expect(WORKFLOW_DEFINITIONS).toHaveProperty('feature');
    });

    it('bugfix 워크플로우가 정의되어 있다', async () => {
      const { WORKFLOW_DEFINITIONS } = await import('../src/types/workflow.js');
      expect(WORKFLOW_DEFINITIONS).toHaveProperty('bugfix');
    });

    it('refactor 워크플로우가 정의되어 있다', async () => {
      const { WORKFLOW_DEFINITIONS } = await import('../src/types/workflow.js');
      expect(WORKFLOW_DEFINITIONS).toHaveProperty('refactor');
    });

    it('release 워크플로우가 정의되어 있다', async () => {
      const { WORKFLOW_DEFINITIONS } = await import('../src/types/workflow.js');
      expect(WORKFLOW_DEFINITIONS).toHaveProperty('release');
    });

    it('security 워크플로우가 정의되어 있다', async () => {
      const { WORKFLOW_DEFINITIONS } = await import('../src/types/workflow.js');
      expect(WORKFLOW_DEFINITIONS).toHaveProperty('security');
    });
  });

  describe('각 워크플로우 pipeline 비어있지 않음', () => {
    it('모든 워크플로우의 pipeline이 빈 배열이 아니다', async () => {
      const { WORKFLOW_DEFINITIONS } = await import('../src/types/workflow.js');
      for (const [workflowName, def] of Object.entries(WORKFLOW_DEFINITIONS)) {
        expect(
          def.pipeline.length,
          `워크플로우 "${workflowName}"의 pipeline이 비어 있음`,
        ).toBeGreaterThan(0);
      }
    });
  });
});

// ─── 3. capability-detector 테스트 ───
describe('capability-detector 검증', () => {
  describe('getReviewTool 함수 export', () => {
    it('getReviewTool 함수가 export되어 있다', async () => {
      const module = await import('../src/core/capability-detector.js');
      expect(typeof module.getReviewTool).toBe('function');
    });
  });

  describe('getReviewTool 반환 타입', () => {
    it('getReviewTool이 type과 instruction 필드를 가진 객체를 반환한다', async () => {
      const { getReviewTool } = await import('../src/core/capability-detector.js');
      // 캐시 파일이 없는 환경에서는 agent 타입을 반환함
      const result = getReviewTool('/tmp/nonexistent-project-root');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('instruction');
    });

    it('getReviewTool의 type 값이 codex 또는 agent이다', async () => {
      const { getReviewTool } = await import('../src/core/capability-detector.js');
      const result = getReviewTool('/tmp/nonexistent-project-root');
      expect(['codex', 'agent']).toContain(result.type);
    });

    it('getReviewTool의 instruction 값이 비어있지 않은 문자열이다', async () => {
      const { getReviewTool } = await import('../src/core/capability-detector.js');
      const result = getReviewTool('/tmp/nonexistent-project-root');
      expect(typeof result.instruction).toBe('string');
      expect(result.instruction.length).toBeGreaterThan(0);
    });
  });
});

// ─── 4. 셸 훅 파일 테스트 ───
describe('셸 훅 파일 검증', () => {
  describe('templates/core/hooks/plan-guard.sh', () => {
    const planGuardPath = 'templates/core/hooks/plan-guard.sh';

    it('plan-guard.sh에 exit 1 라인이 존재한다 (실제 차단 동작 확인)', () => {
      const content = readText(planGuardPath);
      expect(content).toContain('exit 1');
    });

    it('plan-guard.sh에 harness_get_plan_guard_mode 호출이 존재한다', () => {
      const content = readText(planGuardPath);
      expect(content).toContain('harness_get_plan_guard_mode');
    });

    it('plan-guard.sh에 BugFix 키워드가 존재한다 (task-mode 완화 처리 확인)', () => {
      const content = readText(planGuardPath);
      expect(content).toContain('BugFix');
    });
  });

  describe('templates/core/hooks/_harness-common.sh', () => {
    const commonPath = 'templates/core/hooks/_harness-common.sh';

    it('_harness-common.sh에 harness_get_plan_guard_mode 함수가 정의되어 있다', () => {
      const content = readText(commonPath);
      expect(content).toContain('harness_get_plan_guard_mode()');
    });

    it('_harness-common.sh에 harness_has_capability 함수가 정의되어 있다', () => {
      const content = readText(commonPath);
      expect(content).toContain('harness_has_capability()');
    });
  });

  describe('templates/core/hooks/post-task.sh', () => {
    const postTaskPath = 'templates/core/hooks/post-task.sh';

    it('post-task.sh에 harness_has_capability 호출이 존재한다 (하드코딩 제거 확인)', () => {
      const content = readText(postTaskPath);
      expect(content).toContain('harness_has_capability');
    });

    it('post-task.sh에 AGENT SUGGEST 키워드가 존재한다 (에이전트 트리거 확인)', () => {
      const content = readText(postTaskPath);
      expect(content).toContain('AGENT SUGGEST');
    });
  });

  describe('templates/core/hooks/pre-task.sh', () => {
    const preTaskPath = 'templates/core/hooks/pre-task.sh';

    it('pre-task.sh에 워크플로우 키워드 감지 패턴이 존재한다', () => {
      const content = readText(preTaskPath);
      expect(content).toContain('워크플로우');
    });
  });
});

// ─── 5. 에이전트 트리거 테스트 ───
describe('에이전트 트리거 검증', () => {
  describe('src/hooks/session-start.ts', () => {
    const sessionStartPath = 'src/hooks/session-start.ts';

    it('session-start.ts에 onboarded 키워드가 존재한다 (온보딩 마커 확인)', () => {
      const content = readText(sessionStartPath);
      expect(content).toContain('onboarded');
    });

    it('session-start.ts에 AGENT SUGGEST 키워드가 존재한다 (에이전트 트리거 확인)', () => {
      const content = readText(sessionStartPath);
      expect(content).toContain('AGENT SUGGEST');
    });
  });
});
