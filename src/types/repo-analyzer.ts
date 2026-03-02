/**
 * 외부 레포지토리 분석기 타입 정의
 *
 * GitHub 레포지토리를 분석하고 현재 프로젝트와의 통합 가능성을 평가하기 위한
 * 인터페이스 모음. gh CLI를 통해 수집한 데이터를 구조화합니다.
 */

// ─── 분석 깊이 ───

export type AnalysisDepth = 'quick' | 'standard' | 'deep';

// ─── URL 파싱 ───

export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  fullName: string; // "owner/repo"
  hosting: 'github' | 'gitlab' | 'bitbucket' | 'unknown';
}

// ─── gh CLI 상태 ───

export interface GhAvailability {
  installed: boolean;
  authenticated: boolean;
  canAccessRepo: boolean;
  errorMessage?: string;
}

// ─── Phase 1: 수집 ───

export interface RepoInfo {
  fullName: string;
  description: string | null;
  language: string | null;
  languages: Record<string, number>; // { TypeScript: 80, JavaScript: 20 }
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  defaultBranch: string;
  isArchived: boolean;
  isFork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  size: number; // KB
  topics: string[];
}

export interface RepoPackageJson {
  name?: string;
  version?: string;
  type?: string; // "module" | "commonjs"
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
}

// ─── Phase 2: 분석 ───

export interface RepoStructure {
  hasPackageJson: boolean;
  hasTsConfig: boolean;
  hasTests: boolean;
  hasCi: boolean; // .github/workflows, .circleci 등
  hasDockerfile: boolean;
  moduleSystem: 'esm' | 'cjs' | 'unknown';
  entryDirs: string[]; // src/, lib/, app/ 등 감지된 소스 디렉토리
  configFiles: string[]; // 감지된 설정 파일 목록
}

export interface DepComparisonEntry {
  name: string;
  targetVersion: string;
  localVersion: string | null; // null = 로컬에 없음
  status: 'same' | 'compatible' | 'incompatible' | 'missing';
}

export interface DepComparison {
  shared: DepComparisonEntry[];
  onlyInTarget: string[];
  onlyInLocal: string[];
  conflictCount: number;
  incompatibleCount: number;
}

export interface PatternAnalysis {
  architecture: string[]; // 감지된 아키텍처 패턴 (monorepo, MVC 등)
  conventions: string[]; // 컨벤션 (ESLint, Prettier, Conventional Commits 등)
  codeQuality: string[]; // 품질 도구 (TypeScript strict, coverage 등)
  buildTools: string[]; // 빌드 도구 (tsup, webpack, vite 등)
  testFrameworks: string[]; // 테스트 (vitest, jest, mocha 등)
}

// ─── Phase 3: 평가 ───

export type FeasibilityLevel = 'easy' | 'moderate' | 'hard' | 'impractical';

export interface IntegrationFeasibility {
  score: number; // 0-100
  level: FeasibilityLevel;
  factors: IntegrationFactor[];
  summary: string;
}

export interface IntegrationFactor {
  name: string;
  impact: number; // 양수 = 유리, 음수 = 불리
  reason: string;
}

// ─── Phase 4: 최종 결과 ───

export interface RepoAnalysisResult {
  parsedUrl: ParsedRepoUrl;
  ghStatus: GhAvailability;
  depth: AnalysisDepth;
  repoInfo: RepoInfo | null;
  packageJson: RepoPackageJson | null;
  structure: RepoStructure | null;
  depComparison: DepComparison | null;
  patterns: PatternAnalysis | null;
  feasibility: IntegrationFeasibility | null;
  report: string; // 렌더링된 마크다운
  analyzedAt: string;
}
