# Harness Update — 플러그인 & 템플릿 업데이트

플러그인 자체(Git 소스 + 빌드) 및 설치된 템플릿을 최신 버전으로 업데이트한다.
MCP 도구 `harness_update`를 호출하여 변경된 파일을 감지하고 업데이트를 적용한다.

## Argument: $ARGUMENTS

업데이트 옵션 (예: "dry-run", "accept-all", "core", "ontology dry-run")

- 특정 모듈명 — 해당 모듈만 업데이트 (예: `core`, `tdd`, `quality`)
- `dry-run` — 실제 변경 없이 diff만 출력
- `accept-all` — 모든 변경사항 자동 수락
- `ontology` — 온톨로지 갱신 포함
- `update-plugin` — 플러그인 자체 업데이트 (Phase 0)
- `skip-templates` — 템플릿 업데이트 건너뜀 (Phase 0만 실행)

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
| `accept-all` | `acceptAll: true` |
| `ontology` | `refreshOntology: true` |
| `update-plugin` | `updatePlugin: true` |
| `skip-templates` | `skipTemplates: true` |
| 그 외 영문 단어 | `module` (모듈명) |

- `module`은 단일 값이므로 모듈명이 여러 개 지정된 경우 첫 번째 토큰을 사용한다.
- $ARGUMENTS가 비어 있으면 파라미터 없이 전체 모듈 업데이트를 수행한다.

### Step 3: MCP 도구 호출

파싱된 파라미터로 `harness_update` MCP 도구를 호출한다.

```
harness_update(
  projectRoot: PROJECT_ROOT,
  module: <파싱된 모듈명 또는 생략>,
  dryRun: <true 또는 생략>,
  acceptAll: <true 또는 생략>,
  refreshOntology: <true 또는 생략>
)
```

### Step 4: 결과 출력

MCP 도구의 응답을 그대로 사용자에게 출력한다.
- 변경된 파일 목록과 diff 내용을 포함한다.
- `dryRun`이었다면 "미리보기 모드 — 실제 변경은 수행되지 않았습니다"를 명시한다.
- 업데이트된 파일이 없으면 "모든 파일이 최신 상태입니다"를 출력한다.

## Rules

- 프로젝트 루트 감지에 실패하면 현재 디렉토리(`pwd`)를 사용한다.
- carpdm-harness가 설치되어 있지 않은 경우 harness_update가 오류를 반환하므로 별도 확인 없이 도구를 호출한다.
- $ARGUMENTS에 알 수 없는 토큰이 있으면 무시하고 나머지 파라미터로 진행한다.
- 도구 호출 결과를 수정하거나 요약하지 말고 원문 그대로 전달한다.

## Two-Phase 업데이트

`harness_update`는 두 단계로 동작한다:

### Phase 0: 플러그인 자체 업데이트 (`updatePlugin: true` 필요)
1. 플러그인 Git 저장소에서 `origin/main`과 현재 버전 비교
2. 업데이트 가능 시 변경 내역(changelog) 표시
3. `dryRun`이 아니면 `git reset --hard origin/main` + `npm run build` 실행
4. 빌드 실패 시 이전 커밋으로 자동 롤백
5. 업데이트 이력을 `.harness/plugin-update-history.json`에 기록

### Phase 1: 템플릿 업데이트 (기본 동작)
1. 설치된 파일과 최신 템플릿을 diff 비교
2. 변경된 파일을 감지하고 업데이트 적용
3. 사용자 수정 파일은 건너뜀, 충돌 시 백업 후 교체

`skipTemplates: true`이면 Phase 0만 실행하고 종료한다.
도구 스키마 변경은 MCP 서버 재시작 후 적용된다.
