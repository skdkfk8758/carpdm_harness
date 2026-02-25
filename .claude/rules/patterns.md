---
paths:
  - "src/**"
description: "발견된 코드 패턴 — harness가 관리하는 공유 패턴 라이브러리"
---

# 코드 패턴

프로젝트에서 발견된 반복 패턴입니다. 새 코드 작성 시 이 패턴을 따르세요.

<!-- harness:patterns:list -->

## 1. Tool Registration (도구 등록)

```typescript
// src/tools/<name>.ts
export function register<Name>Tool(server: McpServer): void {
  server.tool(
    'harness_<name>',
    '도구 설명 (에이전트가 읽는 텍스트)',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      action: z.enum(['a', 'b']).optional().default('a').describe('수행할 액션'),
    },
    async (params) => {
      // 비즈니스 로직은 core/에 위임
      const result = await coreFunction(params);
      return new McpResponseBuilder()
        .header('제목')
        .info(result.message)
        .toResult();
    },
  );
}

// src/tools/index.ts 에 등록
export function registerAllTools(server: McpServer): void {
  register<Name>Tool(server);
  // ...
}
```

## 2. Hook Implementation (훅 구현)

```typescript
// src/hooks/<hook-name>.ts — 독립 실행 CLI 스크립트
import { readFileSync } from 'node:fs';

interface HookInput {
  cwd?: string;
  directory?: string;
  sessionId?: string;
  [key: string]: unknown;
}

interface HookOutput {
  result: 'continue' | 'block';
  additionalContext?: string;
}

try {
  const input: HookInput = JSON.parse(readFileSync('/dev/stdin', 'utf-8'));
  // 로직 처리...
  const output: HookOutput = { result: 'continue', additionalContext: '컨텍스트' };
  process.stdout.write(JSON.stringify(output));
} catch {
  // 훅은 절대 실패하면 안 됨
  process.stdout.write(JSON.stringify({ result: 'continue' }));
}
```

## 3. Config Loading (설정 로드)

```typescript
// null-safe 읽기 + JSON 파싱 + fallback
export function loadConfig(projectRoot: string): HarnessConfig | null {
  const configPath = join(projectRoot, CONFIG_FILENAME);
  const content = readFileContent(configPath);
  if (!content) return null;
  try {
    return JSON.parse(content) as HarnessConfig;
  } catch {
    return null;
  }
}
```

## 4. File Read with Fallback (파일 읽기)

```typescript
// 실패 시 null 반환, 예외를 던지지 않음
export function readFileContent(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
```

## 5. Shell Command Execution (명령 실행)

```typescript
// 예외 대신 exitCode 반환
protected execCommand(cmd: string, cwd: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(cmd, { cwd, stdio: 'pipe', timeout: 8000 }).toString();
    return { stdout, exitCode: 0 };
  } catch (err) {
    const error = err as { stdout?: Buffer; status?: number };
    return { stdout: error.stdout?.toString() || '', exitCode: error.status ?? 1 };
  }
}
```

## 6. McpResponseBuilder (응답 빌더)

```typescript
// Fluent API로 에이전트 친화적 응답 구성
const res = new McpResponseBuilder();
res.header('제목')
  .blank()
  .info('정보 메시지')
  .warn('경고 메시지')
  .table([['키', '값'], ['status', 'ok']])
  .codeBlock('코드', 'typescript')
  .blank()
  .toResult();  // → ToolResult { content: [{ type: 'text', text: '...' }] }
```

## 7. Validator (품질 검증기)

```typescript
// BaseValidator 상속 → validate() 구현
export class <Criterion>Validator extends BaseValidator {
  async validate(projectRoot: string, config: HarnessConfig): Promise<ValidatorResult> {
    const checks: CheckResult[] = [];

    // 검증 로직...
    checks.push({
      name: '검증 항목',
      passed: true,
      message: '통과 메시지',
    });

    return this.buildResult(checks);  // 자동 점수 계산
  }
}
```

## 8. FSM Transition (워크플로우 상태 전이)

```typescript
// TRANSITION_TABLE 기반 상태 전이 — 유효하지 않은 전이는 거부
const TRANSITION_TABLE: Record<WorkflowStatus, string[]> = {
  idle:                ['start'],
  running:             ['complete_step', 'checkpoint_block', 'step_fail', 'abort'],
  waiting_checkpoint:  ['approve', 'reject', 'abort'],
  failed_step:         ['retry', 'skip', 'abort'],
  completed:           [],
  aborted:             [],
};

export function applyTransition(current: WorkflowStatus, action: string): WorkflowStatus | null {
  if (!TRANSITION_TABLE[current]?.includes(action)) return null;
  // 전이 로직...
}
```

## 9. Test Setup (테스트 셋업)

```typescript
// 임시 디렉토리로 테스트 격리
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('기능', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-test-'));
    // 필요한 fixture 생성
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should 동작', () => {
    // ...
  });
});
```
