import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyOverlapChoices } from '../src/core/overlap-applier.js';
import type { OverlapScanResult, OverlapChoices } from '../src/types/overlap.js';

function writeSettings(testDir: string, allow: string[], deny: string[] = []): void {
  const settingsDir = join(testDir, '.claude');
  mkdirSync(settingsDir, { recursive: true });
  writeFileSync(
    join(settingsDir, 'settings.local.json'),
    JSON.stringify({ permissions: { allow, deny, ask: [] } }),
  );
}

function readSettings(testDir: string): { permissions: { allow: string[]; deny: string[]; ask: string[] } } {
  const content = readFileSync(join(testDir, '.claude', 'settings.local.json'), 'utf-8');
  return JSON.parse(content) as { permissions: { allow: string[]; deny: string[]; ask: string[] } };
}

describe('overlap-applier', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-applier-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // ─── disable 액션 ───
  describe('disable 액션', () => {
    it('allow에서 제거 + deny에 추가', () => {
      const tools = [
        'mcp__plugin_oh-my-claudecode_t__lsp_hover',
        'mcp__plugin_oh-my-claudecode_t__lsp_goto_definition',
      ];
      writeSettings(testDir, ['Read', ...tools, 'Write']);

      const scanResult: OverlapScanResult = {
        totalOverlaps: 1,
        items: [{
          id: 'lsp-tools',
          category: 'lsp-tools',
          severity: 'high',
          title: 'OMC LSP ↔ Serena 중복',
          description: '테스트',
          affectedItems: tools,
          recommended: 'disable',
        }],
      };

      const choices: OverlapChoices = {
        decisions: { 'lsp-tools': 'disable' },
      };

      const result = applyOverlapChoices(testDir, scanResult, choices);

      expect(result.applied).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toEqual([]);

      const settings = readSettings(testDir);
      expect(settings.permissions.allow).not.toContain('mcp__plugin_oh-my-claudecode_t__lsp_hover');
      expect(settings.permissions.allow).not.toContain('mcp__plugin_oh-my-claudecode_t__lsp_goto_definition');
      expect(settings.permissions.allow).toContain('Read');
      expect(settings.permissions.allow).toContain('Write');
      expect(settings.permissions.deny).toContain('mcp__plugin_oh-my-claudecode_t__lsp_hover');
      expect(settings.permissions.deny).toContain('mcp__plugin_oh-my-claudecode_t__lsp_goto_definition');
    });
  });

  // ─── delete 액션 (빈 규칙 파일) ───
  describe('delete 액션 (empty-rules)', () => {
    it('빈 규칙 파일 삭제', () => {
      writeSettings(testDir, []);
      const rulesDir = join(testDir, '.claude', 'rules');
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(join(rulesDir, 'bugs.md'), '# 빈 파일\n');
      writeFileSync(join(rulesDir, 'decisions.md'), '# 빈 파일\n');

      const scanResult: OverlapScanResult = {
        totalOverlaps: 1,
        items: [{
          id: 'empty-rules',
          category: 'empty-rules',
          severity: 'low',
          title: '빈 규칙 파일 2개',
          description: '테스트',
          affectedItems: ['.claude/rules/bugs.md', '.claude/rules/decisions.md'],
          recommended: 'delete',
        }],
      };

      const choices: OverlapChoices = {
        decisions: { 'empty-rules': 'delete' },
      };

      const result = applyOverlapChoices(testDir, scanResult, choices);

      expect(result.applied).toBe(1);
      expect(existsSync(join(rulesDir, 'bugs.md'))).toBe(false);
      expect(existsSync(join(rulesDir, 'decisions.md'))).toBe(false);
    });
  });

  // ─── delete 액션 (bloated-permissions) ───
  describe('delete 액션 (bloated-permissions)', () => {
    it('중복 allow 항목 제거 (deny 추가 안 함)', () => {
      const redundant = ['Bash(git add file.ts)', 'Bash(git commit -m "fix")'];
      writeSettings(testDir, ['Bash(git add:*)', ...redundant, 'Bash(git commit:*)']);

      const scanResult: OverlapScanResult = {
        totalOverlaps: 1,
        items: [{
          id: 'bloated-permissions',
          category: 'bloated-permissions',
          severity: 'medium',
          title: '중복 allow 항목 2개',
          description: '테스트',
          affectedItems: redundant,
          recommended: 'delete',
        }],
      };

      const choices: OverlapChoices = {
        decisions: { 'bloated-permissions': 'delete' },
      };

      const result = applyOverlapChoices(testDir, scanResult, choices);

      expect(result.applied).toBe(1);
      const settings = readSettings(testDir);
      expect(settings.permissions.allow).toContain('Bash(git add:*)');
      expect(settings.permissions.allow).toContain('Bash(git commit:*)');
      expect(settings.permissions.allow).not.toContain('Bash(git add file.ts)');
      expect(settings.permissions.allow).not.toContain('Bash(git commit -m "fix")');
      // deny에 추가되지 않아야 함
      expect(settings.permissions.deny).not.toContain('Bash(git add file.ts)');
    });
  });

  // ─── keep 액션 ───
  describe('keep 액션', () => {
    it('변경 없음', () => {
      const tools = ['mcp__plugin_oh-my-claudecode_t__notepad_read'];
      writeSettings(testDir, tools);

      const scanResult: OverlapScanResult = {
        totalOverlaps: 1,
        items: [{
          id: 'notepad-tools',
          category: 'notepad-tools',
          severity: 'low',
          title: 'Notepad 도구',
          description: '테스트',
          affectedItems: tools,
          recommended: 'keep',
        }],
      };

      const choices: OverlapChoices = {
        decisions: { 'notepad-tools': 'keep' },
      };

      const result = applyOverlapChoices(testDir, scanResult, choices);

      expect(result.skipped).toBe(1);
      expect(result.applied).toBe(0);
      const settings = readSettings(testDir);
      expect(settings.permissions.allow).toContain('mcp__plugin_oh-my-claudecode_t__notepad_read');
    });
  });

  // ─── applyDefaults ───
  describe('applyDefaults', () => {
    it('모든 항목에 권장 액션 적용', () => {
      const lspTools = ['mcp__plugin_oh-my-claudecode_t__lsp_hover'];
      const notepadTools = ['mcp__plugin_oh-my-claudecode_t__notepad_read'];
      writeSettings(testDir, [...lspTools, ...notepadTools]);

      const scanResult: OverlapScanResult = {
        totalOverlaps: 2,
        items: [
          {
            id: 'lsp-tools',
            category: 'lsp-tools',
            severity: 'high',
            title: 'LSP 중복',
            description: '테스트',
            affectedItems: lspTools,
            recommended: 'disable',  // → disable 적용 예상
          },
          {
            id: 'notepad-tools',
            category: 'notepad-tools',
            severity: 'low',
            title: 'Notepad',
            description: '테스트',
            affectedItems: notepadTools,
            recommended: 'keep',  // → keep 예상
          },
        ],
      };

      const choices: OverlapChoices = {
        decisions: {},
        applyDefaults: true,
      };

      const result = applyOverlapChoices(testDir, scanResult, choices);

      expect(result.applied).toBe(1);  // lsp-tools만 disable
      expect(result.skipped).toBe(1);  // notepad-tools는 keep
      const settings = readSettings(testDir);
      expect(settings.permissions.deny).toContain('mcp__plugin_oh-my-claudecode_t__lsp_hover');
      expect(settings.permissions.allow).toContain('mcp__plugin_oh-my-claudecode_t__notepad_read');
    });
  });

  // ─── 결정 없는 항목은 keep으로 처리 ───
  describe('결정 누락 시 기본 동작', () => {
    it('decisions에 없는 항목은 keep으로 처리', () => {
      writeSettings(testDir, ['mcp__plugin_oh-my-claudecode_t__lsp_hover']);

      const scanResult: OverlapScanResult = {
        totalOverlaps: 1,
        items: [{
          id: 'lsp-tools',
          category: 'lsp-tools',
          severity: 'high',
          title: 'LSP',
          description: '테스트',
          affectedItems: ['mcp__plugin_oh-my-claudecode_t__lsp_hover'],
          recommended: 'disable',
        }],
      };

      const choices: OverlapChoices = { decisions: {} };  // lsp-tools에 대한 결정 없음

      const result = applyOverlapChoices(testDir, scanResult, choices);

      expect(result.skipped).toBe(1);
      expect(result.applied).toBe(0);
    });
  });
});
