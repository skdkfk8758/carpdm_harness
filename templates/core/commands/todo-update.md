# Todo Update — 작업 항목 갱신

`.agent/todo.md`의 항목을 체크/언체크하고 CURRENT 마커를 이동한다.

## Argument: $ARGUMENTS
갱신 명령 (예: "3 done", "4 current", "next", "add 새 항목"). 없으면 현재 항목 완료 + 다음 이동.

## Instructions

### Step 1: todo.md 읽기

`.agent/todo.md` 파일을 읽는다. 없으면 에러:
"todo.md가 없습니다. `/plan-gate`로 계획을 먼저 수립하세요."

### Step 2: 명령 파싱

$ARGUMENTS에서 명령을 추출:

| 패턴 | 동작 | 예시 |
|------|------|------|
| `N done` 또는 `N` | Step N을 완료 `[x]` + CURRENT를 다음으로 | `3 done` |
| `N undo` | Step N을 미완료로 되돌림 `[ ]` | `3 undo` |
| `N current` | Step N에 CURRENT 마커 이동 | `4 current` |
| `next` | 현재 CURRENT의 다음 미완료 항목으로 이동 | `next` |
| `add <텍스트>` | 마지막에 새 항목 추가 | `add API 테스트 작성` |
| 인자 없음 | 현재 CURRENT 항목 완료 + 다음 이동 | |

### Step 3: todo.md 갱신

해당 항목의 체크박스와 CURRENT 마커를 수정한다.

- **done**: `- [ ]` → `- [x]`, CURRENT를 다음 미완료 항목으로 자동 이동
- **undo**: `- [x]` → `- [ ]`
- **current**: 기존 CURRENT 제거, 해당 항목에 `← CURRENT` 추가
- **next**: 현재 CURRENT의 다음 `[ ]` 항목으로 마커 이동
- **add**: 마지막 체크박스 항목 뒤에 새 `- [ ] Step N+1: <텍스트>` 추가

### Step 4: 진행률 헤더 갱신

`## Progress: N/M completed` 라인의 숫자를 갱신한다.
전체 완료 시 `## Progress: M/M completed ✓` 표시.

### Step 5: 결과 보고

```
Todo 갱신 완료
━━━━━━━━━━━━━━━
변경: Step 3 → ✅ done
진행률: 4/6 (67%)
다음: Step 4 — API 엔드포인트 구현 ← CURRENT
```

전체 완료 시:
```
Todo 갱신 완료
━━━━━━━━━━━━━━━
🎉 모든 항목 완료! (6/6)
다음: /work-finish 로 작업을 마무리하세요.
```

## Rules
- 존재하지 않는 Step 번호는 에러 처리
- CURRENT 마커는 항상 하나만 유지
- done 처리 시 자동으로 CURRENT를 다음 미완료 항목으로 이동
- 진행률 헤더는 반드시 갱신
- 전체 완료 시 `/work-finish` 안내
