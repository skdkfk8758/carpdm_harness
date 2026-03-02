# carpdm-harness 사용 가이드

> AI 협업 워크플로우 MCP 서버 플러그인 v4.0.0
> 스킬, 에이전트, MCP 도구의 통합 사용법

---

## 목차

1. [빠른 시작](#빠른-시작)
2. [스킬 (13개)](#스킬)
3. [에이전트 (10개)](#에이전트)
4. [MCP 도구 (24개)](#mcp-도구)
5. [프리셋 (4개)](#프리셋)
6. [일반적인 워크플로우](#일반적인-워크플로우)

---

## 빠른 시작

### 설치 & 초기화

```
/carpdm-harness:setup          # 원스톱 프로젝트 셋업
/carpdm-harness:doctor          # 설치 상태 진단
```

### 일상 작업 사이클

```
/carpdm-harness:work-start      # 1. 브랜치 생성 + 워크플로우 시작
/carpdm-harness:plan-gate       # 2. 인터뷰 + 계획 수립
... (코딩) ...
/carpdm-harness:verify-all      # 3. 품질 검증
/carpdm-harness:work-finish     # 4. 커밋 + PR 제출
/carpdm-harness:branch-cleanup  # 5. 다음 작업 준비
```

---

## 스킬

스킬은 `/carpdm-harness:<name>` 형태로 호출합니다.

### 프로젝트 설정

| 스킬 | 호출 | 설명 |
|------|------|------|
| **setup** | `/carpdm-harness:setup` | OMC 기반 원스톱 프로젝트 셋업. harness 설치 + 프리셋 적용 + 훅 연결까지 한번에 |
| **scaffold** | `/carpdm-harness:scaffold` | PRD 또는 프로젝트 설명을 기반으로 AI 협업 환경 초기화 |
| **sync** | `/carpdm-harness:sync` | 플러그인 업데이트 + 프로젝트 템플릿 동기화 |
| **doctor** | `/carpdm-harness:doctor` | 설치 상태 진단. 모듈/프리셋 확인, 건강 체크 |

**트리거 키워드**: "프로젝트 셋업", "harness 셋업", "sync", "진단", "doctor"

#### 사용 예시

```
> /carpdm-harness:setup
  → harness 설치 + standard 프리셋 적용

> /carpdm-harness:scaffold PRD.md 기반으로 초기화
  → PRD 파싱 → 디렉토리 구조 + 설정 파일 자동 생성

> /carpdm-harness:doctor
  → 설치 정보 + 모듈 목록 + 건강 진단 실행
```

---

### 작업 관리

| 스킬 | 호출 | 설명 |
|------|------|------|
| **work-start** | `/carpdm-harness:work-start` | 작업 단위 브랜치 생성 + 워크플로우 시작. 유형별 인터뷰 진행 |
| **work-finish** | `/carpdm-harness:work-finish` | 작업 완료: 논리 커밋 + PR 제출 |
| **branch-cleanup** | `/carpdm-harness:branch-cleanup` | 머지된 브랜치 정리, 다음 작업 준비 |

**트리거 키워드**: "작업 시작", "새 작업", "feature", "bugfix", "작업 완료", "브랜치 정리"

#### 사용 예시

```
> /carpdm-harness:work-start #42 로그인 기능
  → fix/42-login-error 브랜치 생성 + bugfix 인터뷰 시작

> /carpdm-harness:work-start feat 사용자 프로필
  → feat/user-profile 브랜치 생성 + feature 인터뷰

> /carpdm-harness:work-finish
  → 변경사항 커밋 + PR 생성

> /carpdm-harness:branch-cleanup
  → 머지된 로컬 브랜치 삭제 + main 동기화
```

---

### 계획 & 설계

| 스킬 | 호출 | 설명 |
|------|------|------|
| **plan-gate** | `/carpdm-harness:plan-gate` | 인터뷰 + SPARC 프로세스로 상세 계획 수립 |
| **workflow** | `/carpdm-harness:workflow` | 워크플로우 오케스트레이션 (시작/상태/다음단계) |
| **design-guide** | `/carpdm-harness:design-guide` | 디자인 시스템 선택 및 적용 가이드 |

**트리거 키워드**: "계획", "plan", "워크플로우", "디자인 시스템"

#### 사용 예시

```
> /carpdm-harness:plan-gate 인증 시스템 리팩토링
  → 요구사항 인터뷰 → SPARC 기반 계획 수립

> /carpdm-harness:workflow status
  → 현재 워크플로우 상태 + 다음 단계 안내

> /carpdm-harness:design-guide 카본 디자인
  → Carbon Design System 적용 가이드 제공
```

---

### 품질 & 검증

| 스킬 | 호출 | 설명 |
|------|------|------|
| **verify-all** | `/carpdm-harness:verify-all` | TRUST 5 기준 통합 품질 검증 |
| **ontology** | `/carpdm-harness:ontology` | 3계층 온톨로지 생성 또는 갱신 |

**트리거 키워드**: "검증", "품질 검사", "TRUST", "온톨로지"

#### 사용 예시

```
> /carpdm-harness:verify-all
  → Tested + Readable + Unified + Secured + Trackable 5개 기준 검증

> /carpdm-harness:ontology generate
  → 프로젝트 구조/시맨틱/도메인 3계층 온톨로지 생성

> /carpdm-harness:ontology refresh
  → 기존 온톨로지 점진적 갱신
```

---

### 분석

| 스킬 | 호출 | 설명 |
|------|------|------|
| **repo-analyze** | `/carpdm-harness:repo-analyze` | 외부 GitHub 레포지토리 분석 + 통합 가능성 평가 |

**트리거 키워드**: "레포 분석", "repo analyze", "github 분석", "통합 가능성"

#### 사용 예시

```
> /carpdm-harness:repo-analyze facebook/react
  → standard 깊이 분석 (구조 + 의존성 비교)

> /carpdm-harness:repo-analyze https://github.com/vercel/next.js 자세히
  → deep 분석 (패턴 + 아키텍처까지)

> /carpdm-harness:repo-analyze sindresorhus/execa 빠르게
  → quick 분석 (기본 정보 + 간략 평가)
```

#### 분석 깊이

| 깊이 | API 호출 | 포함 내용 |
|------|---------|----------|
| `quick` | 1-2개 | 기본 정보 + 간략 통합 평가 |
| `standard` (기본) | 4-5개 | + 구조 분석 + 의존성 비교 |
| `deep` | 6-8개 | + 패턴 분석 (빌드도구, 테스트, 컨벤션, 아키텍처) |

#### 통합 가능성 등급

| 등급 | 점수 | 의미 |
|------|------|------|
| **easy** | 75-100 | 직접 의존성 추가 또는 코드 이식 가능 |
| **moderate** | 50-74 | 부분 이식 가능, 어댑터 필요할 수 있음 |
| **hard** | 25-49 | 컨셉 참고 수준, 직접 이식 어려움 |
| **impractical** | 0-24 | 통합 비현실적, 대안 검토 필요 |

---

## 에이전트

에이전트는 자율적으로 동작하는 전문 AI입니다. 팀 스웜이나 서브에이전트로 활용됩니다.

### 코드 & 품질

| 에이전트 | 역할 |
|----------|------|
| **code-reviewer** | TRUST 5 기준 + 프로젝트 컨벤션에 따른 코드 리뷰. 심각도별(BLOCK/WARN/INFO) 피드백 |
| **quality-auditor** | 프로젝트 전체 품질을 TRUST 5 기준으로 심층 분석 |
| **security-scanner** | OWASP Top 10 + 시크릿 노출 중심 보안 취약점 탐지 |

### 설계 & 분석

| 에이전트 | 역할 |
|----------|------|
| **ontology-analyst** | 3계층 온톨로지 + @MX 어노테이션 기반 아키텍처 분석 |
| **refactor-planner** | 온톨로지 + 품질 데이터 기반 안전한 리팩토링 계획 수립 |
| **repo-analyzer** | 외부 GitHub 레포지토리 분석 + 통합 전략 제안 |

### 워크플로우 & 협업

| 에이전트 | 역할 |
|----------|------|
| **workflow-guide** | harness + OMC 통합 워크플로우 카탈로그 안내, 상황별 최적 파이프라인 제안 |
| **onboarding-guide** | 새 팀원 온보딩 안내 (환경 설정 → 컨벤션 → 첫 작업까지) |
| **team-memory-keeper** | 세션 중 패턴/컨벤션/결정/실수를 팀 메모리에 자동 기록 |
| **debug-assistant** | 에러 로그 + 스택 트레이스 + 온톨로지 활용 근본 원인 분석 |

---

## MCP 도구

MCP 도구는 `harness_<name>` 형태로 에이전트가 직접 호출합니다.

### 설치 & 설정

| 도구 | 설명 |
|------|------|
| `harness_init` | harness 초기 설치 (프리셋 기반) |
| `harness_setup` | 원스톱 프로젝트 셋업 |
| `harness_update` | 설정 업데이트 + 오버랩 해소 |
| `harness_migrate` | 레거시 상태 마이그레이션 |
| `harness_sync` | 플러그인 + 템플릿 동기화 |
| `harness_list` | 사용 가능한 모듈/프리셋 목록 |
| `harness_info` | 설치 상태 정보 |
| `harness_doctor` | 건강 상태 진단 |

### 워크플로우 & 계획

| 도구 | 설명 |
|------|------|
| `harness_workflow` | 워크플로우 FSM 제어 (start/status/complete/abort) |
| `harness_dashboard` | 워크플로우 대시보드 생성 |
| `harness_plan_archive` | 완료된 계획 아카이브 |

### 품질 & 검증

| 도구 | 설명 |
|------|------|
| `harness_quality_check` | TRUST 5 품질 게이트 실행 |
| `harness_verify_all` | 통합 검증 (TRUST 5 + 커스텀 verify) |
| `harness_manage_verify` | verify 스킬 관리 (생성/적용) |

### 온톨로지

| 도구 | 설명 |
|------|------|
| `harness_ontology_status` | 온톨로지 현재 상태 조회 |
| `harness_ontology_generate` | 3계층 온톨로지 생성 |
| `harness_ontology_refresh` | 온톨로지 점진적 갱신 |
| `harness_ontology_domain_write` | 도메인 레이어 직접 편집 |
| `harness_ontology_annotations` | @MX 어노테이션 분석 |

### 메모리 & 기록

| 도구 | 설명 |
|------|------|
| `harness_memory_add` | 팀 메모리에 항목 추가 (patterns/conventions/decisions/bugs/mistakes) |
| `harness_memory_list` | 팀 메모리 조회 |
| `harness_bug_report` | 버그 리포트 기록 |

### GitHub & 분석

| 도구 | 설명 |
|------|------|
| `harness_github_setup` | GitHub 라벨 자동 생성 (gh CLI 필요) |
| `harness_repo_analyze` | 외부 레포지토리 분석 + 통합 가능성 평가 (gh CLI 필요) |

---

## 프리셋

| 프리셋 | 모듈 | 용도 |
|--------|------|------|
| **standard** | core + quality + ship + team-memory | 기본 권장. 대부분의 프로젝트에 적합 |
| **full** | 전체 7개 모듈 | 모든 기능 활성화 |
| **tdd** | core + tdd + quality + ship | TDD 워크플로우 강제 |
| **secure** | core + quality + security + ship | 보안 중심 프로젝트 |

---

## 일반적인 워크플로우

### 1. 새 기능 개발

```
/carpdm-harness:work-start feat 사용자 프로필 페이지
  → 인터뷰 진행 (기능/수용기준/범위/영향)
  → feat/user-profile 브랜치 생성

/carpdm-harness:plan-gate
  → SPARC 기반 상세 설계

... (구현) ...

/carpdm-harness:verify-all
  → TRUST 5 품질 검증

/carpdm-harness:work-finish
  → 논리 커밋 + PR 생성
```

### 2. 버그 수정

```
/carpdm-harness:work-start fix #42 로그인 에러
  → fix/42-login-error 브랜치 생성
  → 증상/재현/기대동작 인터뷰

... (수정) ...

/carpdm-harness:verify-all
/carpdm-harness:work-finish
```

### 3. 외부 라이브러리 검토

```
/carpdm-harness:repo-analyze zustand 빠르게
  → quick 분석: 기본 정보 + 통합 점수

/carpdm-harness:repo-analyze pmndrs/zustand 자세히
  → deep 분석: 구조 + 의존성 + 패턴 + 통합 전략
```

### 4. 프로젝트 건강 체크

```
/carpdm-harness:doctor           # 설치 상태 확인
/carpdm-harness:verify-all       # 품질 검증
/carpdm-harness:ontology refresh # 온톨로지 최신화
```

### 5. 팀원 온보딩

```
/carpdm-harness:setup            # 환경 셋업
/carpdm-harness:doctor           # 설치 확인
/carpdm-harness:ontology         # 프로젝트 구조 파악
```

---

## 요구사항

| 항목 | 필수 | 선택 |
|------|------|------|
| Node.js | >= 20 | |
| Claude Code | 최신 | |
| gh CLI | | GitHub 연동 기능 (라벨, 레포 분석) |
| git | | 워크플로우, 브랜치 관리 |

---

## 문제 해결

### gh CLI 관련

```bash
brew install gh     # 설치
gh auth login       # 인증
gh auth status      # 상태 확인
```

### harness 관련

```
/carpdm-harness:doctor    # 전체 진단
/carpdm-harness:sync      # 플러그인 동기화
/carpdm-harness:setup     # 재설치
```
