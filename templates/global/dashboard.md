# Dashboard — 워크플로우 대시보드 생성

harness 훅 실행 이벤트를 분석하여 인터랙티브 HTML 대시보드를 생성한다.
모듈 상태, 이벤트 통계, 세션 리플레이를 한눈에 시각화한다.

## Argument: $ARGUMENTS

대시보드 옵션 (예: "open", "session:abc123", 비어 있으면 전체 + 브라우저 열기)

- `open` — 생성 후 브라우저에서 자동 열기 (기본값)
- `session:<sessionId>` — 특정 세션만 리플레이 표시
- `no-open` — HTML 파일만 생성하고 브라우저 열지 않음

## Instructions

### Step 1: $ARGUMENTS 파싱

$ARGUMENTS를 공백 기준으로 토큰화하여 아래 규칙으로 파라미터를 결정한다.

| 토큰 | 파라미터 |
|------|---------|
| `open` | `open: true` |
| `no-open` | `open: false` |
| `session:<id>` | `sessionId: "<id>"` |

- $ARGUMENTS가 비어 있으면 `open: true`로 호출한다.
- `session:` 접두사 뒤의 값을 sessionId로 사용한다.

### Step 2: 프로젝트 루트 탐지

현재 작업 디렉토리(CWD)를 `projectRoot`로 사용한다.
`carpdm-harness.config.json`이 존재하는지 확인하여 harness 프로젝트인지 검증한다.

### Step 3: MCP 도구 호출

파싱된 파라미터로 `harness_dashboard` MCP 도구를 호출한다.

```
harness_dashboard(
  projectRoot: "<현재 프로젝트 루트>",
  sessionId: <지정 시 해당 ID, 생략 시 미지정>,
  open: <true 또는 false>
)
```

### Step 4: 결과 안내

MCP 도구의 응답을 사용자에게 출력한다. 아래 정보를 포함하여 간결하게 안내한다:

- 대시보드 파일 경로 (`.harness/dashboard.html`)
- 세션 수, 총 이벤트 수
- BLOCK/WARN 비율
- 설치된 모듈 현황

추가로, 대시보드 HTML에 포함된 5개 섹션을 간략히 안내한다:
1. **모듈 상태 현황** — 설치 모듈, 무결성, 팀 메모리, 온톨로지
2. **모듈 의존성 그래프** — Mermaid 플로우차트
3. **훅 이벤트 플로우** — Mermaid 시퀀스 다이어그램
4. **통계 대시보드** — Chart.js 차트 4개 (훅 빈도, 결과 비율, 시간대별, 변경 파일)
5. **세션 리플레이** — 이벤트 타임라인 (PASS/WARN/BLOCK 색상)

## Rules

- 이벤트 데이터가 없어도 대시보드를 생성한다 (빈 상태로 표시됨).
- 도구 호출 실패 시 에러 메시지를 그대로 전달한다.
- $ARGUMENTS에 알 수 없는 토큰이 있으면 무시하고 나머지 파라미터로 진행한다.
