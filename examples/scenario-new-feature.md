# 시나리오: 새 기능 개발 — "사용자 프로필 페이지"

> carpdm-harness v4.x 기준 MCP 도구 기반 워크플로우

## 전제 조건

- `harness_setup` + `harness_init` 완료된 프로젝트
- 기존에 User 모델, 인증 기능이 구현되어 있음

---

## Step 1: 작업 시작

```
사용자: "사용자 프로필 페이지를 만들어줘. 닉네임, 프로필 사진, 자기소개를 수정할 수 있어야 해."
```

## Step 2: /work-start 실행

```
/work-start
→ 워크플로우 타입: feature
→ 브랜치 생성: feat/user-profile-page
→ .agent/plan.md, todo.md 초기화
→ 온톨로지 요약 주입 (session-start 훅)
```

## Step 3: /plan-gate → Discovery Interview + SPARC 계획

### 3-1. Interview

```
Q1 [목표 & 범위]: "프로필 사진 업로드는 어디에 저장하나요?"
  (a) 로컬 파일시스템  (b) S3/클라우드 스토리지  (c) 아직 미정
  → 사용자: (b)

Q2 [기술적 제약]: "이미지 리사이즈가 필요한가요?"
  (a) 서버에서 처리  (b) 프론트에서 처리  (c) 원본 그대로
  → 사용자: (b)

Q3 [우선순위]: "MVP 범위는?"
  (a) 닉네임 + 자기소개만 먼저  (b) 프로필 사진까지 전부
  → 사용자: (b)
```

### 3-2. .agent/plan.md 생성 (SPARC)

```markdown
# Plan: 사용자 프로필 페이지
## 상태: DRAFT

## Spec
- 닉네임(2-20자, 중복 불가), 프로필 사진(S3, 프론트 리사이즈), 자기소개(200자)

## Pseudocode
1. ProfilePage → GET /api/users/me/profile
2. 수정 폼 → 사진 리사이즈(512x512) → S3 presigned URL 업로드
3. 저장 → PATCH /api/users/me/profile

## Architecture
- Model: UserProfile / Service: UserProfileService / Route: /api/users/me/profile
- Component: ProfilePage, ProfileForm, AvatarUploader

## Refinement
- Edge cases: 닉네임 중복, 이미지 5MB 초과, 비로그인 접근

## Completion
- [ ] 프로필 조회/수정 API + 테스트
- [ ] ProfilePage + AvatarUploader 컴포넌트
- [ ] E2E 시나리오 테스트
```

### 3-3. 사용자 승인

```
사용자: "좋아, 진행해"
→ plan.md 상태: APPROVED → IN_PROGRESS
```

## Step 4: 코드 작성

Claude가 .agent/todo.md를 실시간 갱신하며 작업 진행.
prompt-enricher 훅이 매 입력마다 behavioral guard 컨텍스트를 주입.

## Step 5: 검증

```
/verify-all
→ TRUST 5 품질 게이트 실행 (Tested + Readable + Unified + Secured + Trackable)
→ 모든 기준 통과 확인
```

## Step 6: 커밋 + PR

```
/work-finish
→ /logical-commit → 논리 단위 커밋 생성
→ /ship-pr → PR 생성 + 리뷰 준비
→ session-end 훅: handoff.md 자동 생성, session-log.md 기록
```

---

## 자동으로 작동한 것들

| 자동화 요소 | 담당 |
|------------|------|
| 온톨로지 요약 주입 | session-start 훅 |
| plan.md 없으면 경고 | workflow-guard 훅 |
| behavioral guard | prompt-enricher 훅 |
| 품질 게이트 | harness_quality_check 도구 |
| 세션 인수인계 | session-end 훅 |

사용자가 직접 한 것은 **요청, 인터뷰 답변, plan 승인, 최종 확인** 뿐입니다.
