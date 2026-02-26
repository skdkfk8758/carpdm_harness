# Status — 원스톱 상태 조회

git 상태, 워크플로우 진행, todo 진행률, plan 상태를 한눈에 보여준다.

## Instructions

### Step 1: Git 상태 수집

```bash
BRANCH=$(git branch --show-current)
echo "Branch: $BRANCH"
git status -s
git log --oneline -3
git diff --stat HEAD 2>/dev/null
```

### Step 2: 워크플로우 상태 확인

`.harness/state/workflow.json` 존재 여부 확인.
- 존재하면: 워크플로우 타입, 상태, 현재 단계를 읽는다.
- 없으면: "활성 워크플로우 없음" 표시.

### Step 3: Todo 진행률

`.agent/todo.md`에서 체크박스 진행률 계산 (`[x]` / 전체).
없으면 "todo 없음" 표시.

### Step 4: Plan 상태

`.agent/plan.md`에서 상태(DRAFT/APPROVED/IN_PROGRESS/COMPLETED) 추출.
없으면 "plan 없음" 표시.

### Step 5: 결과 출력

```
══════════════════════════════════
  프로젝트 상태
══════════════════════════════════

🔀 Git
  Branch: feat/42-add-login
  Changes: 3 modified, 1 untracked
  최근 커밋: abc1234 feat(core): add login

📋 Todo: 3/5 (60%)
  현재: Step 4 — API 엔드포인트 구현

📝 Plan: APPROVED
  목표: 로그인 기능 추가

🔄 Workflow: feature (running)
  단계: 3/7 — executor

══════════════════════════════════
```

## Rules
- 모든 정보는 읽기 전용으로 수집 (수정 없음)
- 누락된 항목은 "없음"으로 표시 (에러 아님)
- 5초 이내에 완료되도록 간결하게 수집
