# 시나리오: 새 기능 개발 — "사용자 프로필 페이지"

이 문서는 Agent Harness가 적용된 프로젝트에서 새 기능을 개발하는 실제 시나리오입니다.

## 전제 조건

- `/project-setup "React + FastAPI 웹앱"` 완료된 상태
- 기존에 User 모델, 인증 기능이 구현되어 있음

---

## Step 1: 작업 요청

```
사용자 입력:
> 사용자 프로필 페이지를 만들어줘.
> 닉네임, 프로필 사진, 자기소개를 수정할 수 있어야 해.
```

## Step 2: pre-task.sh 자동 실행

```
[TASK MODE] Standard
[SPARC] plan.md를 확인하세요. 없으면 /plan-gate를 실행하세요.
```

## Step 3: Claude가 /plan-gate 실행

### 3-1. Discovery Interview

```
Claude: "프로필 페이지에 대해 몇 가지 확인하겠습니다."

Q1 [목표 & 범위]:
   "프로필 사진 업로드는 어디에 저장하나요?"
   (a) 로컬 파일시스템
   (b) S3/클라우드 스토리지
   (c) 아직 미정

   사용자: (b)

Q2 [기술적 제약]:
   "이미지 리사이즈가 필요한가요?"
   (a) 네, 서버에서 처리
   (b) 네, 프론트에서 처리
   (c) 아니오, 원본 그대로

   사용자: (b)

Q3 [우선순위]:
   "MVP 범위는?"
   (a) 닉네임 + 자기소개만 먼저
   (b) 프로필 사진까지 전부
   (c) 추가로 계정 설정(비밀번호 변경 등)까지

   사용자: (b)
```

### 3-2. plan.md 생성

```markdown
# Plan: 사용자 프로필 페이지

## 상태: DRAFT

## Spec (명세)
- 사용자가 닉네임, 프로필 사진, 자기소개를 조회/수정
- 프로필 사진: S3 업로드, 프론트에서 리사이즈
- 닉네임: 2-20자, 중복 불가
- 자기소개: 최대 200자

## Pseudocode (의사코드)
1. ProfilePage 진입 → GET /api/users/me/profile
2. 수정 폼 표시 (닉네임, 사진, 자기소개)
3. 사진 선택 → 프론트 리사이즈 (max 512x512) → S3 presigned URL 업로드
4. 저장 → PATCH /api/users/me/profile
5. 성공 → 토스트 알림, 실패 → 에러 표시

## Architecture (아키텍처)
- Model: UserProfile (nickname, avatar_url, bio)
- Store: UserProfileStore (Protocol)
- Service: UserProfileService
- Route: /api/users/me/profile (GET, PATCH)
- Component: ProfilePage, ProfileForm, AvatarUploader

## Refinement (정제)
- 엣지 케이스: 닉네임 중복, 이미지 용량 초과(5MB), 비로그인 접근
- S3 presigned URL 만료: 5분

## Completion (완료 조건)
- [ ] 프로필 조회 API + 테스트
- [ ] 프로필 수정 API + 테스트
- [ ] ProfilePage 컴포넌트
- [ ] AvatarUploader (리사이즈 + S3)
- [ ] 에러 처리 (중복 닉네임, 이미지 초과)
- [ ] E2E 시나리오 테스트
```

### 3-3. 사용자 승인

```
사용자: "좋아, 진행해"
→ plan.md 상태: APPROVED → IN_PROGRESS
```

## Step 4: todo.md 생성

```markdown
# TODO: 사용자 프로필 페이지

## 진행 중
- [ ] UserProfile 모델 정의 ← CURRENT

## 대기
- [ ] UserProfileStore 구현
- [ ] UserProfileService 구현
- [ ] Profile API 라우트 (GET, PATCH)
- [ ] ProfilePage 컴포넌트
- [ ] AvatarUploader 컴포넌트
- [ ] 테스트 작성

## 완료
```

## Step 5: 코드 작성

Claude가 각 파일을 생성/수정할 때마다 자동으로:

### code-change.sh 기록 예시 (.omc/change-log.md)

```markdown
## 2026-02-23

| 시각 | 유형 | 파일 | 이유 (현재 TODO) |
|------|------|------|-----------------|
| 14:30:01 | CREATE | `src/models/user_profile.py` | UserProfile 모델 정의 |
| 14:31:15 | CREATE | `src/stores/user_profile_store.py` | UserProfileStore 구현 |
| 14:32:40 | CREATE | `src/services/user_profile_service.py` | UserProfileService 구현 |
| 14:34:20 | MODIFY | `src/routes/user_routes.py` | Profile API 라우트 (GET, PATCH) |
| 14:36:05 | CREATE | `src/components/ProfilePage.tsx` | ProfilePage 컴포넌트 |
| 14:37:30 | CREATE | `src/components/AvatarUploader.tsx` | AvatarUploader 컴포넌트 |
| 14:39:10 | CREATE | `tests/test_user_profile.py` | 테스트 작성 |
```

## Step 6: 검증 (post-task.sh → 교차 검증)

```
[POST TASK] 교차 검증 트리거
  → 7개 소스 파일 변경 감지
  → Codex MCP로 교차 검증 실행

[교차 검증 결과]
검증자: Codex (GPT)
관점: code-reviewer (종합)

1. 로직 정확성: ✓ PASS
2. DDD 패턴: ✓ PASS — Model→Store→Service→Route 준수
3. 에러 처리: ✓ PASS
4. 보안: ! SUGGESTION
   → "presigned URL 생성 시 Content-Type 제한 추가 권장"
5. 테스트 커버리지: ✓ PASS — 주요 시나리오 커버

사용자 확인 필요 항목:
  → presigned URL에 Content-Type 화이트리스트 적용 여부
```

## Step 7: 커밋

```
/logical-commit "feat: 사용자 프로필 페이지 (조회/수정/아바타 업로드)"
```

```
생성된 커밋:
  feat: 사용자 프로필 페이지 (조회/수정/아바타 업로드)

  - UserProfile 모델 + Store + Service 추가
  - GET/PATCH /api/users/me/profile API
  - ProfilePage, AvatarUploader 컴포넌트
  - 프론트 이미지 리사이즈 (512x512)
  - S3 presigned URL 업로드
  - 테스트 7개 추가

  변경 파일 (7):
    src/models/user_profile.py
    src/stores/user_profile_store.py
    src/services/user_profile_service.py
    src/routes/user_routes.py
    src/components/ProfilePage.tsx
    src/components/AvatarUploader.tsx
    tests/test_user_profile.py
```

---

## 이 시나리오에서 자동으로 작동한 것들

| 자동화 요소 | 담당 |
|------------|------|
| Task Mode 감지 | pre-task.sh |
| plan.md 없으면 경고 | plan-guard.sh |
| 인터뷰 → 계획 수립 | /plan-gate |
| 파일 변경 기록 | code-change.sh |
| DDD 패턴 리마인더 | code-change.sh |
| 교차 검증 트리거 | post-task.sh |
| 교차 검증 실행 | Codex MCP / 서브에이전트 |

사용자가 직접 한 것은 **요청, 인터뷰 답변, plan 승인, 최종 확인** 뿐입니다.
