# Context — 작업 컨텍스트 통합 조회

`.agent/` 디렉토리의 컨텍스트 파일들을 통합하여 현재 작업 맥락을 보여준다.

## Argument: $ARGUMENTS
특정 컨텍스트 파일 (예: "lessons", "handoff", "memory"). 없으면 전체 요약.

## Instructions

### Step 1: 컨텍스트 파일 수집

다음 파일들을 존재하는 것만 읽는다:

1. `.agent/context.md` — 세션 컨텍스트
2. `.agent/lessons.md` — 배운 교훈
3. `.agent/session-log.md` — 세션 로그
4. `.agent/memory.md` — 팀 메모리 요약
5. `.agent/handoff.md` — 인수인계 문서

### Step 2: 필터 적용

$ARGUMENTS가 있으면 해당 파일만 전체 내용 표시:

| 인자 | 대상 파일 |
|------|----------|
| `context` | `.agent/context.md` |
| `lessons` | `.agent/lessons.md` |
| `log` | `.agent/session-log.md` |
| `memory` | `.agent/memory.md` |
| `handoff` | `.agent/handoff.md` |

### Step 3: 통합 출력 (인자 없음)

```
══════════════════════════════════
  작업 컨텍스트
══════════════════════════════════

📝 Context
  <context.md 내용 요약 — 최대 5줄>

📚 최근 교훈 (최대 5개)
  1. <lesson>
  2. <lesson>

📓 세션 로그 (최근 3개 항목)
  - <log entry>

🧠 팀 메모리
  - <memory summary>

🤝 인수인계
  <handoff 요약>

══════════════════════════════════
```

## Rules
- 읽기 전용
- 없는 파일은 "없음" 표시
- 요약 모드에서 각 파일은 핵심만 (lessons: 최근 5개, log: 최근 3개)
- 특정 파일 지정 시 전체 내용 표시
