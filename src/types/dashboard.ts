export interface EventEntry {
  ts: string;
  session: string;
  event: string;
  hook: string;
  result: string;
  detail?: string;
  tool?: string;
  file?: string;
  durationMs?: number;    // 훅/도구 실행 시간 (ms)
  agent?: string;         // 실행 에이전트 타입 (executor, architect 등)
  skill?: string;         // 호출된 스킬명 (/commit, /dashboard 등)
  mode?: string;          // 실행 모드 (autopilot, ralph, team 등)
  linesChanged?: { added: number; removed: number };  // 변경된 라인 수
  filesAffected?: string[];                            // 영향받은 파일 목록
  delegationChain?: string[];                          // 위임 체인 (예: ["lead", "architect", "executor"])
  taskId?: string;                                     // 연관된 TaskList 항목 ID
  parentEvent?: string;                                // 부모 이벤트 ID (인과 관계 추적)
  tags?: string[];                                     // 자유 태그 (예: ["refactor", "auth", "bugfix"])
}

export interface SessionSummary {
  sessionId: string;
  startedAt: string;
  lastEventAt: string;
  eventCount: number;
  hookCounts: Record<string, number>;
  resultCounts: Record<string, number>;
}

export interface EventStats {
  totalEvents: number;
  byHook: Record<string, number>;
  byResult: Record<string, number>;
  byEvent: Record<string, number>;
  byTool: Record<string, number>;
  blockRate: number;
  warnRate: number;
  timeline: { hour: string; count: number; blocks: number; warns: number }[];
  topFiles: { file: string; count: number }[];
  byAgent: Record<string, number>;    // 에이전트별 이벤트 수
  bySkill: Record<string, number>;    // 스킬별 이벤트 수
  byMode: Record<string, number>;     // 모드별 이벤트 수
  avgDurationMs: number;              // 평균 실행 시간
  maxDurationMs: number;              // 최대 실행 시간
  durationByHook: Record<string, { avg: number; max: number; count: number }>; // 훅별 실행 시간
  totalLinesAdded: number;           // 전체 추가된 라인 수
  totalLinesRemoved: number;         // 전체 삭제된 라인 수
  fileHotspots: { file: string; changes: number; linesAdded: number; linesRemoved: number }[];  // 파일별 변경 핫스팟 (top 15)
  delegationPatterns: { chain: string; count: number }[];  // 위임 패턴 빈도 (top 10)
  avgChainDepth: number;             // 평균 위임 체인 깊이
  byTag: Record<string, number>;       // 태그별 이벤트 수
  taskEventMap: { taskId: string; eventCount: number; results: Record<string, number> }[];  // 태스크별 이벤트 요약 (top 20)
  eventCausalChains: { depth: number; count: number }[];  // 인과 체인 깊이별 분포
}

export interface DashboardData {
  generatedAt: string;
  projectName: string;
  sessions: SessionSummary[];
  currentSession: EventEntry[] | null;
  allSessions: Record<string, EventEntry[]>;
  stats: EventStats;
  modules: { name: string; installed: boolean; fileCount: number; hookCount: number }[];
  moduleGraph: { source: string; target: string }[];
  integrity: { original: number; modified: number; missing: number };
  teamMemory: { categories: Record<string, number> } | null;
  ontologyStatus: { enabled: boolean; layers: string[]; lastBuilt: string | null } | null;
  hookMap: { event: string; hooks: string[] }[];
}
