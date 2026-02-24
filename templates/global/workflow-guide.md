# Workflow Guide (워크플로우 가이드)

carpdm-harness 모듈을 조합하여 사용하는 워크플로우 가이드입니다. 상황별 최적 파이프라인을 안내합니다.

## Instructions

### Step 1: 현재 설치된 모듈 확인

harness_info 도구를 호출하여 현재 프로젝트에 설치된 모듈을 확인한다.

### Step 2: 상황에 맞는 워크플로우 제안

아래 워크플로우 중 사용자 상황에 맞는 것을 제안한다.
사용자가 `$ARGUMENTS`로 워크플로우를 지정한 경우 해당 워크플로우를 안내한다.

---

## 워크플로우 카탈로그

### 1. Feature Development (기능 개발)
**필요 모듈**: core, tdd, quality, ship
**난이도**: 표준

```
/plan-gate → /tdd-cycle → /verify → /quality-guard → /logical-commit → /ship-pr
```

| 단계 | 커맨드 | 역할 |
|------|--------|------|
| 1 | `/plan-gate` | 요구사항 정리 + SPARC 설계 + 승인 대기 |
| 2 | `/tdd-cycle` | Red-Green-Refactor TDD 사이클 |
| 3 | `/verify` | 실행 기반 검증 (빌드/테스트/린트) |
| 4 | `/quality-guard` | 품질 게이트 통과 확인 |
| 5 | `/logical-commit` | 논리 단위로 커밋 분리 |
| 6 | `/ship-pr` | PR 생성 + 리뷰 요청 |

### 2. Bug Fix (버그 수정)
**필요 모듈**: core, tdd, quality
**난이도**: 빠름

```
/read-domain-context → /tdd-cycle → /verify-loop → /logical-commit
```

| 단계 | 커맨드 | 역할 |
|------|--------|------|
| 1 | `/read-domain-context` | 관련 도메인 컨텍스트 파악 |
| 2 | `/tdd-cycle` | 실패 테스트 작성 → 수정 → 검증 |
| 3 | `/verify-loop` | 자동 재시도로 빌드/테스트 확인 |
| 4 | `/logical-commit` | 수정 사항 커밋 |

### 3. Security Hardening (보안 강화)
**필요 모듈**: core, security, quality
**난이도**: 표준

```
/security-setup → /security-audit → /verify → /logical-commit
```

| 단계 | 커맨드 | 역할 |
|------|--------|------|
| 1 | `/security-setup` | permissions deny 리스트 설정 |
| 2 | `/security-audit` | 보안 취약점 종합 점검 |
| 3 | `/verify` | 보안 수정 후 기능 검증 |
| 4 | `/logical-commit` | 보안 패치 커밋 |

### 4. Refactoring (리팩토링)
**필요 모듈**: core, tdd, quality, patterns
**난이도**: 높음

```
/plan-gate → /read-domain-context → /pattern-cloner → /tdd-cycle → /handoff-verify → /ship-pr
```

| 단계 | 커맨드 | 역할 |
|------|--------|------|
| 1 | `/plan-gate` | 리팩토링 범위/전략 설계 |
| 2 | `/read-domain-context` | 기존 코드 도메인 이해 |
| 3 | `/pattern-cloner` | 기존 패턴 분석 + 새 패턴 적용 |
| 4 | `/tdd-cycle` | 리팩토링 후 테스트 보장 |
| 5 | `/handoff-verify` | Fresh-Context로 독립 검증 |
| 6 | `/ship-pr` | PR 생성 |

### 5. Release Preparation (릴리스 준비)
**필요 모듈**: core, quality, ship, security
**난이도**: 높음

```
/security-audit → /verify-loop → /handoff-verify → /post-task-check → /ship-pr
```

| 단계 | 커맨드 | 역할 |
|------|--------|------|
| 1 | `/security-audit` | 릴리스 전 보안 점검 |
| 2 | `/verify-loop` | 전체 빌드/테스트 자동 검증 |
| 3 | `/handoff-verify` | 독립 에이전트 최종 검증 |
| 4 | `/post-task-check` | 교차 검증 + 체크리스트 |
| 5 | `/ship-pr` | 릴리스 PR 생성 |

### 6. New Project Setup (프로젝트 초기 설정)
**필요 모듈**: 없음 (글로벌 커맨드)
**난이도**: 간단

```
/harness-init → /security-setup → /plan-gate
```

| 단계 | 커맨드 | 역할 |
|------|--------|------|
| 1 | `/harness-init` | 모듈 설치 + 훅 등록 |
| 2 | `/security-setup` | 보안 권한 설정 |
| 3 | `/plan-gate` | 첫 번째 작업 계획 수립 |

### 7. Ontology-Driven Development (온톨로지 기반 개발)
**필요 모듈**: core, ontology, patterns
**난이도**: 심화

```
/generate-ontology → /read-domain-context → /pattern-cloner → /plan-gate → /tdd-cycle
```

| 단계 | 커맨드 | 역할 |
|------|--------|------|
| 1 | `/generate-ontology` | 3계층 온톨로지 생성 |
| 2 | `/read-domain-context` | 온톨로지 기반 도메인 이해 |
| 3 | `/pattern-cloner` | 도메인 패턴 복제 |
| 4 | `/plan-gate` | 기능 설계 |
| 5 | `/tdd-cycle` | TDD 구현 |

---

### Step 3: 선택된 워크플로우 실행 안내

워크플로우가 선택되면:
1. 각 단계의 전제 조건 확인
2. 누락 모듈이 있으면 `harness_init`으로 설치 안내
3. 첫 번째 단계 실행 제안

## Rules
- 설치되지 않은 모듈이 필요한 워크플로우는 설치 안내와 함께 제안한다
- 각 단계 사이에 사용자 확인을 받는다 (자동 연쇄 실행 금지)
- 워크플로우는 순서가 중요하다 — 건너뛰기를 권장하지 않는다
- 사용자의 프로젝트 상황에 맞게 단계를 조정할 수 있다

## Argument: $ARGUMENTS
워크플로우 이름 (feature|bugfix|security|refactor|release|setup|ontology) 또는 빈 값 (전체 카탈로그 표시)
