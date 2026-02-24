# Harness Init — 프로젝트 워크플로우 설치

carpdm-harness 워크플로우를 현재 프로젝트에 설치한다.
MCP 도구 `harness_init`을 호출하여 선택한 모듈과 프리셋을 프로젝트에 적용한다.

## Argument: $ARGUMENTS

설치 옵션 (예: "full", "tdd", "core,tdd", "minimal dry-run", "ontology")

- 프리셋: `full` | `standard` | `minimal` | `tdd`
- 특정 모듈: 쉼표로 구분된 모듈명 (예: `core,tdd,quality`)
- `dry-run` — 실제 설치 없이 미리보기만 출력
- `ontology` — 온톨로지 자동 생성 활성화

## Instructions

### Step 1: 프로젝트 루트 경로 감지

```bash
git rev-parse --show-toplevel 2>/dev/null || pwd
```

감지된 경로를 `PROJECT_ROOT` 변수로 저장한다.

### Step 2: $ARGUMENTS 파싱

$ARGUMENTS를 공백/쉼표 기준으로 토큰화하여 아래 규칙으로 파라미터를 결정한다.

| 토큰 | 파라미터 |
|------|---------|
| `full` / `standard` / `minimal` / `tdd` | `preset` |
| 그 외 영문 단어(쉼표 구분) | `modules` (쉼표 구분 문자열) |
| `dry-run` | `dryRun: true` |
| `ontology` | `enableOntology: true` |

- `preset`과 `modules`가 동시에 지정된 경우 `modules`를 우선한다.
- $ARGUMENTS가 비어 있으면 `preset: "standard"`를 기본값으로 사용한다.

### Step 3: MCP 도구 호출

파싱된 파라미터로 `harness_init` MCP 도구를 호출한다.

```
harness_init(
  projectRoot: PROJECT_ROOT,
  preset: <파싱된 프리셋 또는 생략>,
  modules: <파싱된 모듈 문자열 또는 생략>,
  dryRun: <true 또는 생략>,
  enableOntology: <true 또는 생략>,
  installGlobal: true
)
```

### Step 4: 결과 출력

MCP 도구의 응답을 그대로 사용자에게 출력한다.
- 설치된 모듈, 생성된 파일 목록, 등록된 훅 정보를 포함한다.
- `dryRun`이었다면 "미리보기 모드 — 실제 설치는 수행되지 않았습니다"를 명시한다.

## Rules

- 프로젝트 루트 감지에 실패하면 현재 디렉토리(`pwd`)를 사용한다.
- 이미 설치된 경우 harness_init이 처리하므로 별도 확인 없이 도구를 호출한다.
- $ARGUMENTS에 알 수 없는 토큰이 있으면 무시하고 나머지 파라미터로 진행한다.
- 도구 호출 결과를 수정하거나 요약하지 말고 원문 그대로 전달한다.
