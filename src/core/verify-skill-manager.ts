import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  VerifySkillMeta,
  DriftReport,
  DriftGap,
  SkillSuggestion,
  VerifyCheck,
} from '../types/verify.js';
import { DRIFT_EXEMPT_PATTERNS } from '../types/verify.js';

// === Glob 매칭 유틸 ===

/** 간이 glob 매칭 (minimatch 대체, 외부 의존성 없음) */
function globMatch(file: string, pattern: string): boolean {
  // **/ → 임의 디렉토리
  // * → 임의 파일명 (/ 제외)
  // ? → 임의 단일 문자
  const escaped = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]');
  try {
    return new RegExp(`^${escaped}$`).test(file);
  } catch {
    return false;
  }
}

// === 스킬 스캔 ===

/** 프로젝트의 .claude/skills/verify-* 디렉토리를 스캔하여 메타데이터 추출 */
export function scanVerifySkills(projectRoot: string): VerifySkillMeta[] {
  const skillsDir = join(projectRoot, '.claude', 'skills');
  if (!existsSync(skillsDir)) return [];

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const skills: VerifySkillMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('verify-')) continue;

    const skillPath = join(skillsDir, entry.name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;

    const meta = parseSkillFrontmatter(skillPath);
    if (meta) skills.push(meta);
  }

  return skills;
}

/** SKILL.md YAML frontmatter 파싱 */
function parseSkillFrontmatter(filePath: string): VerifySkillMeta | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const fm = fmMatch[1];
    const name = extractYamlValue(fm, 'name');
    const description = extractYamlValue(fm, 'description') ?? '';
    const covers = extractYamlArray(fm, 'covers');

    if (!name) return null;

    return { name, description, covers, filePath };
  } catch {
    return null;
  }
}

/** YAML에서 단일 값 추출 (간이 파서) */
function extractYamlValue(yaml: string, key: string): string | null {
  const match = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, '');
}

/** YAML에서 배열 추출 (간이 파서) */
function extractYamlArray(yaml: string, key: string): string[] {
  const lines = yaml.split('\n');
  const items: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (line.match(new RegExp(`^${key}:`))) {
      // 인라인 배열 체크: covers: ["a", "b"]
      const inlineMatch = line.match(/\[([^\]]*)\]/);
      if (inlineMatch) {
        return inlineMatch[1]
          .split(',')
          .map(s => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      }
      capturing = true;
      continue;
    }
    if (capturing) {
      if (line.match(/^\s+-\s+/)) {
        const val = line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, '');
        if (val) items.push(val);
      } else {
        break; // 배열 끝
      }
    }
  }
  return items;
}

// === Git 변경 감지 ===

/** git diff로 변경된 파일 목록 추출 */
export function getChangedFiles(projectRoot: string): string[] {
  try {
    // staged 파일 우선
    let stdout = execSync('git diff --cached --name-only', {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 8000,
    }).toString().trim();

    if (!stdout) {
      // staged 없으면 최근 커밋 대비 변경
      stdout = execSync('git diff --name-only HEAD 2>/dev/null || git diff --name-only', {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: 8000,
      }).toString().trim();
    }

    if (!stdout) {
      // 마지막으로 main/master 대비
      stdout = execSync('git diff --name-only main...HEAD 2>/dev/null || git diff --name-only master...HEAD 2>/dev/null || echo ""', {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: 8000,
      }).toString().trim();
    }

    return stdout ? stdout.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** 면제 패턴에 해당하는 파일 필터링 */
function filterExemptFiles(files: string[]): string[] {
  return files.filter(file =>
    !DRIFT_EXEMPT_PATTERNS.some(pattern => globMatch(file, pattern)),
  );
}

// === 드리프트 분석 ===

/** 변경된 파일과 verify 스킬의 커버리지를 비교하여 드리프트 분석 */
export function analyzeGitDrift(projectRoot: string, skills: VerifySkillMeta[]): DriftReport {
  const allChanged = getChangedFiles(projectRoot);
  const changedFiles = filterExemptFiles(allChanged);

  // 커버리지 매핑
  const coveredFiles: string[] = [];
  const uncoveredFiles: string[] = [];

  for (const file of changedFiles) {
    const isCovered = skills.some(skill =>
      skill.covers.some(pattern => globMatch(file, pattern)),
    );
    if (isCovered) {
      coveredFiles.push(file);
    } else {
      uncoveredFiles.push(file);
    }
  }

  const gaps: DriftGap[] = [];

  // Gap 1: 커버되지 않은 파일
  if (uncoveredFiles.length > 0) {
    gaps.push({
      type: 'uncovered_files',
      severity: 'warning',
      description: `${uncoveredFiles.length}개 변경 파일이 어떤 verify 스킬에도 커버되지 않음`,
      affectedFiles: uncoveredFiles,
    });
  }

  // Gap 2: 삭제된 파일 참조 (stale references)
  for (const skill of skills) {
    const staleFiles = findStaleReferences(projectRoot, skill);
    if (staleFiles.length > 0) {
      gaps.push({
        type: 'stale_references',
        severity: 'info',
        description: `${skill.name}: covers 패턴이 매치하는 파일이 없음`,
        affectedFiles: staleFiles,
        relatedSkill: skill.name,
      });
    }
  }

  // Gap 3: 오래된 탐지 명령어 (outdated_commands)
  // SKILL.md 본문에서 검사 명령어를 추출하여 실행 가능한지 확인은
  // verify-runner에서 실행 시점에 감지하므로 여기서는 스킵

  const suggestions = generateSuggestions(uncoveredFiles, skills);

  return {
    timestamp: new Date().toISOString(),
    changedFiles,
    coveredFiles,
    uncoveredFiles,
    gaps,
    suggestions,
  };
}

/** covers 패턴이 실제 파일과 매치하는지 확인 */
function findStaleReferences(projectRoot: string, skill: VerifySkillMeta): string[] {
  const stale: string[] = [];

  for (const pattern of skill.covers) {
    try {
      // 간단한 glob 존재 확인: 패턴 디렉토리가 있는지 체크
      const baseDir = pattern.split('*')[0].replace(/\/$/, '') || '.';
      const fullPath = join(projectRoot, baseDir);
      if (!existsSync(fullPath)) {
        stale.push(pattern);
      }
    } catch {
      stale.push(pattern);
    }
  }

  return stale;
}

/** 커버되지 않은 파일을 기반으로 스킬 생성/업데이트 제안 생성 */
function generateSuggestions(
  uncoveredFiles: string[],
  existingSkills: VerifySkillMeta[],
): SkillSuggestion[] {
  if (uncoveredFiles.length === 0) return [];

  // 파일을 디렉토리 기반으로 그룹화
  const groups = groupFilesByDirectory(uncoveredFiles);
  const suggestions: SkillSuggestion[] = [];

  for (const [dir, files] of Object.entries(groups)) {
    const domainName = dir.replace(/\//g, '-').replace(/^src-/, '');
    const skillName = `verify-${domainName || 'root'}`;

    // 기존 스킬 중 이 디렉토리를 커버할 수 있는 것이 있는지 확인
    const relatedSkill = existingSkills.find(s =>
      s.covers.some(p => files.some(f => globMatch(f, p))),
    );

    if (relatedSkill) {
      // 기존 스킬 업데이트 제안
      suggestions.push({
        action: 'update',
        skillName: relatedSkill.name,
        reason: `${files.length}개 파일이 커버 패턴에 추가 필요`,
        covers: [`${dir}/**/*`],
        proposedChecks: generateDefaultChecks(dir, files),
      });
    } else {
      // 새 스킬 생성 제안
      suggestions.push({
        action: 'create',
        skillName,
        reason: `${dir} 디렉토리의 ${files.length}개 변경 파일에 대한 검증 스킬 없음`,
        covers: [`${dir}/**/*`],
        proposedChecks: generateDefaultChecks(dir, files),
      });
    }
  }

  return suggestions;
}

/** 파일을 최상위 디렉토리 기준으로 그룹화 */
function groupFilesByDirectory(files: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  for (const file of files) {
    // src/core/foo.ts → "src/core"
    const parts = file.split('/');
    const dir = parts.length > 1 ? parts.slice(0, 2).join('/') : '.';
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(file);
  }

  return groups;
}

/** 디렉토리에 대한 기본 검사 항목 생성 */
function generateDefaultChecks(_dir: string, files: string[]): VerifyCheck[] {
  const checks: VerifyCheck[] = [];
  const hasTs = files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'));

  if (hasTs) {
    checks.push({
      name: 'TypeScript 컴파일',
      severity: 'error',
      command: 'npx tsc --noEmit',
      passCondition: 'exit code 0',
      failCondition: '타입 에러 존재',
    });
  }

  checks.push({
    name: '파일 존재 확인',
    severity: 'error',
    command: `ls ${files.slice(0, 5).join(' ')}`,
    passCondition: '모든 파일 존재',
    failCondition: '참조된 파일 누락',
  });

  return checks;
}

// === 스킬 생성/업데이트 ===

/** verify 스킬 SKILL.md 생성 */
export function generateVerifySkill(
  projectRoot: string,
  suggestion: SkillSuggestion,
): string {
  const skillDir = join(projectRoot, '.claude', 'skills', suggestion.skillName);
  mkdirSync(skillDir, { recursive: true });

  const checksSection = suggestion.proposedChecks
    .map((check, i) => {
      return [
        `### ${i + 1}. ${check.name} (severity: ${check.severity})`,
        `- 탐지: \`${check.command}\``,
        `- PASS: ${check.passCondition}`,
        `- FAIL: ${check.failCondition}`,
      ].join('\n');
    })
    .join('\n\n');

  const coversYaml = suggestion.covers.map(c => `  - "${c}"`).join('\n');

  const content = [
    '---',
    `name: ${suggestion.skillName}`,
    `description: ${suggestion.reason}`,
    'type: verify',
    'covers:',
    coversYaml,
    '---',
    '',
    '## 검사 항목',
    '',
    checksSection,
    '',
    '## 예외',
    '1. 테스트 파일 (`*.test.ts`, `*.spec.ts`)은 제외',
    '2. 설정 파일 (`*.config.*`)은 구조 변경만 검사',
    '',
  ].join('\n');

  const filePath = join(skillDir, 'SKILL.md');
  writeFileSync(filePath, content, 'utf-8');

  return filePath;
}

/** 기존 verify 스킬의 covers 패턴 추가 */
export function updateVerifySkillCovers(
  skillMeta: VerifySkillMeta,
  newCovers: string[],
): void {
  const content = readFileSync(skillMeta.filePath, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return;

  const fm = fmMatch[1];
  const existingCovers = extractYamlArray(fm, 'covers');
  const mergedCovers = [...new Set([...existingCovers, ...newCovers])];
  const newCoversYaml = mergedCovers.map(c => `  - "${c}"`).join('\n');

  // covers 섹션 교체
  const updatedFm = fm.replace(
    /covers:[\s\S]*?(?=\n\w|\n---)/,
    `covers:\n${newCoversYaml}\n`,
  );

  const updatedContent = content.replace(
    /^---\n[\s\S]*?\n---/,
    `---\n${updatedFm}\n---`,
  );

  writeFileSync(skillMeta.filePath, updatedContent, 'utf-8');
}
