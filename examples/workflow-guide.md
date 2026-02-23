# Agent Harness 워크플로우 가이드

이 문서는 Agent Harness 설치 후 실제 작업 흐름을 단계별로 설명합니다.

## 목차

1. [세팅 직후 첫 작업](#1-세팅-직후-첫-작업)
2. [일반적인 기능 개발 흐름](#2-일반적인-기능-개발-흐름)
3. [버그 수정 흐름](#3-버그-수정-흐름)
4. [교차 검증이 작동하는 흐름](#4-교차-검증이-작동하는-흐름)
5. [Simple vs Full 버전 비교](#5-simple-vs-full-버전-비교)

---

## 1. 세팅 직후 첫 작업

### 상황

프로젝트 세팅을 막 완료한 상태. 첫 기능을 개발하려고 합니다.

### 흐름

```
사용자: "로그인 페이지 만들어줘"
         ↓
   ┌─────────────────────────────────────┐
   │  pre-task.sh 자동 실행              │
   │  → Task Mode 감지: Standard        │
   │  → SPARC 리마인더 출력              │
   │    "plan.md를 먼저 작성하세요"       │
   └─────────────────────────────────────┘
         ↓
   Claude: "로그인 페이지 계획을 세우겠습니다."
         ↓
   ┌─────────────────────────────────────┐
   │  plan.md 작성                       │
   │  ┌───────────────────────────────┐  │
   │  │ # Plan: 로그인 페이지         │  │
   │  │ ## 상태: DRAFT                │  │
   │  │ ## 목표                       │  │
   │  │ - 이메일/비밀번호 로그인      │  │
   │  │ ## 작업 항목                  │  │
   │  │ 1. LoginForm 컴포넌트        │  │
   │  │ 2. 인증 API 연결              │  │
   │  │ 3. 에러 처리                  │  │
   │  └───────────────────────────────┘  │
   └─────────────────────────────────────┘
         ↓
   사용자: "좋아, 진행해"
         ↓
   Claude: plan.md 상태 → APPROVED로 변경
         ↓
   ┌─────────────────────────────────────┐
   │  todo.md 생성                       │
   │  - [ ] LoginForm 컴포넌트 ← CURRENT│
   │  - [ ] 인증 API 연결               │
   │  - [ ] 에러 처리                    │
   └─────────────────────────────────────┘
         ↓
   코드 작성 시작 (LoginForm.tsx)
         ↓
   ┌─────────────────────────────────────┐
   │  code-change.sh 자동 실행           │
   │  → .omc/change-log.md에 기록       │
   │    "MODIFY LoginForm.tsx"           │
   │    "이유: LoginForm 컴포넌트"       │
   │  → DDD 패턴 확인 리마인더           │
   └─────────────────────────────────────┘
         ↓
   모든 작업 완료
         ↓
   ┌─────────────────────────────────────┐
   │  post-task.sh 자동 실행             │
   │  → todo.md 미완료 항목 확인         │
   │  → "3개 중 0개 남음 ✓"              │
   │  → 교차 검증 트리거                  │
   └─────────────────────────────────────┘
```

### 사용자가 할 일

1. 요청을 입력한다
2. plan.md를 확인하고 승인한다
3. 완료 후 결과를 확인한다

나머지는 모두 자동으로 처리됩니다.

---

## 2. 일반적인 기능 개발 흐름

### 상황

이미 세팅된 프로젝트에서 새 기능을 추가합니다.

### 단계별 흐름

```
Step 1: 요청
├── 사용자: "장바구니에 쿠폰 적용 기능 추가해줘"
│
Step 2: 계획 수립 (자동)
├── /plan-gate 실행 (또는 자동 감지)
├── Discovery Interview
│   ├── Q1: "쿠폰 유형은? (정액/정률/무료배송)"
│   ├── Q2: "중복 적용 가능한가요?"
│   └── Q3: "쿠폰 유효기간 체크 필요?"
├── plan.md 작성 (SPARC 프로세스)
│   ├── Spec: 쿠폰 도메인 모델 정의
│   ├── Pseudocode: 할인 계산 로직
│   ├── Architecture: Coupon → CouponStore → CouponService → CartRoute
│   ├── Refinement: 엣지 케이스 (만료, 최소금액, 중복)
│   └── Completion: 테스트 목록
│
Step 3: 사용자 승인
├── plan.md 검토 → "APPROVED"
│
Step 4: 코드 작성 (자동)
├── todo.md 생성
├── 파일 생성/수정 (각각 code-change.sh 트리거)
│   ├── src/models/coupon.py         → change-log: CREATE
│   ├── src/stores/coupon_store.py   → change-log: CREATE
│   ├── src/services/coupon_service.py → change-log: CREATE
│   ├── src/routes/cart_routes.py    → change-log: MODIFY
│   └── tests/test_coupon.py         → change-log: CREATE
│
Step 5: 검증 (자동/수동)
├── post-task.sh → 교차 검증 트리거
├── /post-task-check (상세 검증)
└── 사용자 최종 확인
│
Step 6: 커밋
└── /logical-commit "feat: 장바구니 쿠폰 적용 기능"
```

---

## 3. 버그 수정 흐름

### 상황

프로덕션에서 버그가 발생했습니다.

### 단계별 흐름

```
사용자: "빨리 고쳐! 결제할 때 500 에러가 나"
         ↓
   ┌─────────────────────────────────────┐
   │  pre-task.sh 자동 실행              │
   │  → "빨리" 키워드 감지               │
   │  → Task Mode: Speed                │
   │  → "인터뷰 생략, 최소 plan 작성"    │
   └─────────────────────────────────────┘
         ↓
   Claude: 에러 분석 시작
   → 로그 확인, 코드 추적
   → 원인 파악: payment_service.py의 null 체크 누락
         ↓
   ┌─────────────────────────────────────┐
   │  plan.md (Speed 모드 — 간소화)      │
   │  ┌───────────────────────────────┐  │
   │  │ # Fix: 결제 500 에러          │  │
   │  │ ## 원인: null 체크 누락       │  │
   │  │ ## 수정: payment_service.py   │  │
   │  │   line 42에 null guard 추가   │  │
   │  └───────────────────────────────┘  │
   └─────────────────────────────────────┘
         ↓
   코드 수정 (1줄)
         ↓
   ┌─────────────────────────────────────┐
   │  code-change.sh                     │
   │  → change-log: MODIFY              │
   │    payment_service.py               │
   │    이유: "결제 500 에러 수정"        │
   └─────────────────────────────────────┘
         ↓
   테스트 실행 → 통과
         ↓
   /logical-commit "fix: 결제 시 null 체크 누락으로 인한 500 에러 수정"
```

### Speed 모드 vs Standard 모드

| | Speed | Standard | Safety |
|---|---|---|---|
| 인터뷰 | 생략 | 상황별 | 전체 진행 |
| plan.md | 간소화 | 표준 SPARC | 상세 SPARC |
| 검증 | 기본 테스트만 | 교차 검증 | 교차 검증 + 보안 |
| 트리거 | "빨리", "긴급", "핫픽스" | 기본 | "신중하게", "꼼꼼히" |

---

## 4. 교차 검증이 작동하는 흐름

### 상황

코드 수정 완료 후 자동으로 교차 검증이 실행됩니다.

### 흐름 시각화

```
코드 수정 완료
     ↓
post-task.sh 실행
     ↓
┌── 코드 파일 변경 감지? ──┐
│                           │
Yes                         No
│                           │
├── 쿨다운 5분 경과? ──┐    └── 종료 (일반 리마인더만)
│                      │
Yes                    No
│                      │
▼                      └── 종료 (중복 방지)
교차 검증 트리거
     ↓
┌── Codex MCP 사용 가능? ──┐
│                           │
Yes                         No
│                           │
▼                           ▼
Method A: Codex MCP         Method B: Claude 서브에이전트
(GPT 모델이 리뷰)           (code-reviewer 에이전트)
     │                           │
     └───────────┬───────────────┘
                 ↓
          리뷰 결과 출력
          ┌──────────────────────────┐
          │ [교차 검증 결과]          │
          │                          │
          │ 검증자: Codex/Claude      │
          │ 관점: code-reviewer       │
          │                          │
          │ ✓ 로직 정확성: PASS       │
          │ ✓ 에러 처리: PASS         │
          │ ! 네이밍: 개선 제안       │
          │   → getUserData보다       │
          │     fetchUserProfile 권장 │
          │ ✓ 보안: PASS              │
          └──────────────────────────┘
                 ↓
          사용자 확인
          "검증 결과를 확인하세요.
           수정할 부분이 있으면 알려주세요."
```

---

## 5. Simple vs Full 버전 비교

### Simple 버전 (초보자)

```
설치: bash install-simple.sh
세팅: /project-setup-simple "프로젝트 설명"

세팅 후 프로젝트 구조:
my-project/
├── CLAUDE.md                    # 프로젝트 정보
├── .claude/
│   ├── hooks/
│   │   └── plan-guard.sh        # plan.md 확인 (1개 훅)
│   └── settings.local.json
├── docs/
│   └── templates/
│       ├── plan-template.md     # 계획서 양식
│       └── todo-template.md     # 할 일 양식
└── [소스 코드...]

작업 흐름:
  요청 → plan.md 작성 → 코드 수정 → 커밋
  (plan.md 없으면 알림만 표시)
```

### Full 버전 (전체 기능)

```
설치: bash install.sh
세팅: /project-setup "프로젝트 설명"

세팅 후 프로젝트 구조:
my-project/
├── CLAUDE.md                    # 상세 프로젝트 지침
├── .claude/
│   ├── commands/                # 커스텀 슬래시 커맨드 (7개)
│   │   ├── plan-gate.md         # 인터뷰 + SPARC 플래닝
│   │   ├── read-domain-context.md
│   │   ├── quality-guard.md
│   │   ├── memory-manager.md
│   │   ├── pattern-cloner.md
│   │   ├── post-task-check.md
│   │   └── logical-commit.md
│   ├── hooks/                   # 자동 훅 (4개)
│   │   ├── pre-task.sh          # Task Mode 감지
│   │   ├── plan-guard.sh        # plan.md 강제
│   │   ├── code-change.sh       # 변경 기록 + DDD 체크
│   │   └── post-task.sh         # 검증 리마인더 + 교차 검증
│   └── settings.local.json
├── docs/
│   ├── conventions.md           # 코딩 규약
│   └── templates/
│       ├── plan-template.md
│       ├── todo-template.md
│       └── context-template.md
├── .omc/
│   ├── project-memory.json      # 프로젝트 메모리
│   └── change-log.md            # 파일 변경 기록 (자동)
├── .mcp.json                    # MCP 서버 설정
└── [소스 코드...]

작업 흐름:
  요청 → Mode 감지 → 인터뷰 → SPARC 플래닝 → 코드 수정
  → 변경 기록 자동 → 교차 검증 → 커밋
```

### 언제 어떤 버전을 사용하나?

| 상황 | 추천 |
|------|------|
| Claude Code를 처음 사용 | Simple |
| 개인 토이 프로젝트 | Simple |
| 팀 프로젝트 | Full |
| AI와 체계적으로 협업하고 싶음 | Full |
| Plan-First 워크플로우만 체험 | Simple |
| DDD + SPARC + 교차 검증 전부 필요 | Full |
| Simple에서 Full로 전환 | `/project-setup` 실행 (덮어쓰기) |

---

## 커맨드 빠른 참조

### Full 버전 커맨드

| 커맨드 | 용도 | 예시 |
|--------|------|------|
| `/plan-gate` | 인터뷰 + 계획 수립 | `/plan-gate "검색 기능 추가"` |
| `/read-domain-context` | 도메인 컨텍스트 로드 | `/read-domain-context` |
| `/quality-guard` | 품질 체크리스트 | `/quality-guard "전체"` |
| `/memory-manager` | 컨텍스트 파일 관리 | `/memory-manager "정리"` |
| `/pattern-cloner` | 기존 패턴 복제 | `/pattern-cloner "UserStore 패턴으로 ProductStore"` |
| `/post-task-check` | 작업 후 검증 | `/post-task-check` |
| `/logical-commit` | 논리적 커밋 | `/logical-commit "feat: 검색 기능"` |
| `/update-all` | 전체 업데이트 | `/update-all "전체"` |
| `/ship-pr` | 논리 커밋 + PR | `/ship-pr "기능 추가 PR"` |
