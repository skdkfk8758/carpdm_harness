/**
 * 외부 레포지토리 분석기
 *
 * GitHub 레포지토리를 gh CLI로 분석하고, 현재 프로젝트와의
 * 통합 가능성을 평가하는 4단계 파이프라인.
 *
 * Phase 1: 수집 (gh api)
 * Phase 2: 분석 (구조, 의존성, 패턴)
 * Phase 3: 평가 (통합 점수 0-100)
 * Phase 4: 렌더링 (마크다운 리포트)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AnalysisDepth,
  ParsedRepoUrl,
  GhAvailability,
  RepoInfo,
  RepoPackageJson,
  RepoStructure,
  DepComparison,
  DepComparisonEntry,
  PatternAnalysis,
  IntegrationFeasibility,
  IntegrationFactor,
  FeasibilityLevel,
  RepoAnalysisResult,
} from '../types/repo-analyzer.js';

// ─── URL 파싱 ───

export function parseRepoUrl(input: string): ParsedRepoUrl | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim();

  // owner/repo shorthand
  const shorthandMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shorthandMatch) {
    return {
      owner: shorthandMatch[1],
      repo: shorthandMatch[2],
      fullName: `${shorthandMatch[1]}/${shorthandMatch[2]}`,
      hosting: 'github',
    };
  }

  // URL 파싱
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const hosting = detectHosting(url.hostname);
  const pathParts = url.pathname.replace(/^\//, '').replace(/\.git$/, '').replace(/\/$/, '').split('/');

  if (pathParts.length < 2 || !pathParts[0] || !pathParts[1]) {
    return null;
  }

  return {
    owner: pathParts[0],
    repo: pathParts[1],
    fullName: `${pathParts[0]}/${pathParts[1]}`,
    hosting,
  };
}

function detectHosting(hostname: string): ParsedRepoUrl['hosting'] {
  if (hostname.includes('github.com')) return 'github';
  if (hostname.includes('gitlab.com') || hostname.includes('gitlab')) return 'gitlab';
  if (hostname.includes('bitbucket.org') || hostname.includes('bitbucket')) return 'bitbucket';
  return 'unknown';
}

// ─── gh CLI 유틸리티 ───

function execGh(args: string[], cwd: string, timeoutMs = 10000): string | null {
  try {
    return execFileSync('gh', args, {
      cwd,
      stdio: 'pipe',
      timeout: timeoutMs,
    }).toString().trim();
  } catch {
    return null;
  }
}

export function checkGhAvailability(fullName: string, cwd: string): GhAvailability {
  // gh 설치 확인
  const versionOut = execGh(['--version'], cwd, 5000);
  if (versionOut === null) {
    return {
      installed: false,
      authenticated: false,
      canAccessRepo: false,
      errorMessage: 'gh CLI가 설치되지 않았습니다. brew install gh로 설치하세요.',
    };
  }

  // 인증 확인
  const authOut = execGh(['auth', 'status'], cwd, 5000);
  if (authOut === null) {
    return {
      installed: true,
      authenticated: false,
      canAccessRepo: false,
      errorMessage: 'gh CLI 인증이 필요합니다. gh auth login을 실행하세요.',
    };
  }

  // 레포 접근 확인
  const repoOut = execGh(['api', `repos/${fullName}`, '--cache', '1h', '-q', '.full_name'], cwd);
  if (repoOut === null) {
    return {
      installed: true,
      authenticated: true,
      canAccessRepo: false,
      errorMessage: `${fullName} 레포지토리에 접근할 수 없습니다. Private 레포인 경우 권한을 확인하세요.`,
    };
  }

  return { installed: true, authenticated: true, canAccessRepo: true };
}

// ─── Phase 1: 수집 ───

function fetchRepoInfo(fullName: string, cwd: string): RepoInfo | null {
  const jqQuery = [
    '{',
    '  fullName: .full_name,',
    '  description: .description,',
    '  language: .language,',
    '  stars: .stargazers_count,',
    '  forks: .forks_count,',
    '  openIssues: .open_issues_count,',
    '  license: (.license.spdx_id // null),',
    '  defaultBranch: .default_branch,',
    '  isArchived: .archived,',
    '  isFork: .fork,',
    '  createdAt: .created_at,',
    '  updatedAt: .updated_at,',
    '  pushedAt: .pushed_at,',
    '  size: .disk_usage,',
    '  topics: [.topics[]?]',
    '}',
  ].join(' ');

  const raw = execGh(['api', `repos/${fullName}`, '--cache', '1h', '-q', jqQuery], cwd);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    // 언어 비율 별도 조회
    const langRaw = execGh(['api', `repos/${fullName}/languages`, '--cache', '1h'], cwd);
    const languages: Record<string, number> = langRaw ? JSON.parse(langRaw) : {};

    // 바이트를 % 로 변환
    const total = Object.values(languages).reduce((a, b) => a + b, 0);
    const langPercent: Record<string, number> = {};
    if (total > 0) {
      for (const [lang, bytes] of Object.entries(languages)) {
        langPercent[lang] = Math.round((bytes / total) * 100);
      }
    }

    return { ...data, languages: langPercent } as RepoInfo;
  } catch {
    return null;
  }
}

function fetchPackageJson(fullName: string, cwd: string): RepoPackageJson | null {
  const raw = execGh(
    ['api', `repos/${fullName}/contents/package.json`, '--cache', '1h', '-q', '.content'],
    cwd,
  );
  if (!raw) return null;

  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    return JSON.parse(decoded) as RepoPackageJson;
  } catch {
    return null;
  }
}

function fetchTreeFiles(fullName: string, defaultBranch: string, cwd: string): string[] {
  const raw = execGh(
    ['api', `repos/${fullName}/git/trees/${defaultBranch}`, '--cache', '1h', '-q', '[.tree[].path]'],
    cwd,
  );
  if (!raw) return [];

  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function fetchTreeFilesRecursive(fullName: string, defaultBranch: string, cwd: string): string[] {
  const raw = execGh(
    ['api', `repos/${fullName}/git/trees/${defaultBranch}?recursive=1`, '--cache', '1h', '-q', '[.tree[].path]'],
    cwd,
  );
  if (!raw) return [];

  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

// ─── Phase 2: 분석 ───

export function detectStructure(
  pkg: RepoPackageJson | null,
  files: string[],
): RepoStructure {
  const hasPackageJson = files.some((f) => f === 'package.json' || f.endsWith('/package.json'));
  const hasTsConfig = files.some((f) =>
    f === 'tsconfig.json' || f.endsWith('/tsconfig.json') || f.startsWith('tsconfig'),
  );
  const hasTests = files.some((f) => {
    const lower = f.toLowerCase();
    return (
      lower.includes('test') ||
      lower.includes('__tests__') ||
      lower.includes('spec') ||
      lower.endsWith('.test.ts') ||
      lower.endsWith('.test.js') ||
      lower.endsWith('.spec.ts') ||
      lower.endsWith('.spec.js')
    );
  });
  const hasCi = files.some((f) =>
    f.startsWith('.github/workflows') ||
    f.startsWith('.circleci') ||
    f.startsWith('.gitlab-ci') ||
    f === '.travis.yml' ||
    f === 'Jenkinsfile',
  );
  const hasDockerfile = files.some((f) =>
    f === 'Dockerfile' || f === 'docker-compose.yml' || f === 'docker-compose.yaml',
  );

  let moduleSystem: RepoStructure['moduleSystem'] = 'unknown';
  if (pkg?.type === 'module') moduleSystem = 'esm';
  else if (pkg?.type === 'commonjs') moduleSystem = 'cjs';

  const knownEntryDirs = ['src', 'lib', 'app', 'packages', 'apps', 'modules'];
  const entryDirs = knownEntryDirs.filter((dir) =>
    files.some((f) => f === dir || f.startsWith(`${dir}/`)),
  );

  const configPatterns = [
    'tsconfig.json', 'jest.config', 'vitest.config', 'webpack.config',
    'vite.config', 'rollup.config', 'tsup.config', '.eslintrc', '.prettierrc',
    'babel.config', 'next.config', 'nuxt.config', 'tailwind.config',
  ];
  const configFiles = files.filter((f) =>
    configPatterns.some((p) => f.includes(p)),
  );

  return {
    hasPackageJson,
    hasTsConfig,
    hasTests,
    hasCi,
    hasDockerfile,
    moduleSystem,
    entryDirs,
    configFiles,
  };
}

export function compareDeps(
  targetDeps: Record<string, string>,
  localDeps: Record<string, string>,
): DepComparison {
  const targetNames = new Set(Object.keys(targetDeps));
  const localNames = new Set(Object.keys(localDeps));

  const shared: DepComparisonEntry[] = [];
  let incompatibleCount = 0;

  for (const name of targetNames) {
    if (!localNames.has(name)) continue;

    const targetVer = targetDeps[name];
    const localVer = localDeps[name];
    const status = compareVersions(targetVer, localVer);

    shared.push({ name, targetVersion: targetVer, localVersion: localVer, status });
    if (status === 'incompatible') incompatibleCount++;
  }

  const onlyInTarget = [...targetNames].filter((n) => !localNames.has(n));
  const onlyInLocal = [...localNames].filter((n) => !targetNames.has(n));

  return {
    shared,
    onlyInTarget,
    onlyInLocal,
    conflictCount: incompatibleCount,
    incompatibleCount,
  };
}

function compareVersions(a: string, b: string): DepComparisonEntry['status'] {
  if (a === b) return 'same';

  const majorA = extractMajor(a);
  const majorB = extractMajor(b);

  if (majorA === null || majorB === null) return 'compatible';
  if (majorA === majorB) return 'compatible';
  return 'incompatible';
}

function extractMajor(version: string): number | null {
  const match = version.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function detectPatterns(
  pkg: RepoPackageJson | null,
  files: string[],
): PatternAnalysis {
  const allDeps = {
    ...pkg?.dependencies,
    ...pkg?.devDependencies,
  };
  const depNames = Object.keys(allDeps);

  // 빌드 도구 감지
  const buildToolMap: Record<string, string> = {
    tsup: 'tsup', webpack: 'webpack', vite: 'vite', rollup: 'rollup',
    esbuild: 'esbuild', parcel: 'parcel', turbo: 'turborepo', nx: 'nx',
    swc: 'swc', babel: 'babel',
  };
  const buildTools = detectFromDepsAndFiles(depNames, files, buildToolMap);

  // 테스트 프레임워크 감지
  const testMap: Record<string, string> = {
    vitest: 'vitest', jest: 'jest', mocha: 'mocha', ava: 'ava',
    tap: 'tap', playwright: 'playwright', cypress: 'cypress',
    '@testing-library': 'testing-library',
  };
  const testFrameworks = detectFromDepsAndFiles(depNames, files, testMap);

  // 컨벤션 감지
  const conventions: string[] = [];
  if (files.some((f) => f.includes('.eslint') || f.includes('eslint.config')) || depNames.some((d) => d.includes('eslint'))) {
    conventions.push('eslint');
  }
  if (files.some((f) => f.includes('.prettier') || f.includes('prettier.config')) || depNames.includes('prettier')) {
    conventions.push('prettier');
  }
  if (files.some((f) => f.includes('commitlint') || f.includes('.commitlintrc')) || depNames.some((d) => d.includes('commitlint'))) {
    conventions.push('conventional-commits');
  }
  if (files.some((f) => f.includes('.husky')) || depNames.includes('husky')) {
    conventions.push('husky');
  }
  if (depNames.includes('lint-staged')) {
    conventions.push('lint-staged');
  }

  // 아키텍처 감지
  const architecture: string[] = [];
  if (
    files.some((f) => f.startsWith('packages/') || f === 'lerna.json' || f === 'pnpm-workspace.yaml') ||
    depNames.includes('lerna') || depNames.includes('@changesets/cli')
  ) {
    architecture.push('monorepo');
  }
  if (depNames.includes('next') || depNames.includes('nuxt') || depNames.includes('remix')) {
    architecture.push('fullstack-framework');
  }
  if (depNames.includes('express') || depNames.includes('fastify') || depNames.includes('koa') || depNames.includes('hono')) {
    architecture.push('http-server');
  }

  // 코드 품질 도구
  const codeQuality: string[] = [];
  if (files.some((f) => f.includes('tsconfig')) && (depNames.includes('typescript') || depNames.includes('ts-node'))) {
    codeQuality.push('typescript');
  }
  if (depNames.some((d) => d.includes('coverage') || d.includes('istanbul') || d.includes('c8'))) {
    codeQuality.push('coverage');
  }

  return { architecture, conventions, codeQuality, buildTools, testFrameworks };
}

function detectFromDepsAndFiles(
  depNames: string[],
  files: string[],
  toolMap: Record<string, string>,
): string[] {
  const found = new Set<string>();
  for (const [key, label] of Object.entries(toolMap)) {
    if (depNames.some((d) => d.includes(key))) found.add(label);
    if (files.some((f) => f.includes(key))) found.add(label);
  }
  return [...found];
}

// ─── Phase 3: 평가 ───

export function calculateIntegrationScore(
  repoInfo: RepoInfo,
  structure: RepoStructure,
  depComparison: DepComparison | null,
): IntegrationFeasibility {
  const BASE_SCORE = 50;
  const factors: IntegrationFactor[] = [];

  // 현재 프로젝트는 TypeScript ESM
  const currentLang = 'TypeScript';

  // 언어 평가
  if (repoInfo.language) {
    if (repoInfo.language === currentLang) {
      factors.push({ name: 'language', impact: 15, reason: `같은 언어 (${currentLang})` });
    } else if (['JavaScript', 'TypeScript'].includes(repoInfo.language)) {
      factors.push({ name: 'language', impact: 10, reason: `TS/JS 호환 (${repoInfo.language})` });
    } else {
      factors.push({ name: 'language', impact: -20, reason: `언어 불일치 (${repoInfo.language})` });
    }
  }

  // 모듈 시스템 평가
  if (structure.moduleSystem === 'esm') {
    factors.push({ name: 'module-system', impact: 5, reason: 'ESM 모듈 (호환)' });
  } else if (structure.moduleSystem === 'cjs') {
    factors.push({ name: 'module-system', impact: -5, reason: 'CJS 모듈 (ESM 변환 필요)' });
  }

  // 아카이브 상태
  if (repoInfo.isArchived) {
    factors.push({ name: 'archived', impact: -10, reason: '아카이브된 레포 (유지보수 중단)' });
  }

  // 의존성 충돌
  if (depComparison) {
    if (depComparison.incompatibleCount === 0) {
      factors.push({ name: 'dep-conflicts', impact: 10, reason: '의존성 충돌 없음' });
    } else {
      const penalty = depComparison.incompatibleCount * -5;
      factors.push({
        name: 'dep-conflicts',
        impact: penalty,
        reason: `비호환 의존성 ${depComparison.incompatibleCount}건`,
      });
    }
  }

  const rawScore = BASE_SCORE + factors.reduce((sum, f) => sum + f.impact, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  let level: FeasibilityLevel;
  if (score >= 75) level = 'easy';
  else if (score >= 50) level = 'moderate';
  else if (score >= 25) level = 'hard';
  else level = 'impractical';

  const levelLabel: Record<FeasibilityLevel, string> = {
    easy: '통합 용이',
    moderate: '보통 난이도',
    hard: '통합 어려움',
    impractical: '통합 비현실적',
  };

  return {
    score,
    level,
    factors,
    summary: `${levelLabel[level]} (${score}/100)`,
  };
}

// ─── Phase 4: 렌더링 ───

function renderReport(result: Omit<RepoAnalysisResult, 'report'>): string {
  const lines: string[] = [];

  lines.push(`# ${result.parsedUrl.fullName} 분석 리포트`);
  lines.push('');

  // 기본 정보
  if (result.repoInfo) {
    const r = result.repoInfo;
    lines.push('## 기본 정보');
    lines.push('');
    lines.push(`| 항목 | 값 |`);
    lines.push(`|------|------|`);
    lines.push(`| 설명 | ${r.description ?? '(없음)'} |`);
    lines.push(`| 주 언어 | ${r.language ?? '(없음)'} |`);
    lines.push(`| Stars | ${r.stars.toLocaleString()} |`);
    lines.push(`| Forks | ${r.forks.toLocaleString()} |`);
    lines.push(`| 이슈 | ${r.openIssues} |`);
    lines.push(`| 라이선스 | ${r.license ?? '(없음)'} |`);
    lines.push(`| 크기 | ${r.size > 1024 ? `${Math.round(r.size / 1024)}MB` : `${r.size}KB`} |`);
    lines.push(`| 아카이브 | ${r.isArchived ? 'Yes' : 'No'} |`);
    lines.push(`| 토픽 | ${r.topics.length > 0 ? r.topics.join(', ') : '(없음)'} |`);
    lines.push('');

    if (Object.keys(r.languages).length > 0) {
      lines.push('### 언어 비율');
      lines.push('');
      for (const [lang, pct] of Object.entries(r.languages)) {
        lines.push(`- ${lang}: ${pct}%`);
      }
      lines.push('');
    }
  }

  // 구조 분석
  if (result.structure) {
    const s = result.structure;
    lines.push('## 프로젝트 구조');
    lines.push('');
    lines.push(`| 항목 | 상태 |`);
    lines.push(`|------|------|`);
    lines.push(`| package.json | ${s.hasPackageJson ? 'O' : 'X'} |`);
    lines.push(`| TypeScript | ${s.hasTsConfig ? 'O' : 'X'} |`);
    lines.push(`| 테스트 | ${s.hasTests ? 'O' : 'X'} |`);
    lines.push(`| CI/CD | ${s.hasCi ? 'O' : 'X'} |`);
    lines.push(`| Docker | ${s.hasDockerfile ? 'O' : 'X'} |`);
    lines.push(`| 모듈 시스템 | ${s.moduleSystem.toUpperCase()} |`);
    if (s.entryDirs.length > 0) {
      lines.push(`| 소스 디렉토리 | ${s.entryDirs.join(', ')} |`);
    }
    lines.push('');
  }

  // 의존성 비교
  if (result.depComparison) {
    const d = result.depComparison;
    lines.push('## 의존성 비교');
    lines.push('');

    if (d.shared.length > 0) {
      lines.push('### 공유 의존성');
      lines.push('');
      lines.push(`| 패키지 | 대상 | 로컬 | 상태 |`);
      lines.push(`|--------|------|------|------|`);
      for (const dep of d.shared) {
        const icon = dep.status === 'same' ? 'O' : dep.status === 'compatible' ? '~' : 'X';
        lines.push(`| ${dep.name} | ${dep.targetVersion} | ${dep.localVersion} | ${icon} ${dep.status} |`);
      }
      lines.push('');
    }

    if (d.onlyInTarget.length > 0) {
      lines.push(`### 대상에만 존재 (${d.onlyInTarget.length}개)`);
      lines.push('');
      lines.push(d.onlyInTarget.map((n) => `- ${n}`).join('\n'));
      lines.push('');
    }

    lines.push(`> 충돌: ${d.conflictCount}건, 비호환: ${d.incompatibleCount}건`);
    lines.push('');
  }

  // 패턴 분석
  if (result.patterns) {
    const p = result.patterns;
    lines.push('## 패턴 분석');
    lines.push('');
    if (p.architecture.length > 0) lines.push(`- **아키텍처**: ${p.architecture.join(', ')}`);
    if (p.buildTools.length > 0) lines.push(`- **빌드**: ${p.buildTools.join(', ')}`);
    if (p.testFrameworks.length > 0) lines.push(`- **테스트**: ${p.testFrameworks.join(', ')}`);
    if (p.conventions.length > 0) lines.push(`- **컨벤션**: ${p.conventions.join(', ')}`);
    if (p.codeQuality.length > 0) lines.push(`- **품질**: ${p.codeQuality.join(', ')}`);
    lines.push('');
  }

  // 통합 가능성 평가
  if (result.feasibility) {
    const f = result.feasibility;
    lines.push('## 통합 가능성 평가');
    lines.push('');
    lines.push(`**${f.summary}**`);
    lines.push('');
    if (f.factors.length > 0) {
      lines.push(`| 요소 | 점수 | 이유 |`);
      lines.push(`|------|------|------|`);
      for (const factor of f.factors) {
        const sign = factor.impact > 0 ? '+' : '';
        lines.push(`| ${factor.name} | ${sign}${factor.impact} | ${factor.reason} |`);
      }
      lines.push('');
    }
  }

  lines.push(`---`);
  lines.push(`분석 시각: ${result.analyzedAt}`);
  lines.push(`분석 깊이: ${result.depth}`);

  return lines.join('\n');
}

// ─── 로컬 프로젝트 의존성 읽기 ───

function readLocalPackageJson(projectRoot: string): RepoPackageJson | null {
  try {
    const raw = readFileSync(join(projectRoot, 'package.json'), 'utf-8');
    return JSON.parse(raw) as RepoPackageJson;
  } catch {
    return null;
  }
}

// ─── 메인 파이프라인 ───

export interface AnalyzeRepoOptions {
  projectRoot: string;
  repoUrl: string;
  depth?: AnalysisDepth;
}

export function analyzeRepo(options: AnalyzeRepoOptions): RepoAnalysisResult {
  const { projectRoot, repoUrl, depth = 'standard' } = options;

  // URL 파싱
  const parsedUrl = parseRepoUrl(repoUrl);
  if (!parsedUrl) {
    return {
      parsedUrl: { owner: '', repo: '', fullName: repoUrl, hosting: 'unknown' },
      ghStatus: { installed: false, authenticated: false, canAccessRepo: false },
      depth,
      repoInfo: null,
      packageJson: null,
      structure: null,
      depComparison: null,
      patterns: null,
      feasibility: null,
      report: `입력값 "${repoUrl}"을(를) 파싱할 수 없습니다. owner/repo 또는 GitHub URL을 입력하세요.`,
      analyzedAt: new Date().toISOString(),
    };
  }

  // 비 GitHub 호스팅 안내
  if (parsedUrl.hosting !== 'github') {
    return {
      parsedUrl,
      ghStatus: { installed: false, authenticated: false, canAccessRepo: false },
      depth,
      repoInfo: null,
      packageJson: null,
      structure: null,
      depComparison: null,
      patterns: null,
      feasibility: null,
      report: `${parsedUrl.hosting} 레포지토리는 현재 지원하지 않습니다. GitHub 레포지토리만 분석 가능합니다.`,
      analyzedAt: new Date().toISOString(),
    };
  }

  // gh CLI 확인
  const ghStatus = checkGhAvailability(parsedUrl.fullName, projectRoot);
  if (!ghStatus.canAccessRepo) {
    return {
      parsedUrl,
      ghStatus,
      depth,
      repoInfo: null,
      packageJson: null,
      structure: null,
      depComparison: null,
      patterns: null,
      feasibility: null,
      report: ghStatus.errorMessage ?? 'gh CLI를 사용할 수 없습니다.',
      analyzedAt: new Date().toISOString(),
    };
  }

  // Phase 1: 수집
  const repoInfo = fetchRepoInfo(parsedUrl.fullName, projectRoot);
  if (!repoInfo) {
    return {
      parsedUrl,
      ghStatus,
      depth,
      repoInfo: null,
      packageJson: null,
      structure: null,
      depComparison: null,
      patterns: null,
      feasibility: null,
      report: `${parsedUrl.fullName} 레포지토리 정보를 가져올 수 없습니다.`,
      analyzedAt: new Date().toISOString(),
    };
  }

  // quick 깊이일 경우 기본 정보만 반환
  if (depth === 'quick') {
    const feasibility = calculateIntegrationScore(
      repoInfo,
      { hasPackageJson: false, hasTsConfig: false, hasTests: false, hasCi: false, hasDockerfile: false, moduleSystem: 'unknown', entryDirs: [], configFiles: [] },
      null,
    );

    const partial: Omit<RepoAnalysisResult, 'report'> = {
      parsedUrl, ghStatus, depth, repoInfo,
      packageJson: null, structure: null, depComparison: null, patterns: null,
      feasibility, analyzedAt: new Date().toISOString(),
    };
    return { ...partial, report: renderReport(partial) };
  }

  // standard/deep: 추가 수집
  const packageJson = fetchPackageJson(parsedUrl.fullName, projectRoot);
  const files = depth === 'deep'
    ? fetchTreeFilesRecursive(parsedUrl.fullName, repoInfo.defaultBranch, projectRoot)
    : fetchTreeFiles(parsedUrl.fullName, repoInfo.defaultBranch, projectRoot);

  // Phase 2: 분석
  const structure = detectStructure(packageJson, files);

  let depComparison: DepComparison | null = null;
  if (packageJson) {
    const localPkg = readLocalPackageJson(projectRoot);
    const targetDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const localDeps = { ...(localPkg?.dependencies ?? {}), ...(localPkg?.devDependencies ?? {}) };
    depComparison = compareDeps(targetDeps, localDeps);
  }

  let patterns: PatternAnalysis | null = null;
  if (depth === 'deep') {
    patterns = detectPatterns(packageJson, files);
  }

  // Phase 3: 평가
  const feasibility = calculateIntegrationScore(repoInfo, structure, depComparison);

  // Phase 4: 렌더링
  const partial: Omit<RepoAnalysisResult, 'report'> = {
    parsedUrl, ghStatus, depth, repoInfo, packageJson,
    structure, depComparison, patterns, feasibility,
    analyzedAt: new Date().toISOString(),
  };

  return { ...partial, report: renderReport(partial) };
}
