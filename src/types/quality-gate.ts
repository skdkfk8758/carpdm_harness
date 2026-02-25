/** 개별 검증 항목 결과 */
export interface CheckItem {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  filePath?: string;
}

/** TRUST 5개 기준 열거 */
export type TrustCriterion = 'tested' | 'readable' | 'unified' | 'secured' | 'trackable';

/** 단일 TRUST 기준 검증 결과 */
export interface ValidatorResult {
  criterion: TrustCriterion;
  passed: boolean;
  score: number;
  checks: CheckItem[];
  summary: string;
}

/** 전체 TRUST 리포트 */
export interface TrustReport {
  timestamp: string;
  projectRoot: string;
  targetFiles: string[];
  results: Record<TrustCriterion, ValidatorResult>;
  overallPassed: boolean;
  overallScore: number;
  gateAction: 'pass' | 'warn' | 'block';
}

/** 품질 게이트 설정 */
export interface QualityGateConfig {
  mode: 'block' | 'warn' | 'off';
  thresholds?: Partial<Record<TrustCriterion, number>>;
  skip?: TrustCriterion[];
}

export const DEFAULT_QUALITY_GATE_CONFIG: QualityGateConfig = {
  mode: 'warn',
  thresholds: {
    tested: 60,
    readable: 60,
    unified: 60,
    secured: 60,
    trackable: 60,
  },
  skip: [],
};

/** 검증기가 받는 컨텍스트 */
export interface ValidationContext {
  projectRoot: string;
  targetFiles: string[];
  config: QualityGateConfig;
  gitStagedFiles?: string[];
}

/** TRUST 기준 표시 순서 */
export const TRUST_CRITERIA_ORDER: TrustCriterion[] = ['tested', 'readable', 'unified', 'secured', 'trackable'];
