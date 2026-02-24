# Harness List — 모듈 및 프리셋 목록 조회

carpdm-harness에서 사용 가능한 모듈과 프리셋 목록을 조회한다.
MCP 도구 `harness_list`를 호출하여 설치 가능한 항목을 확인한다.

## Argument: $ARGUMENTS

조회 옵션 (예: "modules", "presets", 비어 있으면 전체)

- `modules` — 모듈 목록만 표시
- `presets` — 프리셋 목록만 표시
- 비어 있으면 모듈 + 프리셋 전체 표시

## Instructions

### Step 1: $ARGUMENTS 파싱

$ARGUMENTS를 공백 기준으로 토큰화하여 아래 규칙으로 파라미터를 결정한다.

| 토큰 | 파라미터 |
|------|---------|
| `modules` | `showModules: true` |
| `presets` | `showPresets: true` |

- $ARGUMENTS가 비어 있으면 파라미터 없이 호출한다 (전체 표시).

### Step 2: MCP 도구 호출

파싱된 파라미터로 `harness_list` MCP 도구를 호출한다.

```
harness_list(
  showModules: <true 또는 생략>,
  showPresets: <true 또는 생략>
)
```

### Step 3: 결과 출력

MCP 도구의 응답을 그대로 사용자에게 출력한다.
- 모듈별 설명, 포함 항목(커맨드/훅/문서 수), 의존성 정보를 포함한다.
- 프리셋별 설명과 포함 모듈 목록을 포함한다.

## Rules

- $ARGUMENTS에 알 수 없는 토큰이 있으면 무시하고 나머지 파라미터로 진행한다.
- 도구 호출 결과를 수정하거나 요약하지 말고 원문 그대로 전달한다.
