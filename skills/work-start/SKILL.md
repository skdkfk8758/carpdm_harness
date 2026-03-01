---
name: harness-work-start
description: 작업 단위 브랜치 생성 및 환경 준비. "작업 시작", "새 작업", "work start"를 요청할 때 사용합니다.
---

# Work Start

새 작업 단위를 시작합니다. Feature 브랜치 생성 + Knowledge Vault 브랜치 문서 초기화 + 작업 상태 기록.

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
| 변경사항 있음 | 사용자에게 커밋/stash 여부 확인 |
| 변경사항 없음 | 바로 Step 3 |

### Step 3: 브랜치 생성

사용자 입력에서 작업 유형과 설명을 추출하여 브랜치명 생성:

```bash
# main에서 최신 상태로 시작
git checkout main
git pull --rebase origin main

# feature 브랜치 생성
git checkout -b <type>/<description>
```

**브랜치 네이밍 규칙**:
- `feat/<description>` — 기능 추가
- `fix/<description>` — 버그 수정
- `refactor/<description>` — 리팩토링
- `chore/<description>` — 기타

이슈 번호가 있으면: `feat/<issue-number>-<description>`

### Step 4: Knowledge Vault 브랜치 문서 초기화

`.knowledge/` 디렉토리가 존재하면 브랜치 작업 문서를 자동 생성합니다:

```
.knowledge/branches/<branch-name>/
├── spec.md        # 스펙 (목표, 요구사항, 제약사항)
├── design.md      # 설계 (아키텍처 결정, 컴포넌트, 데이터 흐름)
├── decisions.md   # 결정 기록
└── notes.md       # 자유 메모
```

> Knowledge Vault가 없으면 이 단계를 건너뜁니다 (graceful skip).

### Step 5: 작업 상태 기록

`.harness/state/current-work.json`에 작업 상태를 기록합니다:

```json
{
  "branch": "<branch-name>",
  "type": "feat",
  "description": "<description>",
  "startedAt": "<ISO timestamp>",
  "issueNumber": null
}
```

### Step 6: plan-gate 안내

작업 시작 후:
1. `/plan-gate` — 인터뷰 + SPARC 프로세스로 계획 수립 권장
2. 또는 직접 `.agent/plan.md`, `.agent/todo.md` 작성

## 인자 매핑

| 사용자 입력 | 매핑 |
|-------------|------|
| `"작업 시작 #123 로그인 버그"` | type=fix, issue=123, desc=login-bug |
| `"새 작업 사용자 프로필 추가"` | type=feat, desc=user-profile |
| `"work start refactor auth"` | type=refactor, desc=auth |

## 후속 안내

작업 시작 후:
1. `/plan-gate` — 계획 수립 (권장)
2. `/todo` — TODO 목록 확인
3. `.knowledge/branches/<branch>/spec.md` — 스펙 작성
