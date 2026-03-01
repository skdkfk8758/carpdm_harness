---
name: harness-work-finish
description: 작업 완료 및 PR 제출. "작업 완료", "작업 마무리", "work finish"를 요청할 때 사용합니다.
---

# Work Finish

현재 작업 단위를 마무리합니다. 품질 검증 + Knowledge Vault 아카이브 + PR 생성.

## 실행 흐름

### Step 1: 현재 상태 확인

다음 명령을 **병렬 실행**:
```bash
git status --short
git branch --show-current
git log --oneline main..HEAD
```

**main 브랜치에서 실행 시**: "현재 main 브랜치입니다. feature 브랜치에서 실행하세요."

### Step 2: 미커밋 변경사항 처리

| 상태 | 액션 |
|------|------|
| 변경사항 있음 | `/logical-commit`으로 논리 커밋 생성 |
| 변경사항 없음 | 바로 Step 3 |

### Step 3: 품질 검증 (선택)

사용자에게 품질 검증 실행 여부 확인:

```
/quick-check    # 빠른 빌드 + 타입체크 + 테스트
/review-prep    # PR 제출 전 셀프 리뷰
```

### Step 4: Knowledge Vault 브랜치 아카이브

`.knowledge/branches/<branch>/` 디렉토리가 존재하면:
1. 브랜치 문서를 `.knowledge/branches/_archive/<branch>/`로 이동
2. Knowledge Index 갱신

> Knowledge Vault가 없으면 이 단계를 건너뜁니다 (graceful skip).

### Step 5: PR 생성

`/ship-pr` 스킬을 호출하여 논리 커밋 + PR 생성을 원스톱으로 실행합니다.

또는 수동으로:
```bash
git push -u origin <current-branch>
gh pr create --title "<PR 제목>" --body "<PR 본문>"
```

### Step 6: 작업 상태 완료 기록

`.harness/state/current-work.json`을 업데이트:

```json
{
  "completedAt": "<ISO timestamp>",
  "prUrl": "<PR URL>"
}
```

### Step 7: 후속 안내

PR 생성 완료 후:
1. `/branch-cleanup` — 다음 작업 전 브랜치 정리
2. `/work-start` — 새 작업 시작

## 인자 매핑

| 사용자 입력 | 매핑 |
|-------------|------|
| `"작업 완료"` | 전체 흐름 (Step 1~7) |
| `"PR 올려줘"` | Step 2~5 (커밋 + PR 중심) |
| `"작업 마무리"` | 전체 흐름 |

## 안전 규칙

- main 브랜치에서는 실행하지 않음 (feature 브랜치 필수)
- 미커밋 변경사항은 반드시 처리 후 PR 생성
- PR 생성 전 최소 1회 빌드/테스트 통과 권장
