export interface SyncMapping {
  source: string;
  target: string;
  direction: 'bidirectional' | 'source-to-target' | 'target-to-source';
  description: string;
}

export interface ConflictItem {
  path: string;
  sourceValue: unknown;
  targetValue: unknown;
  resolvedWith: 'source' | 'target';
}

export interface SyncResult {
  synced: number;
  skipped: number;
  conflicts: ConflictItem[];
  errors: string[];
  timestamp: string;
}

export interface SyncConfig {
  mappings: SyncMapping[];
  conflictResolution: 'latest' | 'source' | 'target';
  dryRun: boolean;
}

export const DEFAULT_SYNC_MAPPINGS: SyncMapping[] = [
  {
    source: '.harness/team-memory.json',
    target: '.omc/project-memory.json',
    direction: 'bidirectional',
    description: '팀 메모리 <-> OMC 프로젝트 메모리',
  },
  {
    source: '.agent/ontology/ONTOLOGY-DOMAIN.md',
    target: '.omc/project-memory.json',
    direction: 'source-to-target',
    description: '온톨로지 도메인 -> OMC 프로젝트 메모리 (단방향)',
  },
];
