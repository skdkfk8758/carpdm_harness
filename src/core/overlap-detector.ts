/**
 * 중복 감지 코어 로직
 *
 * 프로젝트 상태 + capabilities를 분석하여 도구 중복, 빈 규칙 파일,
 * 비대한 권한 목록 등을 식별합니다.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessConfig } from '../types/config.js';
import type { CapabilityResult } from '../types/capabilities.js';
import type { OverlapItem, OverlapScanResult } from '../types/overlap.js';

// ============================================================
// OMC 도구 상수
// ============================================================

/** OMC LSP 코드 인텔리전스 도구 — Serena가 있으면 중복 */
export const OMC_LSP_TOOLS = [
  'mcp__plugin_oh-my-claudecode_t__lsp_hover',
  'mcp__plugin_oh-my-claudecode_t__lsp_goto_definition',
  'mcp__plugin_oh-my-claudecode_t__lsp_find_references',
  'mcp__plugin_oh-my-claudecode_t__lsp_document_symbols',
  'mcp__plugin_oh-my-claudecode_t__lsp_workspace_symbols',
  'mcp__plugin_oh-my-claudecode_t__lsp_diagnostics',
  'mcp__plugin_oh-my-claudecode_t__lsp_diagnostics_directory',
  'mcp__plugin_oh-my-claudecode_t__lsp_servers',
  'mcp__plugin_oh-my-claudecode_t__lsp_prepare_rename',
  'mcp__plugin_oh-my-claudecode_t__lsp_rename',
  'mcp__plugin_oh-my-claudecode_t__lsp_code_actions',
  'mcp__plugin_oh-my-claudecode_t__lsp_code_action_resolve',
] as const;

/** OMC Notepad 도구 */
export const OMC_NOTEPAD_TOOLS = [
  'mcp__plugin_oh-my-claudecode_t__notepad_read',
  'mcp__plugin_oh-my-claudecode_t__notepad_write_priority',
  'mcp__plugin_oh-my-claudecode_t__notepad_write_working',
  'mcp__plugin_oh-my-claudecode_t__notepad_write_manual',
  'mcp__plugin_oh-my-claudecode_t__notepad_prune',
  'mcp__plugin_oh-my-claudecode_t__notepad_stats',
] as const;

/** OMC Project Memory 도구 */
export const OMC_MEMORY_TOOLS = [
  'mcp__plugin_oh-my-claudecode_t__project_memory_read',
  'mcp__plugin_oh-my-claudecode_t__project_memory_write',
  'mcp__plugin_oh-my-claudecode_t__project_memory_add_note',
  'mcp__plugin_oh-my-claudecode_t__project_memory_add_directive',
] as const;

/** OMC Python REPL 도구 */
export const OMC_PYTHON_REPL_TOOL = 'mcp__plugin_oh-my-claudecode_t__python_repl';

/** team-memory 모듈이 관리하는 규칙 파일 */
const TEAM_MEMORY_RULE_FILES = ['bugs.md', 'mistakes.md', 'decisions.md'] as const;

// ============================================================
// 스캔 함수
// ============================================================

/**
 * 프로젝트의 중복/불필요 항목을 스캔합니다.
 */
export function scanOverlaps(
  projectRoot: string,
  config: HarnessConfig | null,
  capabilities: CapabilityResult,
): OverlapScanResult {
  const items: OverlapItem[] = [];

  const allowList = loadAllowList(projectRoot);
  const hasTeamMemory = config?.modules?.includes('team-memory') ?? false;

  // 1. LSP 도구 중복: Serena 감지됨 + OMC LSP 도구가 allow에 존재
  if (capabilities.tools.serena.detected) {
    const overlapping = OMC_LSP_TOOLS.filter(t => allowList.includes(t));
    if (overlapping.length > 0) {
      items.push({
        id: 'lsp-tools',
        category: 'lsp-tools',
        severity: 'high',
        title: 'OMC LSP ↔ Serena 중복',
        description:
          'Serena가 동일한 LSP 기능(hover, goto definition, find references 등)을 제공합니다. ' +
          'OMC LSP 도구를 비활성화하면 에이전트 컨텍스트를 절약할 수 있습니다.',
        affectedItems: [...overlapping],
        recommended: 'disable',
      });
    }
  }

  // 2. Memory 도구 중복: team-memory 모듈 + OMC project_memory
  if (hasTeamMemory) {
    const overlapping = OMC_MEMORY_TOOLS.filter(t => allowList.includes(t));
    if (overlapping.length > 0) {
      items.push({
        id: 'memory-tools',
        category: 'memory-tools',
        severity: 'medium',
        title: 'OMC Project Memory ↔ harness team-memory 중복',
        description:
          'harness team-memory 모듈이 .claude/rules/에서 팀 메모리를 관리합니다. ' +
          'OMC project_memory 도구와 기능이 겹칩니다.',
        affectedItems: [...overlapping],
        recommended: 'disable',
      });
    }
  }

  // 3. Notepad 도구: .agent/ 존재 + harness memory 사용 중
  if (hasTeamMemory && existsSync(join(projectRoot, '.agent'))) {
    const overlapping = OMC_NOTEPAD_TOOLS.filter(t => allowList.includes(t));
    if (overlapping.length > 0) {
      items.push({
        id: 'notepad-tools',
        category: 'notepad-tools',
        severity: 'low',
        title: 'OMC Notepad ↔ .agent/ 메모리 병행',
        description:
          'OMC Notepad와 .agent/ 메모리가 모두 활성화되어 있습니다. ' +
          '둘 다 유용할 수 있으므로 기본 권장은 유지입니다.',
        affectedItems: [...overlapping],
        recommended: 'keep',
      });
    }
  }

  // 4. 빈 규칙 파일: team-memory 모듈 + 규칙 파일에 항목 없음
  if (hasTeamMemory) {
    const emptyFiles: string[] = [];
    for (const file of TEAM_MEMORY_RULE_FILES) {
      const filePath = join(projectRoot, '.claude', 'rules', file);
      if (existsSync(filePath)) {
        const content = readFileSafe(filePath);
        if (content !== null) {
          const entryCount = (content.match(/^### /gm) || []).length;
          if (entryCount === 0) {
            emptyFiles.push(`.claude/rules/${file}`);
          }
        }
      }
    }
    if (emptyFiles.length > 0) {
      items.push({
        id: 'empty-rules',
        category: 'empty-rules',
        severity: 'low',
        title: `빈 규칙 파일 ${emptyFiles.length}개`,
        description:
          '항목이 없는 규칙 파일이 에이전트 컨텍스트를 차지하고 있습니다. ' +
          '삭제하면 컨텍스트를 절약할 수 있습니다.',
        affectedItems: emptyFiles,
        recommended: 'delete',
      });
    }
  }

  // 5. Python REPL: OMC 감지 + python_repl allow
  if (capabilities.omc.installed && allowList.includes(OMC_PYTHON_REPL_TOOL)) {
    items.push({
      id: 'python-repl',
      category: 'python-repl',
      severity: 'low',
      title: 'OMC Python REPL 활성화됨',
      description:
        'python_repl 도구가 활성화되어 있습니다. Bash로도 Python을 실행할 수 있으므로 ' +
        '필요하지 않다면 비활성화할 수 있습니다.',
      affectedItems: [OMC_PYTHON_REPL_TOOL],
      recommended: 'keep',
    });
  }

  // 6. 비대한 권한 목록: 와일드카드로 이미 커버되는 구체적 명령
  const redundantRules = findRedundantRules(allowList);
  if (redundantRules.length > 0) {
    items.push({
      id: 'bloated-permissions',
      category: 'bloated-permissions',
      severity: 'medium',
      title: `중복 allow 항목 ${redundantRules.length}개`,
      description:
        '와일드카드 패턴으로 이미 허용된 구체적 명령이 개별 등록되어 있습니다. ' +
        '삭제하면 settings 파일이 깔끔해집니다.',
      affectedItems: redundantRules,
      recommended: 'delete',
    });
  }

  return {
    totalOverlaps: items.length,
    items,
  };
}

// ============================================================
// 인터뷰 렌더링
// ============================================================

const SEVERITY_LABEL: Record<string, string> = {
  high: '[높음]',
  medium: '[중간]',
  low: '[낮음]',
};

const ACTION_LABEL: Record<string, string> = {
  disable: 'allow에서 제거 + deny에 추가',
  delete: '삭제',
  keep: '유지 (변경 없음)',
};

/**
 * McpResponseBuilder에 추가할 인터뷰 마크다운을 생성합니다.
 */
export function renderOverlapInterview(result: OverlapScanResult): string {
  if (result.items.length === 0) return '';

  const lines: string[] = [];

  for (const item of result.items) {
    lines.push(`### ${SEVERITY_LABEL[item.severity]} ${item.title}`);
    lines.push(item.description);
    lines.push('');
    lines.push(`  영향 항목: ${item.affectedItems.length}개`);
    for (const affected of item.affectedItems.slice(0, 5)) {
      lines.push(`    - ${affected}`);
    }
    if (item.affectedItems.length > 5) {
      lines.push(`    - ... 외 ${item.affectedItems.length - 5}개`);
    }
    lines.push(`  권장: **${ACTION_LABEL[item.recommended]}**`);
    lines.push(`  선택: overlapChoices.decisions["${item.id}"] = "disable" | "keep" | "delete"`);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 내부 헬퍼
// ============================================================

/**
 * settings.local.json에서 allow 목록을 로드합니다.
 */
function loadAllowList(projectRoot: string): string[] {
  const settingsPath = join(projectRoot, '.claude', 'settings.local.json');
  const content = readFileSafe(settingsPath);
  if (!content) return [];

  try {
    const settings = JSON.parse(content) as { permissions?: { allow?: string[] } };
    return settings.permissions?.allow ?? [];
  } catch {
    return [];
  }
}

/**
 * 와일드카드 패턴으로 이미 커버되는 구체적 allow 항목을 탐지합니다.
 */
export function findRedundantRules(allowList: string[]): string[] {
  // 'Bash(git add:*)' 형태의 와일드카드 패턴 추출
  const wildcards = allowList.filter(r => r.includes(':*)'));
  const specifics = allowList.filter(r => !r.includes(':*)') && r.startsWith('Bash('));

  return specifics.filter(rule => {
    return wildcards.some(wc => {
      // 'Bash(git add:*)' → 'Bash(git add' 접두사 추출
      const prefix = wc.replace(':*)', '');
      return rule.startsWith(prefix);
    });
  });
}

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
