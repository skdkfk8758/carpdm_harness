# Todo — 작업 목록 조회

`.agent/todo.md`를 조회하고 진행률을 요약한다.

## Argument: $ARGUMENTS
필터 옵션 (예: "done", "pending", "current"). 없으면 전체 표시.

## Instructions

### Step 1: todo.md 읽기

`.agent/todo.md` 파일을 읽는다. 파일이 없으면 안내한다:
"todo.md가 없습니다. `/plan-gate`로 작업 계획을 먼저 수립하세요."

### Step 2: 진행률 계산

- 전체 항목 수: `[ ]` + `[x]` 체크박스 개수
- 완료 항목 수: `[x]` 개수
- 진행률: `완료/전체 (N%)`
- `← CURRENT` 마커가 있으면 현재 작업 항목 강조

### Step 3: 필터 적용

$ARGUMENTS에 따라 필터링:

| 인자 | 동작 |
|------|------|
| `done` | 완료된 항목만 (`[x]`) |
| `pending` | 미완료 항목만 (`[ ]`) |
| `current` | CURRENT 마커 항목만 |
| 없음 | 전체 표시 |

### Step 4: 결과 출력

```
📋 Todo 진행률: N/M (XX%)
━━━━━━━━━━━━━━━━━━━━
[현재 작업] Step N: <description> ← CURRENT
━━━━━━━━━━━━━━━━━━━━
- [x] Step 1: ...
- [x] Step 2: ...
- [ ] Step 3: ... ← CURRENT
- [ ] Step 4: ...
━━━━━━━━━━━━━━━━━━━━
다음: 항목 완료 시 /todo-update <step번호>
```

## Rules
- 파일을 수정하지 않는다 (읽기 전용)
- CURRENT 마커를 시각적으로 강조한다
- 진행률은 항상 표시한다
