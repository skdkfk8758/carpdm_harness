/**
 * Layer 1: Reachability Validator
 *
 * 시스템 내 모든 연결 고리(Trigger↔Skill↔Tool↔Hook↔Build)의 정합성을 검증합니다.
 * 새 기능 추가 시 연결 누락을 자동 감지합니다.
 *
 * - KNOWN_* 집합: 기존에 알려진 갭 (의도적이거나 추후 수정 예정)
 * - 새 갭 발생 시 테스트 실패 → 연결을 추가하거나 KNOWN_*에 등록
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dirname, '..');

// === 데이터 로더 ===

function loadTriggersSkills(): string[] {
  const triggersPath = join(PROJECT_ROOT, 'templates', 'triggers.json');
  if (!existsSync(triggersPath)) return [];
  const data = JSON.parse(readFileSync(triggersPath, 'utf-8'));
  const skills = new Set<string>();
  for (const trigger of data.triggers || []) {
    if (trigger.skill) skills.add(trigger.skill);
  }
  return [...skills];
}

function loadSkillDirs(): string[] {
  const skillsDir = join(PROJECT_ROOT, 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);
}

function loadRegisteredToolFiles(): string[] {
  const indexPath = join(PROJECT_ROOT, 'src', 'tools', 'index.ts');
  const content = readFileSync(indexPath, 'utf-8');
  const matches = content.matchAll(/from\s+'\.\/([^']+)\.js'/g);
  return [...matches].map(m => m[1]);
}

function loadHookScriptNames(): string[] {
  const hooksJsonPath = join(PROJECT_ROOT, 'hooks', 'hooks.json');
  const data = JSON.parse(readFileSync(hooksJsonPath, 'utf-8'));
  const names = new Set<string>();
  for (const entries of Object.values(data.hooks) as Array<Array<{ hooks: Array<{ command: string }> }>>) {
    for (const entry of entries) {
      for (const hook of entry.hooks || []) {
        const match = hook.command.match(/run-hook\.sh"\s+(\S+)/);
        if (match) names.add(match[1]);
      }
    }
  }
  return [...names];
}

function loadTsupHookEntries(): string[] {
  const tsupPath = join(PROJECT_ROOT, 'tsup.config.ts');
  const content = readFileSync(tsupPath, 'utf-8');
  const matches = content.matchAll(/src\/hooks\/([^'"]+)\.ts/g);
  return [...matches].map(m => m[1]);
}

function loadConfigFields(): string[] {
  const configPath = join(PROJECT_ROOT, 'src', 'types', 'config.ts');
  const content = readFileSync(configPath, 'utf-8');
  // HarnessConfig 인터페이스 내부 필드 추출
  const interfaceMatch = content.match(/export interface HarnessConfig \{([^}]+)\}/s);
  if (!interfaceMatch) return [];
  const fields: string[] = [];
  const fieldRegex = /^\s+(\w+)\??:/gm;
  let match;
  while ((match = fieldRegex.exec(interfaceMatch[1])) !== null) {
    fields.push(match[1]);
  }
  return fields;
}

function searchFieldInDirRecursive(dirPath: string, field: string): boolean {
  if (!existsSync(dirPath)) return false;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (searchFieldInDirRecursive(fullPath, field)) return true;
      } else if (entry.name.endsWith('.json') || entry.name.endsWith('.sh') || entry.name.endsWith('.ts')) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (content.includes(field)) return true;
        } catch { /* 무시 */ }
      }
    }
  } catch { /* 무시 */ }
  return false;
}

// === 알려진 갭 (의도적이거나 추후 수정 예정) ===

/** trigger가 참조하지만 skills/ 디렉토리가 없는 skill — prompt-enricher 컨텍스트 주입용 */
const KNOWN_TRIGGER_SKILL_GAPS = new Set([
  'plan-gate',      // prompt-enricher에서 직접 컨텍스트 생성
  'work-start',     // prompt-enricher에서 직접 컨텍스트 생성
  'work-finish',    // prompt-enricher에서 직접 컨텍스트 생성
  'logical-commit', // prompt-enricher에서 직접 컨텍스트 생성
]);

/** skill은 있지만 대응 tool이 없는 경우 — 순수 instruction skill 또는 상위 tool의 하위 액션 */
const KNOWN_SKILL_WITHOUT_TOOL = new Set([
  'scaffold',         // tool 미구현 (Phase 2 예정)
  'branch-cleanup',   // 순수 instruction skill (git 명령 안내)
  'design-guide',     // 순수 instruction skill (디자인 시스템 가이드)
  'workflow-advance',  // harness_workflow action="advance"의 convenience wrapper
  'workflow-start',    // harness_workflow action="start"의 convenience wrapper
  'workflow-status',   // harness_workflow action="status"의 convenience wrapper
]);

/** tool은 있지만 skill wrapper가 없는 경우 */
const KNOWN_TOOL_WITHOUT_SKILL = new Set([
  'github-setup', // 도구 직접 호출 전용 (Phase 2에서 skill 추가 예정)
  'bug-report',   // 도구 직접 호출 전용
]);

/** config에 선언되었지만 코드에서 읽지 않는 필드 */
const KNOWN_DEAD_CONFIG_FIELDS = new Set([
  'pluginVersion',      // 추후 버전 체크에 사용 예정
  'lastPluginUpdateAt', // 추후 업데이트 알림에 사용 예정
  'workflowEngine',     // HarnessConfig에 선언만, engine은 DEFAULT_ENGINE_CONFIG 직접 사용
]);

// === 테스트 ===

describe('Reachability: Trigger → Skill', () => {
  it('triggers.json의 모든 skill이 skills/ 디렉토리에 존재하거나 알려진 갭이어야 한다', () => {
    const triggerSkills = loadTriggersSkills();
    const skillDirs = new Set(loadSkillDirs());
    const unknownGaps: string[] = [];

    for (const skill of triggerSkills) {
      if (!skillDirs.has(skill) && !KNOWN_TRIGGER_SKILL_GAPS.has(skill)) {
        unknownGaps.push(skill);
      }
    }

    expect(unknownGaps, `새로운 Trigger→Skill 연결 누락: ${unknownGaps.join(', ')}`).toEqual([]);
  });

  it('알려진 갭이 해결되었으면 KNOWN_TRIGGER_SKILL_GAPS에서 제거해야 한다', () => {
    const skillDirs = new Set(loadSkillDirs());
    const resolved: string[] = [];

    for (const gap of KNOWN_TRIGGER_SKILL_GAPS) {
      if (skillDirs.has(gap)) {
        resolved.push(gap);
      }
    }

    expect(resolved, `해결된 갭을 KNOWN_TRIGGER_SKILL_GAPS에서 제거하세요: ${resolved.join(', ')}`).toEqual([]);
  });
});

describe('Reachability: Skill → Tool', () => {
  it('모든 skill 디렉토리가 대응하는 tool을 가지거나 알려진 예외여야 한다', () => {
    const skillDirs = loadSkillDirs();
    const toolFiles = new Set(loadRegisteredToolFiles());
    const unknownGaps: string[] = [];

    for (const skill of skillDirs) {
      if (!toolFiles.has(skill) && !KNOWN_SKILL_WITHOUT_TOOL.has(skill)) {
        unknownGaps.push(skill);
      }
    }

    expect(unknownGaps, `새로운 Skill→Tool 연결 누락: ${unknownGaps.join(', ')}`).toEqual([]);
  });
});

describe('Reachability: Tool → Skill', () => {
  it('모든 등록된 tool이 skill wrapper를 가지거나 알려진 예외여야 한다', () => {
    const toolFiles = loadRegisteredToolFiles();
    const skillDirs = new Set(loadSkillDirs());
    const unknownGaps: string[] = [];

    for (const tool of toolFiles) {
      if (!skillDirs.has(tool) && !KNOWN_TOOL_WITHOUT_SKILL.has(tool)) {
        unknownGaps.push(tool);
      }
    }

    expect(unknownGaps, `새로운 Tool→Skill 연결 누락: ${unknownGaps.join(', ')}`).toEqual([]);
  });
});

describe('Reachability: Hook → Build', () => {
  it('hooks.json의 모든 hook script가 tsup entry에 존재해야 한다', () => {
    const hookScripts = loadHookScriptNames();
    const tsupEntries = new Set(loadTsupHookEntries());
    const missing: string[] = [];

    for (const script of hookScripts) {
      if (!tsupEntries.has(script)) {
        missing.push(script);
      }
    }

    expect(missing, `hooks.json에 등록되었지만 tsup entry 없음: ${missing.join(', ')}`).toEqual([]);
  });

  it('tsup의 모든 hook entry가 hooks.json에 등록되어야 한다', () => {
    const tsupEntries = loadTsupHookEntries();
    const hookScripts = new Set(loadHookScriptNames());
    const unregistered: string[] = [];

    for (const entry of tsupEntries) {
      if (!hookScripts.has(entry)) {
        unregistered.push(entry);
      }
    }

    expect(unregistered, `tsup에 빌드되지만 hooks.json에 미등록: ${unregistered.join(', ')}`).toEqual([]);
  });
});

describe('Reachability: Config 필드 활용도', () => {
  it('HarnessConfig의 모든 필드가 코드에서 참조되거나 알려진 미사용 필드여야 한다', () => {
    const fields = loadConfigFields();
    const srcDir = join(PROJECT_ROOT, 'src');
    const unusedFields: string[] = [];

    for (const field of fields) {
      if (KNOWN_DEAD_CONFIG_FIELDS.has(field)) continue;

      // src/ 전체에서 필드명 참조 검색 (config.ts 자체와 types/ 제외)
      let found = false;
      const dirs = ['core', 'hooks', 'tools'];
      for (const dir of dirs) {
        const dirPath = join(srcDir, dir);
        if (!existsSync(dirPath)) continue;
        try {
          const files = readdirSync(dirPath).filter(f => f.endsWith('.ts'));
          for (const file of files) {
            const content = readFileSync(join(dirPath, file), 'utf-8');
            // 필드가 .field 또는 ['field'] 형태로 참조되는지
            if (content.includes(`.${field}`) || content.includes(`'${field}'`) || content.includes(`"${field}"`)) {
              found = true;
              break;
            }
          }
        } catch { /* 디렉토리 읽기 실패 무시 */ }
        if (found) break;
      }

      // templates/ 등 비-소스 파일에서도 재귀 검색
      if (!found) {
        found = searchFieldInDirRecursive(join(PROJECT_ROOT, 'templates'), field);
      }

      if (!found) unusedFields.push(field);
    }

    expect(unusedFields, `코드에서 참조되지 않는 config 필드: ${unusedFields.join(', ')}`).toEqual([]);
  });

  it('알려진 미사용 필드가 활용되면 KNOWN_DEAD_CONFIG_FIELDS에서 제거해야 한다', () => {
    const srcDir = join(PROJECT_ROOT, 'src');
    const resolved: string[] = [];

    for (const field of KNOWN_DEAD_CONFIG_FIELDS) {
      const dirs = ['core', 'hooks', 'tools'];
      for (const dir of dirs) {
        const dirPath = join(srcDir, dir);
        if (!existsSync(dirPath)) continue;
        try {
          const files = readdirSync(dirPath).filter(f => f.endsWith('.ts'));
          for (const file of files) {
            const content = readFileSync(join(dirPath, file), 'utf-8');
            if (content.includes(`.${field}`)) {
              resolved.push(field);
              break;
            }
          }
        } catch { /* 무시 */ }
      }
    }

    expect(resolved, `해결된 필드를 KNOWN_DEAD_CONFIG_FIELDS에서 제거하세요: ${resolved.join(', ')}`).toEqual([]);
  });
});
