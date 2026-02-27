// === 워크플로우 단계 ===

export type WorkflowPhase = 'planning' | 'implementing' | 'testing' | 'completing' | 'unknown';

// === 합리화 방지 ===

export interface RationalizationEntry {
  rationalization: string;
  rebuttal: string;
}

export type RationalizationTable = Record<Exclude<WorkflowPhase, 'unknown'>, RationalizationEntry[]>;

// === 적신호 탐지 ===

export type RedFlagCategory = 'hedging' | 'unverified_claim' | 'assumption' | 'skipping';

export interface RedFlagPattern {
  category: RedFlagCategory;
  pattern: RegExp;
  description: string;
}

export interface RedFlagMatch {
  category: RedFlagCategory;
  matched: string;
  description: string;
}

export interface RedFlagDetectionResult {
  hasRedFlags: boolean;
  matches: RedFlagMatch[];
}

// === 설정 ===

export interface BehavioralGuardConfig {
  rationalization: 'on' | 'off';
  redFlagDetection: 'on' | 'off';
}

export const DEFAULT_BEHAVIORAL_GUARD_CONFIG: BehavioralGuardConfig = {
  rationalization: 'on',
  redFlagDetection: 'on',
};
