// === 상태 타입 ===

export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'waiting_checkpoint'
  | 'failed_step'
  | 'completed'
  | 'aborted';

export type WorkflowEventType =
  | 'start'
  | 'complete_step'
  | 'checkpoint_block'
  | 'approve'
  | 'reject'
  | 'step_fail'
  | 'retry'
  | 'skip'
  | 'abort';

export interface WorkflowEvent {
  type: WorkflowEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_checkpoint';

export interface StepState {
  order: number;
  agent: string;
  action: string;
  status: StepStatus;
  optional?: boolean;
  checkpoint?: string;
  checkpointApproved?: boolean;
  omcSkill?: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  error?: string;
  artifacts?: Record<string, unknown>;
  retryCount?: number;
}

export interface WorkflowContext {
  description?: string;
  branch?: string;
  relatedIssue?: string;
  [key: string]: unknown;
}

export interface WorkflowEngineConfig {
  guardLevel: 'block' | 'warn' | 'off';
  autoAdvance: boolean;
  syncToOmc: boolean;
  maxRetries: number;
  historyEnabled: boolean;
}

export const DEFAULT_ENGINE_CONFIG: WorkflowEngineConfig = {
  guardLevel: 'warn',
  autoAdvance: false,
  syncToOmc: true,
  maxRetries: 3,
  historyEnabled: true,
};

export interface WorkflowInstance {
  id: string;
  workflowType: string;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  context: WorkflowContext;
  steps: StepState[];
  config: WorkflowEngineConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowHistory {
  workflowId: string;
  events: WorkflowEvent[];
}

export interface ActiveWorkflow {
  activeWorkflowId: string | null;
  startedAt?: string;
}

// === 엔진 결과 타입 ===

export interface EngineResult {
  success: boolean;
  instance?: WorkflowInstance;
  message: string;
  nextAction?: NextAction;
}

export interface NextAction {
  type: 'run_omc_skill' | 'manual_action' | 'await_checkpoint' | 'workflow_complete';
  skill?: string;
  agent?: string;
  action?: string;
  checkpoint?: string;
}

// === 전환 테이블 ===

export const TRANSITION_TABLE: Record<WorkflowStatus, WorkflowEventType[]> = {
  idle:                ['start'],
  running:             ['complete_step', 'checkpoint_block', 'step_fail', 'abort'],
  waiting_checkpoint:  ['approve', 'reject', 'abort'],
  failed_step:         ['retry', 'skip', 'abort'],
  completed:           [],
  aborted:             [],
};
