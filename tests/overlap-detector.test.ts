import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanOverlaps, findRedundantRules, renderOverlapInterview } from '../src/core/overlap-detector.js';
import type { CapabilityResult } from '../src/types/capabilities.js';
import type { HarnessConfig } from '../src/types/config.js';
import { DEFAULT_CAPABILITY_RESULT } from '../src/types/capabilities.js';

function makeCapabilities(overrides: Partial<{
  omcInstalled: boolean;
  serena: boolean;
  context7: boolean;
}> = {}): CapabilityResult {
  return {
    omc: { installed: overrides.omcInstalled ?? true },
    tools: {
      serena: { name: 'serena', detected: overrides.serena ?? false },
      context7: { name: 'context7', detected: overrides.context7 ?? false },
      codex: { name: 'codex', detected: false },
      gemini: { name: 'gemini', detected: false },
    },
    detectedAt: new Date().toISOString(),
  };
}

function makeConfig(overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  return {
    version: '4.8.0',
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preset: 'standard',
    modules: ['core', 'team-memory', 'quality', 'ship'],
    globalCommandsInstalled: false,
    options: {
      hooksRegistered: true,
      docsTemplatesDir: 'docs/templates',
      agentDir: '.agent',
    },
    files: {},
    ...overrides,
  };
}

function writeSettings(testDir: string, allow: string[], deny: string[] = []): void {
  const settingsDir = join(testDir, '.claude');
  mkdirSync(settingsDir, { recursive: true });
  writeFileSync(
    join(settingsDir, 'settings.local.json'),
    JSON.stringify({
      permissions: { allow, deny, ask: [] },
    }),
  );
}

describe('overlap-detector', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-overlap-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // ─── LSP 중복 ───
  describe('lsp-tools 감지', () => {
    it('Serena 감지 + OMC LSP allow 시 중복 감지', () => {
      const lspTools = [
        'mcp__plugin_oh-my-claudecode_t__lsp_hover',
        'mcp__plugin_oh-my-claudecode_t__lsp_goto_definition',
      ];
      writeSettings(testDir, lspTools);
      const caps = makeCapabilities({ serena: true });
      const config = makeConfig();

      const result = scanOverlaps(testDir, config, caps);

      expect(result.totalOverlaps).toBeGreaterThanOrEqual(1);
      const lspItem = result.items.find(i => i.category === 'lsp-tools');
      expect(lspItem).toBeDefined();
      expect(lspItem!.severity).toBe('high');
      expect(lspItem!.recommended).toBe('disable');
      expect(lspItem!.affectedItems).toEqual(lspTools);
    });

    it('Serena 미감지 시 LSP 중복 미감지', () => {
      writeSettings(testDir, ['mcp__plugin_oh-my-claudecode_t__lsp_hover']);
      const caps = makeCapabilities({ serena: false });
      const config = makeConfig();

      const result = scanOverlaps(testDir, config, caps);

      const lspItem = result.items.find(i => i.category === 'lsp-tools');
      expect(lspItem).toBeUndefined();
    });

    it('Serena 감지 + OMC LSP allow에 없으면 미감지', () => {
      writeSettings(testDir, ['AskUserQuestion']);
      const caps = makeCapabilities({ serena: true });
      const config = makeConfig();

      const result = scanOverlaps(testDir, config, caps);

      const lspItem = result.items.find(i => i.category === 'lsp-tools');
      expect(lspItem).toBeUndefined();
    });
  });

  // ─── Memory 중복 ───
  describe('memory-tools 감지', () => {
    it('team-memory 모듈 + OMC memory allow 시 중복 감지', () => {
      const memTools = [
        'mcp__plugin_oh-my-claudecode_t__project_memory_read',
        'mcp__plugin_oh-my-claudecode_t__project_memory_write',
      ];
      writeSettings(testDir, memTools);
      const caps = makeCapabilities();
      const config = makeConfig({ modules: ['core', 'team-memory'] });

      const result = scanOverlaps(testDir, config, caps);

      const memItem = result.items.find(i => i.category === 'memory-tools');
      expect(memItem).toBeDefined();
      expect(memItem!.recommended).toBe('disable');
    });

    it('team-memory 없으면 memory 중복 미감지', () => {
      writeSettings(testDir, ['mcp__plugin_oh-my-claudecode_t__project_memory_read']);
      const caps = makeCapabilities();
      const config = makeConfig({ modules: ['core'] });

      const result = scanOverlaps(testDir, config, caps);

      const memItem = result.items.find(i => i.category === 'memory-tools');
      expect(memItem).toBeUndefined();
    });
  });

  // ─── Notepad 중복 ───
  describe('notepad-tools 감지', () => {
    it('team-memory + .agent/ + notepad allow 시 감지 (권장: keep)', () => {
      const notepadTools = ['mcp__plugin_oh-my-claudecode_t__notepad_read'];
      writeSettings(testDir, notepadTools);
      mkdirSync(join(testDir, '.agent'), { recursive: true });
      const caps = makeCapabilities();
      const config = makeConfig({ modules: ['core', 'team-memory'] });

      const result = scanOverlaps(testDir, config, caps);

      const notepadItem = result.items.find(i => i.category === 'notepad-tools');
      expect(notepadItem).toBeDefined();
      expect(notepadItem!.recommended).toBe('keep');
    });

    it('.agent/ 없으면 notepad 미감지', () => {
      writeSettings(testDir, ['mcp__plugin_oh-my-claudecode_t__notepad_read']);
      const caps = makeCapabilities();
      const config = makeConfig({ modules: ['core', 'team-memory'] });

      const result = scanOverlaps(testDir, config, caps);

      const notepadItem = result.items.find(i => i.category === 'notepad-tools');
      expect(notepadItem).toBeUndefined();
    });
  });

  // ─── 빈 규칙 파일 ───
  describe('empty-rules 감지', () => {
    it('항목이 없는 규칙 파일 감지', () => {
      writeSettings(testDir, []);
      const rulesDir = join(testDir, '.claude', 'rules');
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(join(rulesDir, 'bugs.md'), '# 버그 추적\n\n<!-- harness:bugs:list -->\n');
      writeFileSync(join(rulesDir, 'decisions.md'), '# 결정\n\n### ADR-001\n내용');
      const caps = makeCapabilities();
      const config = makeConfig({ modules: ['core', 'team-memory'] });

      const result = scanOverlaps(testDir, config, caps);

      const emptyItem = result.items.find(i => i.category === 'empty-rules');
      expect(emptyItem).toBeDefined();
      expect(emptyItem!.affectedItems).toEqual(['.claude/rules/bugs.md']);
      expect(emptyItem!.recommended).toBe('delete');
    });

    it('모든 규칙 파일에 항목이 있으면 미감지', () => {
      writeSettings(testDir, []);
      const rulesDir = join(testDir, '.claude', 'rules');
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(join(rulesDir, 'bugs.md'), '# 버그\n\n### BUG-001\n내용');
      writeFileSync(join(rulesDir, 'mistakes.md'), '# 실수\n\n### MST-001\n내용');
      writeFileSync(join(rulesDir, 'decisions.md'), '# 결정\n\n### ADR-001\n내용');
      const caps = makeCapabilities();
      const config = makeConfig({ modules: ['core', 'team-memory'] });

      const result = scanOverlaps(testDir, config, caps);

      const emptyItem = result.items.find(i => i.category === 'empty-rules');
      expect(emptyItem).toBeUndefined();
    });

    it('team-memory 없으면 빈 규칙 미감지', () => {
      writeSettings(testDir, []);
      const rulesDir = join(testDir, '.claude', 'rules');
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(join(rulesDir, 'bugs.md'), '# 버그 추적\n\n<!-- list -->\n');
      const caps = makeCapabilities();
      const config = makeConfig({ modules: ['core'] });

      const result = scanOverlaps(testDir, config, caps);

      const emptyItem = result.items.find(i => i.category === 'empty-rules');
      expect(emptyItem).toBeUndefined();
    });
  });

  // ─── Python REPL ───
  describe('python-repl 감지', () => {
    it('OMC + python_repl allow 시 감지 (권장: keep)', () => {
      writeSettings(testDir, ['mcp__plugin_oh-my-claudecode_t__python_repl']);
      const caps = makeCapabilities({ omcInstalled: true });
      const config = makeConfig();

      const result = scanOverlaps(testDir, config, caps);

      const replItem = result.items.find(i => i.category === 'python-repl');
      expect(replItem).toBeDefined();
      expect(replItem!.recommended).toBe('keep');
    });

    it('OMC 미설치 시 미감지', () => {
      writeSettings(testDir, ['mcp__plugin_oh-my-claudecode_t__python_repl']);
      const caps = makeCapabilities({ omcInstalled: false });
      const config = makeConfig();

      const result = scanOverlaps(testDir, config, caps);

      const replItem = result.items.find(i => i.category === 'python-repl');
      expect(replItem).toBeUndefined();
    });
  });

  // ─── bloated-permissions ───
  describe('bloated-permissions 감지', () => {
    it('와일드카드로 커버되는 구체적 명령 감지', () => {
      writeSettings(testDir, [
        'Bash(git add:*)',
        'Bash(git add .claude/agents/team-memory-keeper.md)',
        'Bash(git commit:*)',
        'Bash(git commit -m "fix")',
      ]);
      const caps = makeCapabilities();
      const config = makeConfig();

      const result = scanOverlaps(testDir, config, caps);

      const bloatedItem = result.items.find(i => i.category === 'bloated-permissions');
      expect(bloatedItem).toBeDefined();
      expect(bloatedItem!.affectedItems).toContain('Bash(git add .claude/agents/team-memory-keeper.md)');
      expect(bloatedItem!.affectedItems).toContain('Bash(git commit -m "fix")');
      expect(bloatedItem!.recommended).toBe('delete');
    });

    it('중복 없으면 미감지', () => {
      writeSettings(testDir, ['Bash(git add:*)', 'Bash(npm:*)', 'Read']);
      const caps = makeCapabilities();
      const config = makeConfig();

      const result = scanOverlaps(testDir, config, caps);

      const bloatedItem = result.items.find(i => i.category === 'bloated-permissions');
      expect(bloatedItem).toBeUndefined();
    });
  });

  // ─── settings 없는 경우 ───
  describe('settings.local.json 없는 경우', () => {
    it('settings 파일 없어도 에러 없이 빈 결과 반환', () => {
      const caps = makeCapabilities();
      const config = makeConfig({ modules: ['core'] });

      const result = scanOverlaps(testDir, config, caps);

      expect(result.totalOverlaps).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // ─── config null인 경우 ───
  describe('config가 null인 경우', () => {
    it('config null이어도 에러 없이 스캔 가능', () => {
      writeSettings(testDir, ['mcp__plugin_oh-my-claudecode_t__lsp_hover']);
      const caps = makeCapabilities({ serena: true });

      const result = scanOverlaps(testDir, null, caps);

      // team-memory 종속 항목은 미감지 (config.modules 접근 불가)
      const memItem = result.items.find(i => i.category === 'memory-tools');
      expect(memItem).toBeUndefined();
      // LSP는 config 무관하게 감지
      const lspItem = result.items.find(i => i.category === 'lsp-tools');
      expect(lspItem).toBeDefined();
    });
  });

  // ─── findRedundantRules ───
  describe('findRedundantRules', () => {
    it('와일드카드에 의해 커버되는 규칙을 반환', () => {
      const rules = [
        'Bash(git add:*)',
        'Bash(git add file.ts)',
        'Bash(npm:*)',
        'Bash(npm install lodash)',
        'Read',
      ];

      const redundant = findRedundantRules(rules);

      expect(redundant).toContain('Bash(git add file.ts)');
      expect(redundant).toContain('Bash(npm install lodash)');
      expect(redundant).not.toContain('Read');
    });

    it('와일드카드만 있으면 빈 배열 반환', () => {
      const rules = ['Bash(git add:*)', 'Bash(npm:*)'];
      expect(findRedundantRules(rules)).toEqual([]);
    });

    it('빈 배열이면 빈 배열 반환', () => {
      expect(findRedundantRules([])).toEqual([]);
    });
  });

  // ─── renderOverlapInterview ───
  describe('renderOverlapInterview', () => {
    it('중복 항목이 있으면 마크다운 반환', () => {
      const result = scanOverlaps(testDir, null, DEFAULT_CAPABILITY_RESULT);
      // 빈 결과에 대해 빈 문자열 반환
      expect(renderOverlapInterview(result)).toBe('');
    });

    it('항목이 있으면 각 항목의 제목과 권장 액션 포함', () => {
      writeSettings(testDir, [
        'mcp__plugin_oh-my-claudecode_t__lsp_hover',
        'Bash(git add:*)',
        'Bash(git add file.ts)',
      ]);
      const caps = makeCapabilities({ serena: true });
      const result = scanOverlaps(testDir, null, caps);
      const md = renderOverlapInterview(result);

      expect(md).toContain('OMC LSP');
      expect(md).toContain('권장');
    });
  });
});
