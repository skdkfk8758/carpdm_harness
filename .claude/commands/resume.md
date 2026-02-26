# Resume — 이전 세션 이어받기

이전 세션의 작업 상태를 복원하고 이어서 작업할 수 있도록 컨텍스트를 로드한다.

## Instructions

### Step 1: 인수인계 문서 확인

`.agent/handoff.md` 파일을 읽는다. 이전 세션에서 `/work-finish`로 작성한 인수인계 컨텍스트.
없으면 "인수인계 문서 없음" 표시.

### Step 2: 현재 작업 상태 복원

다음 파일들을 존재하는 것만 읽는다:

1. `.agent/todo.md` — 진행률 + CURRENT 항목
2. `.agent/plan.md` — 계획 상태
3. `.agent/context.md` — 세션 컨텍스트
4. `.agent/lessons.md` — 최근 교훈 5개
5. `.agent/session-log.md` — 마지막 세션 로그

### Step 3: Git 상태 확인

```bash
# 현재 브랜치와 마지막 커밋
git branch --show-current
git log --oneline -5

# 미커밋 변경사항
git status -s

# stash
git stash list
```

### Step 4: 워크플로우 상태 확인

`.harness/state/workflow.json` 존재 시 현재 워크플로우 단계를 확인한다.

### Step 5: 복원 보고

```
══════════════════════════════════
  세션 복원
══════════════════════════════════

📋 이전 작업: <handoff.md 요약 또는 없음>

📝 Plan: <상태>
✅ Todo: N/M (XX%) — 현재: Step N
🔀 Branch: <branch-name>
   마지막 커밋: <commit-message>
   미커밋: N files

📚 최근 교훈:
  - <lesson 1>
  - <lesson 2>

🔄 Workflow: <상태 또는 없음>

══════════════════════════════════
이어서 작업하세요.
══════════════════════════════════
```

## Rules
- 모든 파일은 읽기 전용 (수정 없음)
- 파일이 없는 항목은 "없음"으로 표시
- handoff.md가 가장 중요한 컨텍스트 — 최우선 표시
- 복원 후 다음 할 일을 명확히 안내
