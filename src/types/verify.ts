import type { CheckItem, TrustReport } from './quality-gate.js';

// === Verify 스킬 메타데이터 ===

/** .claude/skills/verify-{name}/SKILL.md 에서 파싱한 메타데이터 */
export interface VerifySkillMeta {
  /** 스킬 이름 (예: "verify-api-routes") */
  name: string;
  /** 스킬 설명 */
  description: string;
  /** 커버하는 파일 glob 패턴 */
  covers: string[];
  /** SKILL.md 절대 경로 */
  filePath: string;
}

/** SKILL.md 내 개별 검사 항목 */
export interface VerifyCheck {
  /** 검사 이름 */
  name: string;
  /** 심각도 */
  severity: 'error' | 'warning' | 'info';
  /** 탐지 셸 명령어 */
  command: string;
  /** 통과 조건 설명 */
  passCondition: string;
  /** 실패 조건 설명 */
  failCondition: string;
}

// === 드리프트 탐지 ===

/** 드리프트 갭 유형 */
export type DriftGapType =
  | 'uncovered_files'
  | 'stale_references'
  | 'missing_checks'
  | 'outdated_commands'
  | 'changed_values';

/** 개별 드리프트 갭 */
export interface DriftGap {
  type: DriftGapType;
  severity: 'error' | 'warning' | 'info';
  description: string;
  affectedFiles: string[];
  relatedSkill?: string;
}

/** 드리프트 분석 리포트 */
export interface DriftReport {
  timestamp: string;
  changedFiles: string[];
  coveredFiles: string[];
  uncoveredFiles: string[];
  gaps: DriftGap[];
  suggestions: SkillSuggestion[];
}

/** 스킬 생성/업데이트 제안 */
export interface SkillSuggestion {
  action: 'create' | 'update';
  skillName: string;
  reason: string;
  covers: string[];
  proposedChecks: VerifyCheck[];
}

// === Verify 실행 결과 ===

/** 단일 verify 스킬 실행 결과 */
export interface VerifySkillResult {
  skillName: string;
  passed: boolean;
  score: number;
  checks: CheckItem[];
}

/** TRUST 5 + 커스텀 verify 통합 리포트 */
export interface IntegratedVerifyReport {
  timestamp: string;
  trustReport: TrustReport;
  verifyResults: VerifySkillResult[];
  overallPassed: boolean;
  overallScore: number;
}

// === 면제 패턴 ===

/** 드리프트 탐지에서 면제되는 파일 패턴 */
export const DRIFT_EXEMPT_PATTERNS: string[] = [
  '*.lock',
  '*.log',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '*.md',
  '*.txt',
  '.gitignore',
  '.env*',
  'node_modules/**',
  'dist/**',
  'coverage/**',
  '*.test.ts',
  '*.spec.ts',
  '*.test.js',
  '*.spec.js',
  '__tests__/**',
  '.harness/**',
  '.agent/**',
];
