# Work Finish — 작업 완료 및 PR 제출

현재 브랜치의 작업을 정리하고, 논리 커밋 + PR 생성 + worktree 정리를 수행한다.

## Argument: $ARGUMENTS
PR 제목 또는 추가 옵션 (예: "로그인 기능 완성", "--skip-verify", "--draft")

## Instructions

### Phase 1: 현재 상태 확인

```bash
# 1. 현재 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)
echo "현재 브랜치: $CURRENT_BRANCH"

# 2. main/master인지 확인
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    echo "❌ main 브랜치에서는 /work-finish를 실행할 수 없습니다."
    echo "/work-start로 먼저 feature 브랜치를 생성하세요."
    exit 1
fi

# 3. 변경 파일 확인
git status -s
git diff --stat HEAD

# 4. 작업 컨텍스트 확인
if [ -f ".harness/state/current-work.json" ]; then
    cat .harness/state/current-work.json
fi

# 5. worktree 여부 확인
git rev-parse --git-dir | grep -q "worktrees" && echo "Worktree 모드" || echo "일반 모드"
```

작업 컨텍스트(`.harness/state/current-work.json`)가 있으면 이슈 번호, 설명 등을 PR에 활용한다.

### Phase 2: 미커밋 변경사항 정리

uncommitted changes가 있으면 `/logical-commit`과 동일한 로직으로 논리 커밋을 수행한다.

#### 2-1. README 최신화 확인

`/logical-commit` Phase 0.5와 동일:
- 변경 파일 중 README 영향 항목 확인
- 불일치 발견 시 README 업데이트 후 포함

#### 2-2. 논리 단위 분류 + 커밋

- 변경 파일을 논리 그룹으로 분류
- 그룹별 순차 커밋 (Conventional Commits)
- 이슈 번호가 있으면 커밋 메시지에 포함 (예: `feat(auth): add login (#42)`)

### Phase 3: PR 생성

```bash
# 1. Push
git push -u origin "$CURRENT_BRANCH"

# 2. PR 제목 결정
#    - $ARGUMENTS가 있으면 사용
#    - 없으면 작업 컨텍스트에서 추출
#    - 둘 다 없으면 브랜치명 기반 자동 생성

# 3. PR 생성
gh pr create --title "<PR 제목>" --body "$(cat <<'EOF'
## Summary
<작업 컨텍스트 또는 커밋 목록 기반 요약>

## Changes
| 커밋 | 내용 |
|------|------|
| `<type>: <msg>` | <설명> |

## Issue
<Closes #이슈번호 (있을 때만)>

## Test plan
- [ ] typecheck 통과
- [ ] 테스트 통과
- [ ] README 최신 상태

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

`--draft` 옵션이 있으면 `gh pr create --draft`로 생성한다.

### Phase 4: Worktree 정리 (해당 시)

현재 worktree에서 작업 중이었다면 정리한다:

```bash
# worktree 여부 확인
GIT_DIR=$(git rev-parse --git-dir)
if echo "$GIT_DIR" | grep -q "worktrees"; then
    WORKTREE_PATH=$(pwd)
    MAIN_REPO=$(git rev-parse --git-common-dir | xargs dirname)

    echo ""
    echo "Worktree 정리:"
    echo "  PR이 생성되었으므로 worktree를 정리할 수 있습니다."
    echo "  경로: $WORKTREE_PATH"
    echo ""
    echo "  1. 지금 정리 (main으로 돌아감)"
    echo "  2. 나중에 정리 (worktree 유지)"
fi
```

사용자에게 AskUserQuestion으로 확인한다.

정리 선택 시:

```bash
cd "$MAIN_REPO"
git worktree remove "$WORKTREE_PATH"
echo "✅ Worktree 제거 완료. main 저장소로 돌아왔습니다."
```

### Phase 5: 작업 컨텍스트 정리

```bash
# 작업 메타데이터 업데이트
if [ -f ".harness/state/current-work.json" ]; then
    # completedAt, prUrl 추가
    node -e "
      const fs = require('fs');
      const d = JSON.parse(fs.readFileSync('.harness/state/current-work.json','utf-8'));
      d.completedAt = new Date().toISOString();
      d.prUrl = '<PR_URL>';
      fs.writeFileSync('.harness/state/current-work.json', JSON.stringify(d, null, 2));
    "
fi
```

### Phase 6: 결과 보고

```
========================================
  Work Finish 완료
========================================

브랜치:   <branch-name>
커밋:     N개
PR:       <URL>
이슈:     Closes #<number> (있을 때만)
Worktree: 정리됨 / 유지 중

다음 단계:
  PR 머지 + 릴리스: /ship-release
  PR 수정:         git push (추가 커밋 후)
```

## Rules
- main 브랜치에서는 실행 불가 (feature 브랜치 필수)
- 커밋 메시지는 반드시 Conventional Commits + Co-Authored-By 포함
- 이슈 번호가 있으면 PR body에 `Closes #번호` 포함
- force push 금지
- worktree 정리는 반드시 사용자 확인 후 진행
- .env, credentials 등 민감 파일은 커밋하지 않는다
