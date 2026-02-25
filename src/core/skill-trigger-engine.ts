/**
 * 스킬 트리거 엔진
 *
 * triggers.json 매니페스트를 읽어 프롬프트 키워드 매칭을 수행합니다.
 * prompt-enricher 훅에서 사용됩니다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ───── Types ─────

export interface TriggerRule {
  id: string;
  mode: 'force' | 'suggest';
  branch: 'main' | 'feature' | 'any';
  patterns?: string[];
  allOf?: string[];
  anyOf?: string[];
  noneOf?: string[];
  condition?: string;
  message?: string;
}

export interface TriggerEntry {
  skill: string;
  rules: TriggerRule[];
}

export interface TriggerManifest {
  version: string;
  keywordGroups: Record<string, string[]>;
  triggers: TriggerEntry[];
}

export interface TriggerMatch {
  skill: string;
  rule: TriggerRule;
  extracts: Record<string, string>;
}

export interface MatchContext {
  prompt: string;
  branch: string | null;
  conditions: Record<string, boolean>;
}

// ───── Loader ─────

/**
 * .harness/triggers.json + .harness/custom-triggers.json를 로드 · 병합합니다.
 * 파일 없거나 파싱 실패 시 빈 매니페스트 반환 (graceful).
 */
export function loadTriggers(projectRoot: string): TriggerManifest {
  const empty: TriggerManifest = { version: '1.0', keywordGroups: {}, triggers: [] };

  const basePath = join(projectRoot, '.harness', 'triggers.json');
  const base = loadManifestFile(basePath);

  const customPath = join(projectRoot, '.harness', 'custom-triggers.json');
  const custom = loadManifestFile(customPath);

  if (!base && !custom) return empty;
  if (!custom) return base ?? empty;
  if (!base) return custom;

  // 병합: custom의 keywordGroups와 triggers를 base에 추가
  return {
    version: base.version,
    keywordGroups: { ...base.keywordGroups, ...custom.keywordGroups },
    triggers: [...base.triggers, ...custom.triggers],
  };
}

function loadManifestFile(filePath: string): TriggerManifest | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as TriggerManifest;
  } catch {
    return null;
  }
}

// ───── Matcher ─────

/**
 * sanitize된 프롬프트에 대해 트리거 매칭을 수행합니다.
 * first-match-wins: triggers 배열 순서대로 검사하여 첫 매치를 반환합니다.
 */
export function matchTriggers(
  manifest: TriggerManifest,
  ctx: MatchContext,
): TriggerMatch | null {
  const { prompt, branch, conditions } = ctx;
  const cleanPrompt = prompt.toLowerCase();

  for (const entry of manifest.triggers) {
    for (const rule of entry.rules) {
      if (matchRule(rule, cleanPrompt, branch, conditions, manifest.keywordGroups)) {
        const extracts = extractPlaceholders(cleanPrompt, manifest.keywordGroups);
        if (branch) extracts.branch = branch;
        return { skill: entry.skill, rule, extracts };
      }
    }
  }

  return null;
}

function matchRule(
  rule: TriggerRule,
  prompt: string,
  branch: string | null,
  conditions: Record<string, boolean>,
  groups: Record<string, string[]>,
): boolean {
  // 1. 브랜치 조건
  if (!matchBranch(rule.branch, branch)) return false;

  // 2. 특수 조건
  if (rule.condition && !conditions[rule.condition]) return false;

  // 3. noneOf: 이 그룹이 하나라도 매치하면 불통과
  if (rule.noneOf) {
    for (const groupName of rule.noneOf) {
      if (matchGroup(groupName, prompt, groups)) return false;
    }
  }

  // 4. patterns: 직접 정규식 매칭 (하나라도 매치하면 통과)
  if (rule.patterns && rule.patterns.length > 0) {
    return rule.patterns.some(p => {
      try {
        return new RegExp(p, 'i').test(prompt);
      } catch {
        return false;
      }
    });
  }

  // 5. allOf: 모든 keywordGroup이 매치해야 통과
  if (rule.allOf && rule.allOf.length > 0) {
    const allMatch = rule.allOf.every(groupName => matchGroup(groupName, prompt, groups));
    if (!allMatch) return false;

    // anyOf도 있으면 추가 검사
    if (rule.anyOf && rule.anyOf.length > 0) {
      return rule.anyOf.some(groupName => matchGroup(groupName, prompt, groups));
    }

    return true;
  }

  // 6. anyOf만 있으면: 하나라도 매치하면 통과
  if (rule.anyOf && rule.anyOf.length > 0) {
    return rule.anyOf.some(groupName => matchGroup(groupName, prompt, groups));
  }

  return false;
}

function matchBranch(ruleBranch: string, currentBranch: string | null): boolean {
  if (ruleBranch === 'any') return true;
  if (!currentBranch) return ruleBranch === 'any';

  const isMain = currentBranch === 'main' || currentBranch === 'master'
    || currentBranch === 'develop' || currentBranch === 'dev';

  if (ruleBranch === 'main') return isMain;
  if (ruleBranch === 'feature') return !isMain;

  return false;
}

function matchGroup(
  groupName: string,
  prompt: string,
  groups: Record<string, string[]>,
): boolean {
  const patterns = groups[groupName];
  if (!patterns || patterns.length === 0) return false;

  return patterns.some(p => {
    try {
      return new RegExp(p, 'i').test(prompt);
    } catch {
      return false;
    }
  });
}

/**
 * keywordGroup에서 플레이스홀더용 값을 추출합니다.
 * 예: issue 그룹의 "#\\d+" 패턴 → 매치된 "#42" 반환
 */
function extractPlaceholders(
  prompt: string,
  groups: Record<string, string[]>,
): Record<string, string> {
  const extracts: Record<string, string> = {};

  for (const [name, patterns] of Object.entries(groups)) {
    for (const p of patterns) {
      try {
        const match = new RegExp(p, 'i').exec(prompt);
        if (match) {
          extracts[name] = match[0];
          break;
        }
      } catch {
        // 무시
      }
    }
  }

  return extracts;
}

/**
 * message 템플릿의 {placeholder}를 extracts 값으로 대체합니다.
 */
export function resolveMessage(template: string, extracts: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => extracts[key] ?? '');
}
