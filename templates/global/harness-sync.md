# Harness Sync — 플러그인 최신화 + 프로젝트 업데이트 원스톱

플러그인 자체를 최신화(git pull + build)하고, 프로젝트 템플릿까지 한 번에 업데이트한다.
`harness_update`를 `updatePlugin: true` + `acceptAll: true`로 호출하여 수동 옵션 지정 없이 전체 동기화를 수행한다.

## Argument: $ARGUMENTS

동기화 옵션 (예: "dry-run", "ontology")

- `dry-run` — 실제 변경 없이 diff만 출력
- `ontology` — 온톨로지 갱신 포함

## Instructions

### Step 1: 프로젝트 루트 경로 감지

```bash
git rev-parse --show-toplevel 2>/dev/null || pwd
```

감지된 경로를 `PROJECT_ROOT` 변수로 저장한다.

### Step 2: $ARGUMENTS 파싱

$ARGUMENTS를 공백 기준으로 토큰화하여 아래 규칙으로 파라미터를 결정한다.

| 토큰 | 파라미터 |
|------|---------|
| `dry-run` | `dryRun: true` |
| `ontology` | `refreshOntology: true` |

- $ARGUMENTS가 비어 있으면 추가 파라미터 없이 기본 동기화를 수행한다.
- 알 수 없는 토큰은 무시한다.

### Step 3: MCP 도구 호출

파싱된 파라미터에 `updatePlugin: true`와 `acceptAll: true`를 **항상 고정**으로 추가하여 `harness_update` MCP 도구를 호출한다.

```
harness_update(
  projectRoot: PROJECT_ROOT,
  updatePlugin: true,
  acceptAll: true,
  dryRun: <true 또는 생략>,
  refreshOntology: <true 또는 생략>
)
```

### Step 4: 결과 출력

MCP 도구의 응답을 그대로 사용자에게 출력한다.
- Phase 0(플러그인 업데이트) 결과와 Phase 1(템플릿 업데이트) 결과를 모두 포함한다.
- `dryRun`이었다면 "미리보기 모드 — 실제 변경은 수행되지 않았습니다"를 명시한다.
- 모든 파일이 최신이면 "이미 최신 상태입니다"를 출력한다.

## Rules

- 프로젝트 루트 감지에 실패하면 현재 디렉토리(`pwd`)를 사용한다.
- `updatePlugin: true`와 `acceptAll: true`는 **항상 고정** — 사용자가 재정의할 수 없다.
- carpdm-harness가 설치되어 있지 않은 경우 harness_update가 오류를 반환하므로 별도 확인 없이 도구를 호출한다.
- 도구 호출 결과를 수정하거나 요약하지 말고 원문 그대로 전달한다.
