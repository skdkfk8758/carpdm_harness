# Work Start — 작업 단위 브랜치 생성 및 환경 준비

사용자의 작업 설명을 입력받아 feature 브랜치를 생성하고, 선택적으로 git worktree를 사용하여 격리된 작업 환경을 준비한다.

## Argument: $ARGUMENTS
작업 설명 (예: "로그인 기능 추가", "버그 수정 #42", "--worktree 성능 최적화")

## Instructions

### Phase 1: 현재 상태 확인

```bash
# 1. 현재 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)
echo "현재 브랜치: $CURRENT_BRANCH"

# 2. 작업 트리 상태
git status -s

# 3. 기존 worktree 확인
git worktree list

# 4. main 브랜치 최신화 상태
git log --oneline -1 origin/main 2>/dev/null
```

### Phase 2: 사용자 입력 분석

$ARGUMENTS에서 다음을 추출한다:

| 패턴 | 추출 | 예시 |
|------|------|------|
| `#숫자` | 이슈 번호 | `#42` → issue=42 |
| `--worktree` 또는 `-w` | worktree 모드 | 격리 작업 환경 사용 |
| 나머지 텍스트 | 작업 설명 | 브랜치명 생성에 사용 |

#### 브랜치 타입 자동 추론

| 키워드 | 타입 |
|--------|------|
| 추가, 기능, feat, add, implement | `feat` |
| 수정, 버그, fix, bug, resolve | `fix` |
| 리팩토링, refactor, restructure | `refactor` |
| 문서, docs, readme | `docs` |
| 테스트, test | `test` |
| 설정, config, chore, deps | `chore` |
| 그 외 | `feat` (기본값) |

#### 브랜치명 생성 규칙

```
<type>/<issue-number>-<slug>   (이슈 번호 있을 때)
<type>/<slug>                  (이슈 번호 없을 때)
```

- slug: 영문 소문자, 하이픈 구분, 20자 이내
- 한글 설명은 영문으로 번역하여 slug 생성
- 예: "로그인 기능 추가 #42" → `feat/42-add-login`
- 예: "성능 최적화" → `perf/optimize-performance`

### Phase 3: 사전 검증

#### 3-1. uncommitted changes 확인

```bash
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️ uncommitted changes가 있습니다."
    echo "선택지:"
    echo "  1. git stash로 임시 저장 후 진행"
    echo "  2. 현재 변경사항을 먼저 커밋"
    echo "  3. 취소"
fi
```

사용자에게 AskUserQuestion으로 선택을 확인한다.

#### 3-2. main 브랜치 최신화

```bash
# main이 remote와 동기화되어 있는지 확인
git fetch origin main --quiet 2>/dev/null
LOCAL=$(git rev-parse main 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "⚠️ main 브랜치가 remote보다 뒤쳐져 있습니다."
    echo "git pull origin main을 먼저 실행합니다."
    git checkout main && git pull origin main
fi
```

#### 3-3. 브랜치 중복 확인

```bash
if git rev-parse --verify "$BRANCH_NAME" >/dev/null 2>&1; then
    echo "⚠️ 브랜치 '$BRANCH_NAME'이 이미 존재합니다."
    echo "해당 브랜치로 전환할까요?"
fi
```

### Phase 4: 브랜치 생성

#### 4-A. 일반 모드 (기본)

```bash
# main에서 새 브랜치 생성
git checkout main
git checkout -b <branch-name>

echo "✅ 브랜치 생성: <branch-name>"
echo "작업을 진행하세요. 완료 후: /work-finish"
```

#### 4-B. Worktree 모드 (`--worktree` 또는 `-w`)

```bash
# worktree 디렉토리 생성
WORKTREE_DIR="../<project-name>-<branch-slug>"

# main 기준으로 worktree + 새 브랜치 생성
git worktree add -b <branch-name> "$WORKTREE_DIR" main

echo "✅ Worktree 생성:"
echo "  브랜치: <branch-name>"
echo "  경로: $WORKTREE_DIR"
echo "  전환: cd $WORKTREE_DIR"
echo ""
echo "작업을 진행하세요. 완료 후: /work-finish"
```

### Phase 5: 작업 컨텍스트 기록

브랜치 메타데이터를 `.harness/state/`에 기록한다:

```bash
mkdir -p .harness/state
cat > .harness/state/current-work.json << 'HEREDOC'
{
  "branch": "<branch-name>",
  "type": "<type>",
  "issue": <issue-number or null>,
  "description": "<original-description>",
  "worktree": "<worktree-path or null>",
  "startedAt": "<ISO-timestamp>",
  "baseBranch": "main"
}
HEREDOC
```

### Phase 6: 결과 보고

```
========================================
  Work Start 완료
========================================

브랜치:   <branch-name>
타입:     <type>
이슈:     #<number> (없으면 생략)
모드:     일반 / worktree (<path>)
Base:     main

다음 단계:
  작업 진행 → /logical-commit (중간 커밋)
  작업 완료 → /work-finish (PR 생성)
  작업 취소 → git checkout main && git branch -d <branch>
```

## Rules
- main/master 브랜치에서만 새 브랜치를 생성한다 (다른 feature 브랜치에서 분기 금지)
- 브랜치명은 반드시 `<type>/<description>` 컨벤션을 따른다
- uncommitted changes가 있으면 반드시 사용자 확인 후 진행
- worktree 모드에서는 원본 저장소를 변경하지 않는다
- 이슈 번호가 있으면 반드시 브랜치명에 포함한다
