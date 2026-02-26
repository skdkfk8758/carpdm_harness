# Branch Info — 브랜치 상태 조회

현재 브랜치의 상세 정보를 보여준다.

## Instructions

### Step 1: 브랜치 정보 수집

```bash
# 현재 브랜치
BRANCH=$(git branch --show-current)

# main 대비 ahead/behind
git rev-list --left-right --count main...HEAD 2>/dev/null

# 최근 커밋
git log --oneline -5

# uncommitted changes
git status -s

# stash 목록
git stash list

# 원격 추적 상태
git branch -vv --list "$BRANCH"

# 브랜치 첫 커밋 (main에서 분기 시점)
git log main..HEAD --oneline --reverse | head -1
```

### Step 2: 결과 출력

```
Branch Info
━━━━━━━━━━━━━━━━━━━━━━━━

🔀 Branch: feat/42-add-login
   Remote: origin/feat/42-add-login (up to date)
   Base: main

📊 Main 대비
   Ahead: +5 commits
   Behind: 0 commits

📝 최근 커밋
   abc1234 feat(core): add login endpoint
   def5678 test(core): add login tests
   ghi9012 feat(ui): add login form

📁 미커밋 변경
   M src/core/auth.ts
   ? src/core/auth.test.ts

📦 Stash: 1개
   stash@{0}: WIP on feat/42-add-login

━━━━━━━━━━━━━━━━━━━━━━━━
```

## Rules
- 읽기 전용
- behind > 0이면 "main rebase/merge 권장" 경고
- 원격 브랜치가 없으면 "push 필요" 안내
- detached HEAD 상태면 경고 표시
