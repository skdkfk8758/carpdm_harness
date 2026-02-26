import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');

// === 구조 검증 ===

describe('Verify 시스템 구조 검증', () => {
  describe('타입 정의', () => {
    it('verify.ts 타입 파일이 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/types/verify.ts'))).toBe(true);
    });

    it('핵심 타입이 export 된다', () => {
      const content = readFileSync(join(ROOT, 'src/types/verify.ts'), 'utf-8');
      expect(content).toContain('VerifySkillMeta');
      expect(content).toContain('VerifyCheck');
      expect(content).toContain('DriftReport');
      expect(content).toContain('SkillSuggestion');
      expect(content).toContain('VerifySkillResult');
      expect(content).toContain('IntegratedVerifyReport');
      expect(content).toContain('DRIFT_EXEMPT_PATTERNS');
    });
  });

  describe('코어 모듈', () => {
    it('verify-skill-manager.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/core/verify-skill-manager.ts'))).toBe(true);
    });

    it('verify-runner.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/core/verify-runner.ts'))).toBe(true);
    });
  });

  describe('MCP 도구', () => {
    it('manage-verify.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/tools/manage-verify.ts'))).toBe(true);
    });

    it('verify-all.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/tools/verify-all.ts'))).toBe(true);
    });

    it('tools/index.ts에 registerManageVerifyTool이 등록되어 있다', () => {
      const content = readFileSync(join(ROOT, 'src/tools/index.ts'), 'utf-8');
      expect(content).toContain('registerManageVerifyTool');
      expect(content).toContain('./manage-verify.js');
    });

    it('tools/index.ts에 registerVerifyAllTool이 등록되어 있다', () => {
      const content = readFileSync(join(ROOT, 'src/tools/index.ts'), 'utf-8');
      expect(content).toContain('registerVerifyAllTool');
      expect(content).toContain('./verify-all.js');
    });
  });

  describe('스킬 wrapper', () => {
    it('manage-verify SKILL.md가 존재한다', () => {
      expect(existsSync(join(ROOT, 'skills/manage-verify/SKILL.md'))).toBe(true);
    });

    it('verify-all SKILL.md가 존재한다', () => {
      expect(existsSync(join(ROOT, 'skills/verify-all/SKILL.md'))).toBe(true);
    });

    it('manage-verify SKILL.md에 올바른 frontmatter가 있다', () => {
      const content = readFileSync(join(ROOT, 'skills/manage-verify/SKILL.md'), 'utf-8');
      expect(content).toMatch(/^---\n/);
      expect(content).toContain('name: harness-manage-verify');
    });

    it('verify-all SKILL.md에 올바른 frontmatter가 있다', () => {
      const content = readFileSync(join(ROOT, 'skills/verify-all/SKILL.md'), 'utf-8');
      expect(content).toMatch(/^---\n/);
      expect(content).toContain('name: harness-verify-all');
    });
  });
});

// === 기능 단위 테스트 ===

describe('verify-skill-manager 기능', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-verify-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('scanVerifySkills', async () => {
    const { scanVerifySkills } = await import('../src/core/verify-skill-manager.js');

    it('verify 스킬이 없으면 빈 배열 반환', () => {
      const result = scanVerifySkills(testDir);
      expect(result).toEqual([]);
    });

    it('.claude/skills 디렉토리가 없어도 빈 배열 반환', () => {
      const result = scanVerifySkills(join(testDir, 'nonexistent'));
      expect(result).toEqual([]);
    });

    it('verify- 접두사 스킬만 스캔한다', () => {
      // verify 스킬 생성
      const verifyDir = join(testDir, '.claude', 'skills', 'verify-api');
      mkdirSync(verifyDir, { recursive: true });
      writeFileSync(join(verifyDir, 'SKILL.md'), [
        '---',
        'name: verify-api',
        'description: API 검증',
        'type: verify',
        'covers:',
        '  - "src/api/**/*.ts"',
        '---',
        '',
        '## 검사 항목',
      ].join('\n'));

      // 일반 스킬 (verify- 접두사 아님)
      const otherDir = join(testDir, '.claude', 'skills', 'init');
      mkdirSync(otherDir, { recursive: true });
      writeFileSync(join(otherDir, 'SKILL.md'), '---\nname: init\n---\n');

      const result = scanVerifySkills(testDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('verify-api');
      expect(result[0].covers).toEqual(['src/api/**/*.ts']);
    });
  });

  describe('generateVerifySkill', async () => {
    const { generateVerifySkill } = await import('../src/core/verify-skill-manager.js');

    it('SKILL.md 파일을 올바르게 생성한다', () => {
      const filePath = generateVerifySkill(testDir, {
        action: 'create',
        skillName: 'verify-core',
        reason: 'src/core 디렉토리 변경 감지',
        covers: ['src/core/**/*'],
        proposedChecks: [
          {
            name: 'TypeScript 컴파일',
            severity: 'error',
            command: 'npx tsc --noEmit',
            passCondition: 'exit code 0',
            failCondition: '타입 에러 존재',
          },
        ],
      });

      expect(existsSync(filePath)).toBe(true);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('name: verify-core');
      expect(content).toContain('type: verify');
      expect(content).toContain('src/core/**/*');
      expect(content).toContain('TypeScript 컴파일');
      expect(content).toContain('npx tsc --noEmit');
    });
  });
});

describe('verify-runner 기능', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-verify-runner-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('parseVerifyChecks', async () => {
    const { parseVerifyChecks } = await import('../src/core/verify-runner.js');

    it('SKILL.md에서 검사 항목을 파싱한다', () => {
      const skillDir = join(testDir, '.claude', 'skills', 'verify-test');
      mkdirSync(skillDir, { recursive: true });

      const skillPath = join(skillDir, 'SKILL.md');
      writeFileSync(skillPath, [
        '---',
        'name: verify-test',
        'description: 테스트 검증',
        'type: verify',
        'covers:',
        '  - "src/**/*.ts"',
        '---',
        '',
        '## 검사 항목',
        '',
        '### 1. 파일 존재 확인 (severity: error)',
        '- 탐지: `ls src/`',
        '- PASS: 디렉토리 존재',
        '- FAIL: 디렉토리 없음',
        '',
        '### 2. 린트 경고 (severity: warning)',
        '- 탐지: `echo ok`',
        '- PASS: 린트 통과',
        '- FAIL: 린트 경고 존재',
      ].join('\n'));

      const checks = parseVerifyChecks({
        name: 'verify-test',
        description: '테스트 검증',
        covers: ['src/**/*.ts'],
        filePath: skillPath,
      });

      expect(checks).toHaveLength(2);
      expect(checks[0].name).toBe('파일 존재 확인');
      expect(checks[0].severity).toBe('error');
      expect(checks[0].command).toBe('ls src/');
      expect(checks[1].name).toBe('린트 경고');
      expect(checks[1].severity).toBe('warning');
    });

    it('검사 항목이 없으면 빈 배열 반환', () => {
      const skillDir = join(testDir, '.claude', 'skills', 'verify-empty');
      mkdirSync(skillDir, { recursive: true });

      const skillPath = join(skillDir, 'SKILL.md');
      writeFileSync(skillPath, '---\nname: verify-empty\n---\n\n내용 없음\n');

      const checks = parseVerifyChecks({
        name: 'verify-empty',
        description: '',
        covers: [],
        filePath: skillPath,
      });

      expect(checks).toEqual([]);
    });
  });

  describe('runVerifySkill', async () => {
    const { runVerifySkill } = await import('../src/core/verify-runner.js');

    it('검사 항목 없으면 passed=true, score=100', () => {
      const skillDir = join(testDir, '.claude', 'skills', 'verify-noop');
      mkdirSync(skillDir, { recursive: true });
      const skillPath = join(skillDir, 'SKILL.md');
      writeFileSync(skillPath, '---\nname: verify-noop\n---\n\n## 예외\n없음\n');

      const result = runVerifySkill(testDir, {
        name: 'verify-noop',
        description: '',
        covers: [],
        filePath: skillPath,
      });

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.checks).toEqual([]);
    });

    it('성공하는 명령어는 passed=true', () => {
      const skillDir = join(testDir, '.claude', 'skills', 'verify-ok');
      mkdirSync(skillDir, { recursive: true });
      const skillPath = join(skillDir, 'SKILL.md');
      writeFileSync(skillPath, [
        '---',
        'name: verify-ok',
        'description: 성공 테스트',
        'type: verify',
        'covers:',
        '  - "**/*"',
        '---',
        '',
        '## 검사 항목',
        '',
        '### 1. Echo 테스트 (severity: error)',
        '- 탐지: `echo hello`',
        '- PASS: 명령 성공',
        '- FAIL: 명령 실패',
      ].join('\n'));

      const result = runVerifySkill(testDir, {
        name: 'verify-ok',
        description: '성공 테스트',
        covers: ['**/*'],
        filePath: skillPath,
      });

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].passed).toBe(true);
    });

    it('실패하는 명령어는 passed=false', () => {
      const skillDir = join(testDir, '.claude', 'skills', 'verify-fail');
      mkdirSync(skillDir, { recursive: true });
      const skillPath = join(skillDir, 'SKILL.md');
      writeFileSync(skillPath, [
        '---',
        'name: verify-fail',
        'description: 실패 테스트',
        'type: verify',
        'covers:',
        '  - "**/*"',
        '---',
        '',
        '## 검사 항목',
        '',
        '### 1. 존재하지 않는 명령 (severity: error)',
        '- 탐지: `ls /nonexistent_path_12345`',
        '- PASS: 경로 존재',
        '- FAIL: 경로 없음',
      ].join('\n'));

      const result = runVerifySkill(testDir, {
        name: 'verify-fail',
        description: '실패 테스트',
        covers: ['**/*'],
        filePath: skillPath,
      });

      expect(result.passed).toBe(false);
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].passed).toBe(false);
    });
  });
});
