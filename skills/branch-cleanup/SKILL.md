---
name: harness-branch-cleanup
description: 다음 작업 전 브랜치 정리. "브랜치 정리", "로컬 브랜치 삭제", "다음 이슈 준비" 등을 요청할 때 사용합니다.
---

# Branch Cleanup

다음 이슈/작업으로 넘어가기 전에 현재 작업을 정리하고 불필요한 로컬 브랜치를 제거합니다.

## 실행 흐름

### Step 1: 현재 상태 확인

다음 명령을 **병렬 실행**:
```bash
git status --short
git branch --show-current
git stash list
```

### Step 2: 미커밋 변경사항 처리

| 상태 | 액션 |
|------|------|
| 변경사항 있음 + 작업 완료 | 사용자에게 커밋 여부 확인 → 커밋 or stash |
| 변경사항 있음 + 작업 미완료 | `git stash push -m "WIP: <현재 브랜치명>"` |
| 변경사항 없음 | 바로 Step 3 |

커밋 시 `/carpdm-harness:logical-commit` 스킬 활용 권장.

### Step 3: main 브랜치 전환 + 최신화

```bash
git checkout main
git pull --rebase origin main
```

### Step 4: 병합 완료된 로컬 브랜치 정리

```bash
# 병합 완료 브랜치 확인
git branch --merged main
```

사용자에게 **삭제 대상 목록을 표시**하고 확인 후 삭제:
```bash
# main, master, develop은 제외
git branch --merged main | grep -vE '^\*|main|master|develop' | xargs -r git branch -d
```

**주의**: `git branch -D` (강제 삭제) 절대 사용하지 않음. `-d` (안전 삭제)만 사용.

### Step 5: 원격 추적 브랜치 정리 (선택)

```bash
# 원격에서 이미 삭제된 브랜치의 로컬 추적 정보 제거
git remote prune origin
```

### Step 6: 결과 보고

```bash
git branch        # 남은 로컬 브랜치
git branch -r     # 원격 브랜치 (참조용)
```

정리 결과를 요약:
- 삭제된 브랜치 수
- 남은 로컬 브랜치 목록
- 현재 브랜치: main (최신 상태)

## 인자 매핑

| 사용자 입력 | 매핑 |
|-------------|------|
| `"다음 이슈"`, `"다음 작업"` | 전체 흐름 (Step 1~6) |
| `"브랜치 정리"`, `"로컬 브랜치 삭제"` | Step 4~6만 (변경사항 처리 생략) |
| `"stash"` 포함 | Step 2에서 무조건 stash 선택 |
| 특정 브랜치명 포함 | 해당 브랜치만 삭제 대상으로 지정 |

## 안전 규칙

- `main`, `master`, `develop` 브랜치는 절대 삭제하지 않음
- 병합되지 않은 브랜치(`--no-merged`)는 목록에 표시만 하고 삭제하지 않음
- 강제 삭제(`-D`)는 사용자가 명시적으로 요청한 경우에만 사용
- 삭제 전 반드시 목록을 사용자에게 보여주고 확인 받기

## 후속 안내

정리 완료 후:
1. `/carpdm-harness:work-start` — 새 이슈 작업 시작 (feature 브랜치 생성)
2. `git stash list` — stash 한 작업이 있으면 복원 안내
