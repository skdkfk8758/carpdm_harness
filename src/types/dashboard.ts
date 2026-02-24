export interface EventEntry {
  ts: string;
  session: string;
  event: string;
  hook: string;
  result: string;
  detail?: string;
  tool?: string;
  file?: string;
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
}

export interface DashboardData {
  generatedAt: string;
  projectName: string;
  sessions: SessionSummary[];
  currentSession: EventEntry[] | null;
  stats: EventStats;
  modules: { name: string; installed: boolean; fileCount: number; hookCount: number }[];
  moduleGraph: { source: string; target: string }[];
  integrity: { original: number; modified: number; missing: number };
  teamMemory: { categories: Record<string, number> } | null;
  ontologyStatus: { enabled: boolean; layers: string[]; lastBuilt: string | null } | null;
  hookMap: { event: string; hooks: string[] }[];
}
