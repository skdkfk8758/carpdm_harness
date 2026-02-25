import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerHooks } from '../src/core/hook-registrar.js';

describe('registerHooks — 신 포맷 생성', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-hook-test-'));
    mkdirSync(join(testDir, '.claude'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function readHooks(): Record<string, unknown[]> {
    const content = readFileSync(join(testDir, '.claude', 'settings.local.json'), 'utf-8');
    return JSON.parse(content).hooks;
  }

  it('should 콜론 없는 이벤트명만 키로 사용한다', () => {
    registerHooks(['core', 'tdd', 'quality', 'security', 'ontology'], testDir);
    const hooks = readHooks();
    const keys = Object.keys(hooks);
    const legacyKeys = keys.filter(k => k.includes(':'));

    expect(legacyKeys).toEqual([]);
    expect(keys).toContain('PreToolUse');
    expect(keys).toContain('PostToolUse');
    expect(keys).toContain('UserPromptSubmit');
    expect(keys).toContain('Stop');
  });

  it('should matcher.tools 배열 구조를 생성한다', () => {
    registerHooks(['core'], testDir);
    const hooks = readHooks();

    // PreToolUse의 Edit|Write matcher 확인
    const preToolUse = hooks['PreToolUse'] as Array<{ matcher?: { tools?: string[] }; hooks?: unknown[] }>;
    const editWriteEntry = preToolUse.find(
      e => e.matcher?.tools && e.matcher.tools.includes('Edit') && e.matcher.tools.includes('Write')
    );
    expect(editWriteEntry).toBeDefined();
    expect(editWriteEntry!.matcher!.tools).toEqual(['Edit', 'Write']);
  });

  it('should 각 항목에 hooks 배열이 존재한다', () => {
    registerHooks(['core'], testDir);
    const hooks = readHooks();

    for (const [, entries] of Object.entries(hooks)) {
      for (const entry of entries as Array<{ hooks?: unknown[] }>) {
        expect(entry.hooks).toBeDefined();
        expect(Array.isArray(entry.hooks)).toBe(true);
        expect(entry.hooks!.length).toBeGreaterThan(0);
      }
    }
  });

  it('should 패턴 없는 훅은 빈 matcher를 가진다', () => {
    registerHooks(['core'], testDir);
    const hooks = readHooks();

    // UserPromptSubmit은 패턴이 없음
    const entries = hooks['UserPromptSubmit'] as Array<{ matcher?: { tools?: string[] } }>;
    expect(entries[0].matcher).toEqual({});
  });

  it('should 동일 패턴의 훅을 하나의 엔트리로 그룹한다', () => {
    // core + tdd 둘 다 PreToolUse Edit|Write 패턴
    registerHooks(['core', 'tdd'], testDir);
    const hooks = readHooks();

    const preToolUse = hooks['PreToolUse'] as Array<{ matcher?: { tools?: string[] }; hooks?: Array<{ command: string }> }>;
    const editWriteEntry = preToolUse.find(
      e => e.matcher?.tools?.includes('Edit')
    );

    // plan-guard.sh (core) + tdd-guard.sh (tdd) 두 명령이 하나의 엔트리에
    expect(editWriteEntry!.hooks!.length).toBe(2);
    const commands = editWriteEntry!.hooks!.map(h => h.command);
    expect(commands).toContain('bash .claude/hooks/plan-guard.sh');
    expect(commands).toContain('bash .claude/hooks/tdd-guard.sh');
  });

  it('should 중복 실행 시 훅이 중복 추가되지 않는다', () => {
    registerHooks(['core'], testDir);
    const result = registerHooks(['core'], testDir);

    expect(result.registered).toBe(0);
    const hooks = readHooks();
    const submit = hooks['UserPromptSubmit'] as Array<{ hooks?: unknown[] }>;
    expect(submit[0].hooks!.length).toBe(1);
  });
});

describe('registerHooks — 구 포맷 마이그레이션', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-hook-migrate-'));
    mkdirSync(join(testDir, '.claude'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function readHooks(): Record<string, unknown[]> {
    const content = readFileSync(join(testDir, '.claude', 'settings.local.json'), 'utf-8');
    return JSON.parse(content).hooks;
  }

  it('should 구 포맷 키를 신 포맷으로 마이그레이션한다', () => {
    // 구 포맷으로 기존 설정 작성
    const oldSettings = {
      hooks: {
        'UserPromptSubmit': [{ type: 'command', command: 'bash .claude/hooks/pre-task.sh' }],
        'PreToolUse:Edit|Write': [
          { type: 'command', command: 'bash .claude/hooks/plan-guard.sh', matcher: 'Edit|Write' },
        ],
        'PreToolUse:Bash': [
          { type: 'command', command: 'bash .claude/hooks/command-guard.sh', matcher: 'Bash' },
        ],
        'Stop': [{ type: 'command', command: 'bash .claude/hooks/post-task.sh' }],
      },
    };
    writeFileSync(
      join(testDir, '.claude', 'settings.local.json'),
      JSON.stringify(oldSettings, null, 2),
    );

    registerHooks(['core'], testDir);
    const hooks = readHooks();

    // 콜론 키가 전부 제거되었는지
    const keys = Object.keys(hooks);
    expect(keys.filter(k => k.includes(':'))).toEqual([]);

    // 마이그레이션된 항목이 신 포맷인지
    const preToolUse = hooks['PreToolUse'] as Array<{ matcher?: { tools?: string[] }; hooks?: Array<{ command: string }> }>;
    expect(preToolUse.length).toBeGreaterThanOrEqual(2); // Edit|Write + Bash

    const editEntry = preToolUse.find(e => e.matcher?.tools?.includes('Edit'));
    expect(editEntry).toBeDefined();
    expect(editEntry!.hooks).toBeDefined();
    expect(editEntry!.hooks!.some(h => h.command === 'bash .claude/hooks/plan-guard.sh')).toBe(true);

    const bashEntry = preToolUse.find(e => e.matcher?.tools?.includes('Bash'));
    expect(bashEntry).toBeDefined();
    expect(bashEntry!.hooks!.some(h => h.command === 'bash .claude/hooks/command-guard.sh')).toBe(true);
  });

  it('should 마이그레이션 시 기존 신 포맷 엔트리와 병합한다', () => {
    // 신 포맷 + 구 포맷 혼재
    const mixedSettings = {
      hooks: {
        'PreToolUse': [
          { matcher: { tools: ['Edit', 'Write'] }, hooks: [{ type: 'command', command: 'existing-hook.sh' }] },
        ],
        'PreToolUse:Edit|Write': [
          { type: 'command', command: 'bash .claude/hooks/plan-guard.sh', matcher: 'Edit|Write' },
        ],
      },
    };
    writeFileSync(
      join(testDir, '.claude', 'settings.local.json'),
      JSON.stringify(mixedSettings, null, 2),
    );

    registerHooks(['core'], testDir);
    const hooks = readHooks();

    const preToolUse = hooks['PreToolUse'] as Array<{ matcher?: { tools?: string[] }; hooks?: Array<{ command: string }> }>;
    const editEntry = preToolUse.find(e => e.matcher?.tools?.includes('Edit'));

    // 기존 + 마이그레이션 + 새 등록 모두 하나의 엔트리에 병합
    const commands = editEntry!.hooks!.map(h => h.command);
    expect(commands).toContain('existing-hook.sh');
    expect(commands).toContain('bash .claude/hooks/plan-guard.sh');
  });

  it('should permissions 등 다른 설정은 보존한다', () => {
    const oldSettings = {
      permissions: { allow: ['Edit', 'Read'] },
      hooks: {
        'PreToolUse:Bash': [
          { type: 'command', command: 'bash .claude/hooks/command-guard.sh', matcher: 'Bash' },
        ],
      },
      env: { FOO: 'bar' },
    };
    writeFileSync(
      join(testDir, '.claude', 'settings.local.json'),
      JSON.stringify(oldSettings, null, 2),
    );

    registerHooks(['security'], testDir);
    const content = JSON.parse(
      readFileSync(join(testDir, '.claude', 'settings.local.json'), 'utf-8'),
    );

    expect(content.permissions).toEqual({ allow: ['Edit', 'Read'] });
    expect(content.env).toEqual({ FOO: 'bar' });
  });
});
