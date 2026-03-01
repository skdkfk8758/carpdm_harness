# CLAUDE.md — carpdm-harness

> AI 협업 워크플로우 MCP 서버 플러그인 (v4.0.0)
> **이 프로젝트의 모든 변경은 다른 AI 에이전트의 동작에 직접 영향을 미칩니다.**

## 프로젝트 정체성

carpdm-harness는 Claude Code 플러그인입니다. 코드를 수정할 때 항상 다음을 자문하세요:
- "이 변경이 플러그인을 사용하는 AI 에이전트에게 어떤 영향을 주는가?"
- "에이전트가 이 도구/훅을 호출했을 때 예상대로 동작하는가?"
- "에러 상황에서 에이전트가 멈추지 않고 계속 작업할 수 있는가?"

## 기술 스택

- **Runtime**: Node.js >= 20, ESM only (`"type": "module"`)
- **Language**: TypeScript 5.9 (strict mode, ES2022 target)
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.27 — 도구/훅 등록
- **Validation**: `zod` ^3.25 — 도구 파라미터 스키마 (4.x 불가: MCP SDK가 zod 3.x에 의존)
- **Diff**: `diff` ^8.0 — 템플릿 병합
- **Build**: `tsup` ^8.5 (13 entry points → ESM)
- **Test**: `vitest` ^3.2

## 아키텍처 개요

```
src/
├── server.ts          # MCP 서버 진입점 (McpServer + StdioTransport)
├── tools/             # 23개 MCP 도구 (harness_* 네임스페이스)
├── hooks/             # 11개 라이프사이클 훅 (별도 빌드 엔트리)
├── core/              # 비즈니스 로직 (36 모듈)
│   ├── quality-gate/  # TRUST 5 검증 시스템 (5 validators)
│   └── ontology/      # 3계층 온톨로지 (구조/시맨틱/도메인)
├── types/             # 77개 인터페이스 (8 파일)
└── utils/             # 유틸리티 (git, logger, paths, version)
```

### 핵심 레이어

| 레이어 | 역할 | 위치 |
|--------|------|------|
| **Tools** | MCP 도구 등록 + 파라미터 검증 | `src/tools/` |
| **Hooks** | 라이프사이클 이벤트 처리 (stdin JSON → stdout JSON) | `src/hooks/` |
| **Core** | 비즈니스 로직 (FSM, 품질검증, 온톨로지) | `src/core/` |
| **Types** | 공유 타입 정의 | `src/types/` |
| **Utils** | 순수 유틸리티 (side-effect 없음) | `src/utils/` |

### 빌드 산출물

`npm run build` → `dist/` (tsup) + 템플릿 복사
- `dist/server.js` — MCP 서버 메인
- `dist/hooks/*.js` — 12개 훅 (독립 실행 가능)

### 배포 포함 디렉토리

`dist/`, `templates/`, `presets/`, `skills/`, `hooks/`, `agents/`, `.claude-plugin/`, `.mcp.json`

## 변경 시 반드시 확인

### 1. 도구(Tool) 수정 시
- `src/tools/index.ts`의 `registerAllTools`에 등록 여부
- `skills/` 디렉토리에 대응하는 skill wrapper 존재 여부
- Zod 스키마 변경 → 기존 에이전트 호출 호환성 (breaking change 주의)
- `McpResponseBuilder` 패턴 준수

### 2. 훅(Hook) 수정 시
- `hooks/hooks.json`에 등록 여부
- `tsup.config.ts`에 entry point 추가 여부
- stdin/stdout JSON 프로토콜 준수 (`HookInput` → `HookOutput`)
- 훅은 **절대 프로세스를 멈추면 안 됨** — 에러 시 `{ result: 'continue' }` 반환

### 3. 타입 수정 시
- 기존 인터페이스 필드 삭제/변경 → 전체 참조 확인 필수
- 새 필드는 optional (`?`)로 추가하여 하위호환 유지

### 4. Core 로직 수정 시
- Workflow FSM: `TRANSITION_TABLE` 변경 시 테스트 필수 갱신
- Quality Gate: validator 추가 시 `runner.ts` + `types/quality-gate.ts` 동시 수정
- Ontology: 레이어 변경 시 `markdown-renderer.ts` 출력 영향 확인

### 5. Config 변경 시
- `DEFAULT_CONFIG` 변경 → 기존 사용자 config와 병합 로직 확인
- `omc-compat.ts` — OMC 경로/모드 상수는 여기서만 관리

## 테스트

```bash
npm test              # vitest run
npm run test:watch    # vitest watch
npm run typecheck     # tsc --noEmit
```

- 테스트 위치: `tests/`
- FSM 전이 테스트는 전이 테이블 전체를 커버
- `mkdtempSync`/`rmSync`로 테스트 격리
- 도구/훅 추가 시 반드시 테스트 작성

## 모듈 시스템 (7개)

| 모듈 | 설명 |
|------|------|
| **core** | Plan-First + SPARC + 외부 메모리 + 환경 업데이트 + 패턴 복제 |
| **tdd** | Red-Green-Refactor 자동 블로킹 |
| **quality** | TRUST 5 품질 게이트 |
| **ship** | 논리 커밋 + PR + 릴리스 |
| **ontology** | 3계층 온톨로지 + @MX |
| **security** | 보안 훅 + 감사 |
| **team-memory** | 팀 공유 지식 |

## 프리셋 (4개)

- **standard**: core + quality + ship + team-memory (기본 권장)
- **full**: 전체 7개 모듈
- **tdd**: core + tdd + quality + ship
- **secure**: core + quality + security + ship

## 에이전트 응답 포맷

단계별 작업 상태를 명확히 전달하기 위해 상태 태그를 사용한다:

| 태그 | 용도 |
|------|------|
| `[완료]` | 단계/작업 완료 보고 |
| `[진행중]` | 현재 진행 중인 작업 |
| `[검증]` | 테스트/검증 결과 보고 |
| `[기록]` | 파일/메모리에 기록 완료 |
| `[경고]` | 주의가 필요한 상황 |

## 주의사항

- **stdout 오염 금지**: MCP 서버는 stdout을 JSON-RPC로 사용. `console.log` 대신 `McpLogger` 사용
- **동기 I/O 허용**: 훅은 단발성 CLI 실행이므로 `readFileSync`/`writeFileSync` 사용 가능
- **graceful degradation**: 외부 도구(git, npm 등) 부재 시에도 에러 없이 기능 축소 동작
- **경로 중앙화**: OMC 관련 경로는 `omc-compat.ts`에서만 관리, 직접 하드코딩 금지
