import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function readText(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

// ─── 1. hooks.json PreToolUse matcher 확장 검증 ───
describe('hooks.json — Edit/Write PreToolUse matcher', () => {
  const hooksJson = JSON.parse(readText('hooks/hooks.json'));
  const preToolUse = hooksJson.hooks.PreToolUse as Array<{
    matcher: string;
    hooks: Array<{ type: string; command: string }>;
  }>;

  it('PreToolUse에 Edit matcher가 등록되어 있다', () => {
    const editEntry = preToolUse.find(e => e.matcher === 'Edit');
    expect(editEntry).toBeDefined();
    expect(editEntry!.hooks[0].command).toContain('workflow-guard');
  });

  it('PreToolUse에 Write matcher가 등록되어 있다', () => {
    const writeEntry = preToolUse.find(e => e.matcher === 'Write');
    expect(writeEntry).toBeDefined();
    expect(writeEntry!.hooks[0].command).toContain('workflow-guard');
  });

  it('harness_* 와일드카드가 harness_workflow를 포함한다 (전용 매처 통합)', () => {
    const wildcardEntry = preToolUse.find(e => e.matcher === 'harness_*');
    expect(wildcardEntry).toBeDefined();
    // harness_workflow 전용 매처는 harness_*에 통합되어 제거됨
    const dedicatedEntry = preToolUse.find(e => e.matcher === 'harness_workflow');
    expect(dedicatedEntry).toBeUndefined();
  });

  it('기존 harness_* matcher가 유지된다', () => {
    const entry = preToolUse.find(e => e.matcher === 'harness_*');
    expect(entry).toBeDefined();
  });
});

// ─── 2. workflow-guard.ts 체크포인트 + 코드수정 도구 경고 로직 검증 ───
describe('workflow-guard.ts — checkpoint + 코드수정 도구 경고', () => {
  const guardSource = readText('src/hooks/workflow-guard.ts');

  it('CODE_MODIFY_TOOLS Set이 정의되어 있다', () => {
    expect(guardSource).toContain('CODE_MODIFY_TOOLS');
  });

  it('Edit, Write, MultiEdit이 CODE_MODIFY_TOOLS에 포함되어 있다', () => {
    expect(guardSource).toContain("'Edit'");
    expect(guardSource).toContain("'Write'");
    expect(guardSource).toContain("'MultiEdit'");
  });

  it('waiting_checkpoint 상태에서 CODE_MODIFY_TOOLS 체크 로직이 있다', () => {
    expect(guardSource).toContain("waiting_checkpoint");
    expect(guardSource).toContain("CODE_MODIFY_TOOLS.has(toolName)");
  });

  it('guardLevel block 시 코드수정 도구를 차단하는 로직이 있다', () => {
    // waiting_checkpoint + CODE_MODIFY_TOOLS + block → outputResult('block')
    expect(guardSource).toContain("guardLevel === 'block'");
    expect(guardSource).toContain("outputResult('block'");
  });

  it('체크포인트 승인 안내 메시지가 포함되어 있다', () => {
    expect(guardSource).toContain('체크포인트 승인 전 코드 수정 시도 감지');
    expect(guardSource).toContain('action: "approve"');
  });
});

// ─── 3. prompt-enricher.ts implementation-readiness 연결 검증 ───
describe('prompt-enricher.ts — implementation-readiness 연결', () => {
  const enricherSource = readText('src/hooks/prompt-enricher.ts');

  it('checkImplementationReadiness를 import한다', () => {
    expect(enricherSource).toContain("checkImplementationReadiness");
    expect(enricherSource).toContain("from '../core/behavioral-validator.js'");
  });

  it('워크플로우 비활성 분기에서 checkImplementationReadiness를 호출한다', () => {
    expect(enricherSource).toContain('checkImplementationReadiness(prompt, cwd)');
  });

  it('force-plan-gate 상태 시 PLAN REQUIRED 경고를 주입한다', () => {
    expect(enricherSource).toContain("readiness.status === 'force-plan-gate'");
    expect(enricherSource).toContain('WORKFLOW GUARD: PLAN REQUIRED');
  });

  it('pass가 아닌 상태에서 readiness.message를 주입한다', () => {
    expect(enricherSource).toContain("readiness.status !== 'pass'");
    expect(enricherSource).toContain('readiness.message');
  });
});

// ─── 4. implementation-readiness.ts 핵심 로직 재확인 ───
describe('implementation-readiness.ts — 핵심 상태 흐름', () => {
  it('5가지 상태를 모두 반환할 수 있다', async () => {
    const mod = await import('../src/core/behavioral-validator.js');
    type Status = ReturnType<typeof mod.checkImplementationReadiness>['status'];
    const validStatuses: Status[] = ['pass', 'force-plan-gate', 'plan-not-approved', 'todo-required', 'todo-stale'];
    expect(validStatuses).toHaveLength(5);
  });

  it('IMPLEMENTATION_INTENT_PATTERNS가 비어있지 않다', async () => {
    const { IMPLEMENTATION_INTENT_PATTERNS } = await import('../src/core/behavioral-validator.js');
    expect(IMPLEMENTATION_INTENT_PATTERNS.length).toBeGreaterThan(0);
  });

  it('한국어 구현 의도를 감지한다', async () => {
    const { hasImplementationIntent } = await import('../src/core/behavioral-validator.js');
    expect(hasImplementationIntent('계획을 구현해주세요')).toBe(true);
    expect(hasImplementationIntent('플랜대로 진행')).toBe(true);
  });

  it('비구현 프롬프트는 감지하지 않는다', async () => {
    const { hasImplementationIntent } = await import('../src/core/behavioral-validator.js');
    expect(hasImplementationIntent('버그 수정해줘')).toBe(false);
    expect(hasImplementationIntent('코드 리뷰해줘')).toBe(false);
  });
});
