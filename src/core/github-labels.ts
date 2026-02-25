/**
 * GitHub Labels 자동 생성 모듈
 *
 * harness_init 시 ship 모듈이 포함되면 프로젝트의 GitHub 리포지토리에
 * 표준 라벨 세트를 자동 생성합니다. gh CLI가 없으면 graceful하게 건너뜁니다.
 */
import { execFileSync } from 'node:child_process';

export interface GitHubLabel {
  name: string;
  color: string;
  description: string;
}

/** 커밋 타입 라벨 — Conventional Commits와 1:1 매핑 */
const TYPE_LABELS: GitHubLabel[] = [
  { name: 'feat',     color: '0E8A16', description: '새 기능' },
  { name: 'fix',      color: 'D93F0B', description: '버그 수정' },
  { name: 'refactor', color: '1D76DB', description: '리팩토링' },
  { name: 'docs',     color: '0075CA', description: '문서' },
  { name: 'test',     color: 'BFD4F2', description: '테스트' },
  { name: 'chore',    color: 'D4C5F9', description: '설정/빌드' },
  { name: 'style',    color: 'FEF2C0', description: '포맷/스타일' },
  { name: 'perf',     color: 'F9D0C4', description: '성능 개선' },
];

/** 심각도 라벨 — 이슈 템플릿 드롭다운과 매핑 */
const SEVERITY_LABELS: GitHubLabel[] = [
  { name: 'P0-critical', color: 'B60205', description: '서비스 불가 — 즉시 대응' },
  { name: 'P1-high',     color: 'D93F0B', description: '핵심 기능 장애' },
  { name: 'P2-medium',   color: 'FBCA04', description: '불편하지만 우회 가능' },
  { name: 'P3-low',      color: 'C2E0C6', description: '사소한 문제' },
];

/** 도메인 라벨 — 이슈 템플릿 드롭다운과 매핑 */
const DOMAIN_LABELS: GitHubLabel[] = [
  { name: 'web',    color: '7057FF', description: '프론트엔드' },
  { name: 'api',    color: '008672', description: '백엔드' },
  { name: 'shared', color: 'E4E669', description: '공용 모듈' },
  { name: 'infra',  color: '5319E7', description: '인프라/CI/CD' },
];

/** 전체 표준 라벨 세트 */
export const STANDARD_LABELS: GitHubLabel[] = [
  ...TYPE_LABELS,
  ...SEVERITY_LABELS,
  ...DOMAIN_LABELS,
];

export interface LabelSetupResult {
  created: string[];
  skipped: string[];
  errors: string[];
  ghAvailable: boolean;
}

/**
 * gh CLI 사용 가능 여부 확인
 */
function isGhAvailable(cwd: string): boolean {
  try {
    execFileSync('gh', ['auth', 'status'], {
      cwd,
      stdio: 'pipe',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 현재 리포지토리의 기존 라벨 목록 조회
 */
function getExistingLabels(cwd: string): Set<string> {
  try {
    const output = execFileSync('gh', ['label', 'list', '--json', 'name', '--limit', '200'], {
      cwd,
      stdio: 'pipe',
      timeout: 10000,
    }).toString().trim();
    const labels = JSON.parse(output) as Array<{ name: string }>;
    return new Set(labels.map(l => l.name));
  } catch {
    return new Set();
  }
}

/**
 * GitHub 라벨을 자동 생성합니다.
 * 이미 존재하는 라벨은 건너뜁니다 (기존 설정 덮어쓰지 않음).
 */
export function setupGithubLabels(projectRoot: string): LabelSetupResult {
  const result: LabelSetupResult = { created: [], skipped: [], errors: [], ghAvailable: false };

  if (!isGhAvailable(projectRoot)) {
    return result;
  }
  result.ghAvailable = true;

  const existing = getExistingLabels(projectRoot);

  for (const label of STANDARD_LABELS) {
    if (existing.has(label.name)) {
      result.skipped.push(label.name);
      continue;
    }

    try {
      execFileSync('gh', [
        'label', 'create', label.name,
        '--color', label.color,
        '--description', label.description,
      ], {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: 10000,
      });
      result.created.push(label.name);
    } catch (err) {
      result.errors.push(`${label.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
