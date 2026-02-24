# Ship PR — 논리 커밋 + PR 원스톱 실행

스테이징되지 않은 변경사항을 논리 단위로 분류하여 커밋하고, feature 브랜치를 생성하여 PR을 올린다.

## Argument: $ARGUMENTS
PR 제목 또는 설명 (예: "기능 추가 PR", "버그 수정 모음")

## Instructions

### Phase 1: 현재 상태 분석

```bash
# 1. 현재 브랜치 확인
git branch --show-current

# 2. 변경 파일 목록
git status

# 3. 변경 내용 요약
git diff --stat

# 4. 최근 커밋 스타일 참고
git log --oneline -5
```

변경사항이 없으면 "커밋할 변경사항이 없습니다"를 출력하고 종료한다.

### Phase 1.5: README 최신화 확인

커밋 전에 README.md가 현재 변경사항을 반영하고 있는지 확인한다.

#### 확인 대상

README 업데이트가 필요한 변경이 있는지 검사한다:

```
변경된 파일 분석
   ↓
아래 조건 중 하나라도 해당하면 README 최신화 필요:
  ├── 훅 파일 변경 (.claude/hooks/*.sh) → README 훅 테이블 확인
  ├── 커맨드 파일 추가/삭제 (.claude/commands/*.md) → README 구조도 확인
  ├── 프로젝트 설정 변경 (project-setup*.md) → README Phase 설명 확인
  ├── 새 기능/컨셉 도입 (인터뷰 영역, 워크플로우 변경) → README 해당 섹션 확인
  ├── install.sh 변경 → README 요구사항/Quick Start 확인
  └── 템플릿 구조 변경 (templates/) → README 구조도 확인
```

#### 검사 로직

1. 변경 파일 목록에서 위 대상 파일이 있는지 확인
2. README.md가 존재하면 주요 키워드/수치가 실제 코드와 일치하는지 교차 확인:
   - 훅 개수 (예: "4개 훅" ↔ 실제 `.claude/hooks/*.sh` 파일 수)
   - 커맨드 개수 (예: "9개 커맨드" ↔ 실제 `.claude/commands/*.md` 파일 수)
   - 인터뷰 영역 수 (예: "5영역" ↔ project-setup.md 실제 Phase 3 내용)
   - 파일 구조도의 파일 목록 ↔ 실제 디렉토리 구조
3. 불일치 항목이 있으면 사용자에게 보고하고, README 업데이트를 먼저 수행

#### 결과 처리

```
[README 최신화 확인]

✅ 불일치 없음 → Phase 2로 진행
⚠️ 불일치 발견:
   - 훅 개수: README "3개" ↔ 실제 4개
   - 구조도에 session-log.md 누락
   → README.md를 먼저 업데이트한 후 변경 파일에 포함

📋 README와 무관한 변경만 있음 → Phase 2로 진행
```

- 불일치 발견 시: README.md를 업데이트하고 변경 파일 목록에 추가한다
- README.md가 없는 프로젝트는 이 Phase를 건너뛴다
- 사소한 코드 변경(버그 수정, 스타일 등)만 있으면 이 Phase를 건너뛴다

### Phase 2: 논리 단위 분류

변경된 파일들을 분석하여 **논리적으로 관련된 그룹**으로 분류한다.

#### 분류 기준

| 우선순위 | 기준 | 예시 |
|---------|------|------|
| 1 | 같은 기능/도메인 | 모델+서비스+라우트+테스트 → 하나의 커밋 |
| 2 | 같은 변경 유형 | 설정 파일들, 문서 파일들 |
| 3 | 종속 관계 | A가 B에 의존하면 A를 먼저 커밋 |
| 4 | 독립적 변경 | 서로 무관한 파일은 별도 커밋 |

#### 커밋 메시지 컨벤션

```
<type>: <설명 (영문, 소문자 시작, 현재형)>

<한국어 상세 설명 (2-3줄)>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**type 규칙:**
| type | 사용 | 예시 |
|------|------|------|
| `feat` | 새 기능 | feat: add user profile page |
| `fix` | 버그 수정 | fix: resolve null pointer in payment |
| `refactor` | 리팩토링 | refactor: extract auth middleware |
| `docs` | 문서 | docs: update API reference |
| `test` | 테스트 | test: add integration tests for cart |
| `chore` | 설정/빌드 | chore: update dependencies |
| `style` | 포맷/스타일 | style: apply prettier formatting |

#### 분류 결과 확인

분류 결과를 사용자에게 보여주고 AskUserQuestion으로 확인한다:

```
[커밋 계획]

1. feat: add user authentication
   - src/models/user.py
   - src/services/auth_service.py
   - src/routes/auth_routes.py
   - tests/test_auth.py

2. feat: add profile page
   - src/components/ProfilePage.tsx
   - src/components/AvatarUploader.tsx

3. docs: update README
   - README.md

총 3개 커밋 예정. 진행할까요?
```

### Phase 3: 브랜치 생성

현재 브랜치가 main/master라면 feature 브랜치를 생성한다.

```bash
CURRENT_BRANCH=$(git branch --show-current)
MAIN_BRANCH="master"  # 또는 "main"

if [ "$CURRENT_BRANCH" = "$MAIN_BRANCH" ]; then
    # 브랜치명 생성: feat/간결한-설명
    git checkout -b feat/<slug>
fi
```

브랜치명 규칙:
- `feat/` — 기능 추가
- `fix/` — 버그 수정
- `refactor/` — 리팩토링
- `docs/` — 문서
- 영문 소문자, 하이픈 구분, 20자 이내

### Phase 4: 순차 커밋

분류된 그룹별로 순서대로 커밋한다:

```bash
# 각 그룹별:
git add <파일1> <파일2> ...
git commit -m "$(cat <<'EOF'
<type>: <설명>

<상세 설명>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

**순서 규칙:**
1. 인프라/설정 변경 먼저
2. 모델/핵심 로직
3. 서비스/비즈니스 로직
4. UI/프론트엔드
5. 테스트
6. 문서

### Phase 4.5: Handoff Verify (독립 검증)

커밋이 완료된 후, PR 생성 전에 독립적인 Fresh-Context 검증을 실행한다.
작성자의 확인 편향(confirmation bias)을 제거하여 PR 품질을 보장한다.

#### 검증 실행

1. `.omc/state/handoff-intent.md`에 현재 PR 의도를 기록:
   - 변경 요약 (각 커밋의 목적)
   - 기대 동작
   - Acceptance Criteria

2. Task 도구로 독립 verifier 에이전트를 생성:
```
Task(subagent_type="oh-my-claudecode:verifier", prompt="
.omc/state/handoff-intent.md를 읽고 독립 검증:
1. 빌드 성공 여부
2. 전체 테스트 통과 여부
3. lint 에러 없음
결과를 .omc/state/handoff-verify-result에 저장
")
```

3. 검증 결과 확인:
```
✅ PASS → Phase 5로 진행
❌ FAIL → 실패 원인 수정 후 재커밋, Phase 4.5 재실행
```

#### 건너뛰기 조건

다음 경우 Phase 4.5를 건너뛸 수 있다:
- 문서만 변경한 경우 (`docs:` 커밋만 존재)
- 설정 파일만 변경한 경우 (`chore:` 커밋만 존재)
- 사용자가 `--skip-verify`를 명시한 경우

### Phase 5: Push + PR 생성

```bash
# 1. Push
git push -u origin <branch-name>

# 2. PR 생성
gh pr create --title "<PR 제목>" --body "$(cat <<'EOF'
## Summary
<1-3줄 요약>

## Changes
| 커밋 | 내용 |
|------|------|
| `<type>: <msg>` | <설명> |
| ... | ... |

## Test plan
- [ ] <테스트 항목>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Phase 6: 결과 보고

```
========================================
  Ship PR 완료
========================================

브랜치: feat/<name>
커밋: N개
검증: Handoff Verify PASS ✓
PR: <URL>

커밋 목록:
  1. feat: ...
  2. feat: ...
  3. docs: ...
```

## Rules
- main/master 브랜치에 직접 커밋하지 않는다 (feature 브랜치 필수)
- 커밋 메시지는 반드시 Co-Authored-By를 포함한다
- 분류 결과를 사용자에게 보여주고 확인 후 진행한다
- .env, credentials 등 민감 파일은 커밋하지 않는다
- 커밋 전 `git status`로 의도하지 않은 파일이 포함되지 않았는지 확인한다
- force push를 사용하지 않는다
- PR body는 HEREDOC으로 작성한다
