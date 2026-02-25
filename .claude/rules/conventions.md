---
paths:
  - "src/**"
description: "팀 코딩 컨벤션 — harness가 관리하는 공유 규칙"
---

# 코딩 컨벤션

팀이 합의한 코딩 컨벤션입니다. Claude Code 세션에서 자동으로 로드됩니다.

## Naming

<!-- harness:conventions:naming -->

- **MCP 도구**: `harness_<action>` (예: `harness_init`, `harness_workflow`, `harness_quality_check`)
- **함수**: camelCase (예: `loadConfig`, `startWorkflow`, `resolveNextAction`)
- **인터페이스/타입**: PascalCase (예: `WorkflowInstance`, `HarnessConfig`, `TrustReport`)
- **상수**: UPPER_SNAKE_CASE (예: `DEFAULT_CONFIG`, `TRANSITION_TABLE`, `PROTECTED_FILES`)
- **파일명**: kebab-case (예: `workflow-engine.ts`, `quality-gate.ts`, `omc-compat.ts`)
- **훅 파일**: `<hook-name>.ts` — 이벤트 이름과 매칭 (예: `session-start.ts`, `workflow-guard.ts`)
- **Validator 클래스**: `<Criterion>Validator` (예: `TestedValidator`, `ReadableValidator`)
- **등록 함수**: `register<Name>Tool` (예: `registerWorkflowTool`, `registerInitTool`)

## Structure

<!-- harness:conventions:structure -->

- **레이어 분리**: tools → core → types/utils 방향으로만 의존 (역방향 금지)
- **tools/**: MCP 도구 등록 + Zod 스키마 검증만 담당, 비즈니스 로직은 core/에 위임
- **hooks/**: 독립 실행 가능한 CLI 스크립트, stdin JSON → stdout JSON 프로토콜
- **core/**: 비즈니스 로직 집중, MCP SDK 직접 참조 금지
- **types/**: 도메인별 타입 파일 분리 (config.ts, workflow.ts, quality-gate.ts 등)
- **utils/**: 순수 유틸리티, side-effect 없음, 다른 core 모듈 의존 금지
- **새 도구 추가 시**: tools/ 파일 + tools/index.ts 등록 + skills/ 디렉토리 + 테스트
- **새 훅 추가 시**: hooks/ 파일 + hooks/hooks.json 등록 + tsup.config.ts entry 추가

## Error Handling

<!-- harness:conventions:error-handling -->

- **graceful degradation**: 외부 도구(git, npm) 부재 시 에러 없이 기능 축소 동작
- **try-catch + null 반환**: 파일 읽기 실패 시 null 반환, 호출자가 fallback 처리
- **execCommand 래퍼**: `{ stdout, exitCode }` 반환, 예외를 던지지 않음
- **훅은 절대 중단 금지**: 에러 발생해도 `{ result: 'continue' }` 반환
- **OperationResult 패턴**: `{ success: boolean, message: string }` 으로 결과 전달
- **에이전트 친화적 에러 메시지**: 에러 시 "무엇이 실패했고, 다음에 무엇을 시도하라"를 포함

## Other

<!-- harness:conventions:other -->

- **stdout 오염 금지**: MCP 서버는 stdout을 JSON-RPC로 사용 → `console.log` 대신 `McpLogger` 사용
- **동기 I/O 허용**: 훅은 단발성 CLI 실행이므로 `readFileSync`/`writeFileSync` 사용 가능
- **OMC 경로 중앙화**: `omc-compat.ts`에서만 OMC 경로/모드 상수 관리, 직접 하드코딩 금지
- **하위호환**: 인터페이스 새 필드는 optional(`?`)로 추가, 기존 필드 삭제/변경 시 전체 참조 확인
- **Zod 스키마**: 도구 파라미터는 반드시 Zod로 정의, `.describe()`로 에이전트용 설명 포함
