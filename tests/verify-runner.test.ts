import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseVerifyChecks, runVerifySkill } from '../src/core/verify-runner.js';
import type { VerifySkillMeta } from '../src/types/verify.js';

describe('verify-runner 보안 (allowlist + execFileSync)', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-verify-'));
    mkdirSync(join(testDir, 'skills'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function createSkillFile(name: string, content: string): VerifySkillMeta {
    const filePath = join(testDir, 'skills', `${name}.md`);
    writeFileSync(filePath, content, 'utf-8');
    return { name, filePath, type: 'verify' as const };
  }

  describe('allowlist 검증', () => {
    it('허용된 명령 (grep)은 실행된다', () => {
      const skill = createSkillFile('test-grep', `---
name: test-grep
type: verify
---

### 1. 파일 검색 (severity: info)
- 탐지: \`grep -r test ${testDir}\`
- PASS: 검색 성공
- FAIL: 검색 실패
`);
      const result = runVerifySkill(testDir, skill);
      // grep 자체는 결과에 관계없이 허용되어야 함 (passed 여부는 내용에 따라)
      expect(result.checks.length).toBe(1);
      // 보안 차단 메시지가 아님
      expect(result.checks[0].message).not.toContain('보안: 허용되지 않은');
    });

    it('허용되지 않은 명령 (curl)은 차단된다', () => {
      const skill = createSkillFile('test-curl', `---
name: test-curl
type: verify
---

### 1. 원격 요청 (severity: error)
- 탐지: \`curl https://evil.com\`
- PASS: 성공
- FAIL: 실패
`);
      const result = runVerifySkill(testDir, skill);
      expect(result.checks.length).toBe(1);
      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].message).toContain('보안: 허용되지 않은 명령');
    });

    it('허용되지 않은 명령 (rm)은 차단된다', () => {
      const skill = createSkillFile('test-rm', `---
name: test-rm
type: verify
---

### 1. 파일 삭제 (severity: error)
- 탐지: \`rm -rf /tmp/something\`
- PASS: 성공
- FAIL: 실패
`);
      const result = runVerifySkill(testDir, skill);
      expect(result.checks.length).toBe(1);
      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].message).toContain('보안: 허용되지 않은 명령');
    });
  });

  describe('셸 메타문자 차단', () => {
    it('파이프 (|)가 포함된 명령은 차단된다', () => {
      const skill = createSkillFile('test-pipe', `---
name: test-pipe
type: verify
---

### 1. 파이프 명령 (severity: error)
- 탐지: \`grep test file | wc -l\`
- PASS: 성공
- FAIL: 실패
`);
      const result = runVerifySkill(testDir, skill);
      expect(result.checks.length).toBe(1);
      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].message).toContain('보안: 셸 메타문자');
    });

    it('세미콜론 (;)이 포함된 명령은 차단된다', () => {
      const skill = createSkillFile('test-semicolon', `---
name: test-semicolon
type: verify
---

### 1. 체인 명령 (severity: error)
- 탐지: \`echo hello; rm -rf /\`
- PASS: 성공
- FAIL: 실패
`);
      const result = runVerifySkill(testDir, skill);
      expect(result.checks.length).toBe(1);
      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].message).toContain('보안: 셸 메타문자');
    });

    it('백틱 (`)이 포함된 명령은 차단된다', () => {
      const skill = createSkillFile('test-backtick', `---
name: test-backtick
type: verify
---

### 1. 커맨드 치환 (severity: error)
- 탐지: echo \\\`whoami\\\`
- PASS: 성공
- FAIL: 실패
`);
      const result = runVerifySkill(testDir, skill);
      expect(result.checks.length).toBe(1);
      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].message).toContain('보안: 셸 메타문자');
    });

    it('$() 서브셸이 포함된 명령은 차단된다', () => {
      const skill = createSkillFile('test-subshell', `---
name: test-subshell
type: verify
---

### 1. 서브셸 (severity: error)
- 탐지: \`echo $(cat /etc/passwd)\`
- PASS: 성공
- FAIL: 실패
`);
      const result = runVerifySkill(testDir, skill);
      expect(result.checks.length).toBe(1);
      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].message).toContain('보안: 셸 메타문자');
    });
  });

  describe('허용된 명령 실행', () => {
    it('ls 명령이 성공적으로 실행된다', () => {
      const skill = createSkillFile('test-ls', `---
name: test-ls
type: verify
---

### 1. 디렉토리 확인 (severity: info)
- 탐지: \`ls ${testDir}\`
- PASS: 디렉토리 존재
- FAIL: 디렉토리 없음
`);
      const result = runVerifySkill(testDir, skill);
      expect(result.checks.length).toBe(1);
      expect(result.checks[0].passed).toBe(true);
      expect(result.checks[0].message).toContain('디렉토리 존재');
    });

    it('검사 항목이 없으면 passed=true, score=100', () => {
      const skill = createSkillFile('test-empty', `---
name: test-empty
type: verify
---

일반 텍스트만 있는 스킬 파일입니다.
`);
      const result = runVerifySkill(testDir, skill);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.checks.length).toBe(0);
    });
  });

  describe('parseVerifyChecks', () => {
    it('올바른 형식의 검사 항목을 파싱한다', () => {
      const skill = createSkillFile('test-parse', `---
name: test-parse
type: verify
---

### 1. 타입 검사 (severity: error)
- 탐지: \`tsc --noEmit\`
- PASS: 타입 오류 없음
- FAIL: 타입 오류 발견

### 2. 린트 검사 (severity: warning)
- 탐지: \`eslint src\`
- PASS: 린트 통과
- FAIL: 린트 오류
`);
      const checks = parseVerifyChecks(skill);
      expect(checks.length).toBe(2);
      expect(checks[0].name).toBe('타입 검사');
      expect(checks[0].severity).toBe('error');
      expect(checks[0].command).toBe('tsc --noEmit');
      expect(checks[1].name).toBe('린트 검사');
      expect(checks[1].severity).toBe('warning');
      expect(checks[1].command).toBe('eslint src');
    });
  });
});
