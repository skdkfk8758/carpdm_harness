# Plan: [작업 제목]

> 작성일: YYYY-MM-DD
> 도메인: [해당 도메인]
> 상태: DRAFT | APPROVED | IN_PROGRESS | COMPLETED

> **SDD 원칙**: 이 문서가 Spec(기준점)이다.
> - 수정 요청이 들어오면 **이 문서를 먼저 고치고** 재구현한다.
> - 계획이 모호하면 Implement 금지. 모든 Step이 검증 가능해야 한다.
> - Spec 3요소: **Goal**(무엇) + **Structure**(어떻게) + **Steps**(체크리스트)

## 0. 현 상태 조사 (As-Is Research)

> RPI 원칙: 계획 전에 반드시 현 상태를 실데이터 기반으로 파악한다 (추측 금지).

### 참조 자료 (실데이터)
- 기존 코드/문서/API 스펙/DB 스키마/로그 등:
  -

### 현 상태 요약
- 시스템/코드가 현재 어떻게 동작하는가:
- 기존 패턴/규칙 (DDD, 네이밍, 레이어링):
- 충돌 지점 (왜 현재 방식이 문제인가):

### 변경 영향 범위
- 영향 받는 모듈/파일:
- 회귀 위험:
- 반드시 피해야 할 변경:

## 1. 목표 (Objective)
- 무엇을 달성하려 하는가?
- 성공 기준 (측정 가능하게):

## 2. 범위 (Scope)
### 포함 (In Scope)
-

### 비포함 (Out of Scope)
-

## 3. 도메인 컨텍스트 (Domain Context)
### 로드한 문서
- [ ] `docs/conventions.md`
- [ ] (관련 모델 파일)
- [ ] (관련 Store 파일)
- [ ] (관련 Route 파일)

### 기존 패턴 분석
- Model:
- Store/Repository:
- Service:
- Route:

## 4. 변경 파일 목록 (Affected Files)
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| | CREATE/MODIFY/DELETE | |

## 5. 구현 계획 (Implementation Plan)
### Step 1: [제목]
- 대상 파일:
- 작업 내용:
- 검증 방법:

### Step 2: [제목]
- 대상 파일:
- 작업 내용:
- 검증 방법:

(단계 추가...)

## 6. 리스크 & 검증 (Risks & Verification)
### 리스크
-

### 검증 계획
- [ ] pytest -q 통과
- [ ] DDD 패턴 준수
- [ ] Ubiquitous Language 검증
- [ ] 보안 체크 (웹/SaaS 프로젝트 시 아래 전체 확인)
  - [ ] CORS/Preflight 설정
  - [ ] CSRF 토큰 적용
  - [ ] XSS 방어 + CSP 헤더
  - [ ] SSRF 방어 (내부 URL 차단)
  - [ ] AuthN/AuthZ 구현
  - [ ] RBAC/ABAC + 테넌트 격리
  - [ ] 최소 권한 원칙 적용
  - [ ] Input Validation + SQLi 방어 (Parameterized Query)
  - [ ] Rate Limit / Bruteforce 방어
  - [ ] 쿠키 보안 (HttpOnly·Secure·SameSite) + 세션 보안
  - [ ] Secret 관리 + Rotation 정책
  - [ ] HTTPS/HSTS + 보안 헤더 (X-Frame-Options 등)
  - [ ] Audit Log 구현
  - [ ] 에러 노출 차단 (스택트레이스, 내부 경로)
  - [ ] 의존성 취약점 점검 (npm audit / pip-audit)

## 7. 의존성 (Dependencies)
- 외부 라이브러리:
- 다른 도메인 영향:

---
> OK 주시면 todo 1번부터 진행합니다.
