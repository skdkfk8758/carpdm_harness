# Changelog — 변경 내역 생성

마지막 태그/릴리스 이후의 변경 내역을 conventional commits 기반으로 생성한다.

## Argument: $ARGUMENTS
기준점 (예: "v1.0.0", "main", 커밋 해시). 없으면 마지막 태그 자동 감지.

## Instructions

### Step 1: 기준점 결정

```bash
# 마지막 태그
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null)
```

$ARGUMENTS가 있으면 해당 기준 사용, 없으면 마지막 태그 사용.
태그가 없으면 전체 이력에서 최근 30개.

### Step 2: 커밋 수집

```bash
git log ${BASE}..HEAD --oneline --no-merges
```

### Step 3: 커밋 분류

Conventional Commits 기준:

| 타입 | 분류 |
|------|------|
| `feat` | Features |
| `fix` | Bug Fixes |
| `refactor` | Refactoring |
| `perf` | Performance |
| `test` | Tests |
| `docs` | Documentation |
| `chore` | Chores |
| 기타 | Miscellaneous |

### Step 4: 변경 내역 출력

```
Changelog (since <base>)
━━━━━━━━━━━━━━━━━━━━━━━━

Features (N)
  - feat(core): add workflow FSM (abc1234)
  - feat(tools): add new MCP tool (def5678)

Bug Fixes (N)
  - fix(hooks): resolve timeout issue (ghi9012)

Refactoring (N)
  - refactor(types): simplify interfaces (jkl3456)

━━━━━━━━━━━━━━━━━━━━━━━━
총 N개 커밋 | 기준: <base>
```

## Rules
- conventional commits 형식이 아닌 커밋은 "Miscellaneous"로 분류
- scope가 있으면 scope별로 그룹핑
- 머지 커밋은 제외
- 읽기 전용 (CHANGELOG.md 파일 생성/수정 안 함)
