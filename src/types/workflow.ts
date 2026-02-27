import { OMC_SKILLS } from '../core/omc-compat.js';

export interface PipelineStep {
  order: number;
  agent: string;
  action: string;
  checkpoint?: string;
  optional?: boolean;
  omcSkill?: string;
  /** 이 단계에서 자동 실행할 harness MCP 도구 이름 */
  harnessTool?: string;
  guardCondition?: string;
  timeout?: number;
  retryable?: boolean;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  requiredModules: string[];
  pipeline: PipelineStep[];
  recommendedCapabilities?: string[];
  teamMode?: string;
}

export const WORKFLOW_DEFINITIONS: Record<string, WorkflowDefinition> = {
  feature: {
    name: 'feature',
    description: '기능 개발 워크플로우',
    requiredModules: ['core', 'quality'],
    pipeline: [
      { order: 1, agent: 'analyst', action: '요구사항 분석', checkpoint: '요구사항 확정', omcSkill: OMC_SKILLS.analyze },
      { order: 2, agent: 'planner', action: '구현 계획 수립', checkpoint: '계획 승인', omcSkill: OMC_SKILLS.plan },
      { order: 3, agent: 'architect', action: '아키텍처 검증', optional: true },
      { order: 4, agent: 'executor', action: '구현', checkpoint: '구현 완료', omcSkill: OMC_SKILLS.autopilot },
      { order: 5, agent: 'quality-reviewer', action: '품질 검토', optional: true, omcSkill: OMC_SKILLS['code-review'] },
      { order: 6, agent: 'test-engineer', action: '테스트 작성/실행', omcSkill: OMC_SKILLS.tdd },
      { order: 7, agent: 'verifier', action: '검증', checkpoint: '검증 통과', harnessTool: 'harness_verify_all'},
      { order: 8, agent: 'git-master', action: '커밋/PR', optional: true, omcSkill: OMC_SKILLS['git-master'] },
    ],
    recommendedCapabilities: ['serena', 'context7'],
    teamMode: 'ralph',
  },
  bugfix: {
    name: 'bugfix',
    description: '버그 수정 워크플로우',
    requiredModules: ['core'],
    pipeline: [
      { order: 1, agent: 'explore', action: '코드베이스 탐색', omcSkill: OMC_SKILLS.deepsearch },
      { order: 2, agent: 'debugger', action: '원인 분석', checkpoint: '근본 원인 확인', omcSkill: OMC_SKILLS.analyze },
      { order: 3, agent: 'executor', action: '수정 구현', omcSkill: OMC_SKILLS.autopilot },
      { order: 4, agent: 'quality-reviewer', action: '수정 검토', optional: true, omcSkill: OMC_SKILLS['code-review'] },
      { order: 5, agent: 'test-engineer', action: '회귀 테스트', omcSkill: OMC_SKILLS.tdd },
      { order: 6, agent: 'verifier', action: '수정 검증', checkpoint: '검증 통과', harnessTool: 'harness_verify_all' },
    ],
  },
  refactor: {
    name: 'refactor',
    description: '리팩토링 워크플로우',
    requiredModules: ['core', 'quality'],
    pipeline: [
      { order: 1, agent: 'planner', action: '리팩토링 계획', checkpoint: '계획 승인', omcSkill: OMC_SKILLS.plan },
      { order: 2, agent: 'architect', action: '아키텍처 리뷰' },
      { order: 3, agent: 'executor', action: '리팩토링 실행', omcSkill: OMC_SKILLS.autopilot },
      { order: 4, agent: 'quality-reviewer', action: '품질 검토', omcSkill: OMC_SKILLS['code-review'] },
      { order: 5, agent: 'verifier', action: '검증', checkpoint: '검증 통과', harnessTool: 'harness_verify_all'},
    ],
    recommendedCapabilities: ['serena'],
    teamMode: 'autopilot',
  },
  release: {
    name: 'release',
    description: '릴리스 워크플로우',
    requiredModules: ['core', 'quality', 'ship'],
    pipeline: [
      { order: 1, agent: 'security-reviewer', action: '보안 검토', optional: true, omcSkill: OMC_SKILLS['security-review'] },
      { order: 2, agent: 'quality-reviewer', action: '릴리스 품질 검토', omcSkill: OMC_SKILLS['code-review'] },
      { order: 3, agent: 'verifier', action: '릴리스 준비 검증', checkpoint: '릴리스 준비 완료', harnessTool: 'harness_verify_all' },
      { order: 4, agent: 'qa-tester', action: 'QA 테스트' },
      { order: 5, agent: 'git-master', action: '릴리스 태깅/배포', omcSkill: OMC_SKILLS['git-master'] },
    ],
    recommendedCapabilities: ['codex'],
  },
  security: {
    name: 'security',
    description: '보안 강화 워크플로우',
    requiredModules: ['core', 'security'],
    pipeline: [
      { order: 1, agent: 'security-reviewer', action: '취약점 스캔', checkpoint: '취약점 목록 확정', omcSkill: OMC_SKILLS['security-review'] },
      { order: 2, agent: 'executor', action: '보안 패치 구현', omcSkill: OMC_SKILLS.autopilot },
      { order: 3, agent: 'test-engineer', action: '보안 테스트', omcSkill: OMC_SKILLS.tdd },
      { order: 4, agent: 'verifier', action: '보안 검증', checkpoint: '검증 통과', harnessTool: 'harness_verify_all' },
    ],
    recommendedCapabilities: ['serena', 'codex'],
  },
};
