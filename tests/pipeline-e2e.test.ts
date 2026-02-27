/**
 * Layer 2: Pipeline E2E Tests
 *
 * 빌드된 훅의 실제 stdin→stdout 파이프라인을 검증합니다.
 * behavioral guard + 기존 훅의 회귀를 감지합니다.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PROJECT_ROOT = join(import.meta.dirname, '..');
const HOOK_DIR = join(PROJECT_ROOT, 'dist', 'hooks');

interface HookOutput {
  result: 'continue' | 'block';
  additionalContext?: string;
}

function runHook(hookName: string, input: Record<string, unknown>): HookOutput {
  try {
    const result = execSync(
      `echo '${JSON.stringify(input).replace(/'/g, "'\\''")}' | node ${join(HOOK_DIR, `${hookName}.js`)}`,
      { stdio: 'pipe', timeout: 5000, env: { ...process.env, NODE_NO_WARNINGS: '1' } },
    );
    return JSON.parse(result.toString()) as HookOutput;
  } catch (err) {
    const error = err as { stdout?: Buffer };
    if (error.stdout) {
      return JSON.parse(error.stdout.toString()) as HookOutput;
    }
    throw err;
  }
}

// === prompt-enricher 테스트 ===

describe('Pipeline E2E: prompt-enricher', () => {
  it('일반 프롬프트 → 추가 컨텍스트 없음', () => {
    const output = runHook('prompt-enricher', {
      prompt: '로그인 기능을 구현해줘',
      cwd: '/tmp/nonexistent',
    });
    expect(output.result).toBe('continue');
    expect(output.additionalContext).toBeUndefined();
  });

  it('적신호 + 완료 의도 → behavioral-guard 주입', () => {
    const output = runHook('prompt-enricher', {
      prompt: '커밋해줘 should work',
      cwd: '/tmp/nonexistent',
    });
    expect(output.result).toBe('continue');
    expect(output.additionalContext).toContain('[behavioral-guard]');
    expect(output.additionalContext).toContain('적신호 감지');
  });

  it('완료 의도만 (적신호 없음) → 체크리스트 주입', () => {
    const output = runHook('prompt-enricher', {
      prompt: '커밋해줘',
      cwd: '/tmp/nonexistent',
    });
    expect(output.result).toBe('continue');
    expect(output.additionalContext).toContain('[behavioral-guard]');
    expect(output.additionalContext).toContain('완료 전 체크리스트');
  });

  describe('활성 워크플로우 시나리오', () => {
    let testDir: string;

    beforeAll(() => {
      testDir = mkdtempSync(join(tmpdir(), 'harness-pe-'));
      mkdirSync(join(testDir, '.harness', 'workflows', 'wf-001'), { recursive: true });
      writeFileSync(
        join(testDir, '.harness', 'workflows', 'active.json'),
        JSON.stringify({ activeWorkflowId: 'wf-001' }),
      );
    });

    afterAll(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    function writeWorkflowState(agent: string, step: number): void {
      writeFileSync(
        join(testDir, '.harness', 'workflows', 'wf-001', 'state.json'),
        JSON.stringify({
          id: 'wf-001',
          workflowType: 'standard',
          status: 'running',
          currentStep: step,
          totalSteps: 4,
          steps: [
            { order: 1, agent: 'planner', action: 'plan', status: step > 1 ? 'completed' : 'running' },
            { order: 2, agent: 'executor', action: 'implement', status: step > 2 ? 'completed' : step === 2 ? 'running' : 'pending' },
            { order: 3, agent: 'test-engineer', action: 'test', status: step > 3 ? 'completed' : step === 3 ? 'running' : 'pending' },
            { order: 4, agent: 'verifier', action: 'verify', status: step === 4 ? 'running' : 'pending' },
          ],
          config: { guardLevel: 'warn' },
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        }),
      );
    }

    it('planning phase → 계획 단계 합리화 테이블 주입', () => {
      writeWorkflowState('planner', 1);
      const output = runHook('prompt-enricher', { prompt: '계획을 세우자', cwd: testDir });
      expect(output.additionalContext).toContain('[behavioral-guard]');
      expect(output.additionalContext).toContain('계획 단계');
    });

    it('implementing phase → 구현 단계 합리화 테이블 주입', () => {
      writeWorkflowState('executor', 2);
      const output = runHook('prompt-enricher', { prompt: '구현 시작', cwd: testDir });
      expect(output.additionalContext).toContain('구현 단계');
    });

    it('testing phase → 테스트 단계 합리화 테이블 주입', () => {
      writeWorkflowState('test-engineer', 3);
      const output = runHook('prompt-enricher', { prompt: '테스트 실행', cwd: testDir });
      expect(output.additionalContext).toContain('테스트 단계');
    });

    it('completing phase → 완료 단계 합리화 테이블 주입', () => {
      writeWorkflowState('verifier', 4);
      const output = runHook('prompt-enricher', { prompt: '검증 시작', cwd: testDir });
      expect(output.additionalContext).toContain('완료 단계');
    });

    it('completing phase + 완료 의도 + 적신호 → 3중 주입', () => {
      writeWorkflowState('verifier', 4);
      const output = runHook('prompt-enricher', {
        prompt: '커밋해줘 probably fixed',
        cwd: testDir,
      });
      expect(output.additionalContext).toContain('완료 단계');
      expect(output.additionalContext).toContain('적신호 감지');
    });
  });

  describe('config off 시나리오', () => {
    let testDir: string;

    beforeAll(() => {
      testDir = mkdtempSync(join(tmpdir(), 'harness-cfg-'));
      writeFileSync(
        join(testDir, 'carpdm-harness.config.json'),
        JSON.stringify({
          version: '1.0.0',
          preset: 'standard',
          modules: [],
          behavioralGuard: { rationalization: 'off', redFlagDetection: 'off' },
          options: { hooksRegistered: true, docsTemplatesDir: 'docs', agentDir: '.agent' },
          files: {},
          installedAt: '2025-01-01',
          updatedAt: '2025-01-01',
          globalCommandsInstalled: false,
        }),
      );
    });

    afterAll(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('redFlagDetection off → 적신호 미주입', () => {
      const output = runHook('prompt-enricher', {
        prompt: '커밋해줘 should work',
        cwd: testDir,
      });
      expect(output.result).toBe('continue');
      expect(output.additionalContext).toBeUndefined();
    });
  });
});

// === quality-gate 테스트 ===

describe('Pipeline E2E: quality-gate', () => {
  it('Bash 외 도구 → continue', () => {
    const output = runHook('quality-gate', {
      tool_name: 'Read',
      tool_input: { file_path: '/tmp/test.txt' },
      cwd: '/tmp',
    });
    expect(output.result).toBe('continue');
    expect(output.additionalContext).toBeUndefined();
  });

  it('git commit 아닌 Bash 명령 → continue', () => {
    const output = runHook('quality-gate', {
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
      cwd: '/tmp',
    });
    expect(output.result).toBe('continue');
  });

  describe('적신호 커밋 메시지 스캔', () => {
    let testDir: string;

    beforeAll(() => {
      testDir = mkdtempSync(join(tmpdir(), 'harness-qg-'));
      writeFileSync(
        join(testDir, 'carpdm-harness.config.json'),
        JSON.stringify({
          version: '1.0.0',
          preset: 'standard',
          modules: [],
          qualityGate: { mode: 'warn' },
          options: { hooksRegistered: true, docsTemplatesDir: 'docs', agentDir: '.agent' },
          files: {},
          installedAt: '2025-01-01',
          updatedAt: '2025-01-01',
          globalCommandsInstalled: false,
        }),
      );
      // git repo 초기화 + staged 파일 생성
      execSync('git init --quiet', { cwd: testDir });
      writeFileSync(join(testDir, 'test.txt'), 'hello');
      execSync('git add test.txt', { cwd: testDir });
    });

    afterAll(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('적신호 커밋 메시지 → RedFlag 경고 포함', () => {
      const output = runHook('quality-gate', {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "probably fixed the bug"' },
        cwd: testDir,
      });
      expect(output.result).toBe('continue');
      expect(output.additionalContext).toContain('RedFlag');
      expect(output.additionalContext).toContain('적신호 감지');
    });

    it('정상 커밋 메시지 → RedFlag 없음', () => {
      const output = runHook('quality-gate', {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "feat(auth): add login validation"' },
        cwd: testDir,
      });
      expect(output.result).toBe('continue');
      expect(output.additionalContext).not.toContain('RedFlag');
    });
  });

  describe('config off 시나리오', () => {
    let testDir: string;

    beforeAll(() => {
      testDir = mkdtempSync(join(tmpdir(), 'harness-qg-off-'));
      writeFileSync(
        join(testDir, 'carpdm-harness.config.json'),
        JSON.stringify({
          version: '1.0.0',
          preset: 'standard',
          modules: [],
          qualityGate: { mode: 'warn' },
          behavioralGuard: { redFlagDetection: 'off' },
          options: { hooksRegistered: true, docsTemplatesDir: 'docs', agentDir: '.agent' },
          files: {},
          installedAt: '2025-01-01',
          updatedAt: '2025-01-01',
          globalCommandsInstalled: false,
        }),
      );
      execSync('git init --quiet', { cwd: testDir });
      writeFileSync(join(testDir, 'test.txt'), 'hello');
      execSync('git add test.txt', { cwd: testDir });
    });

    afterAll(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('redFlagDetection off → 적신호 미감지', () => {
      const output = runHook('quality-gate', {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "probably fixed the bug"' },
        cwd: testDir,
      });
      expect(output.result).toBe('continue');
      expect(output.additionalContext).not.toContain('RedFlag');
    });
  });
});
