---
name: harness-work-start
description: 작업 단위 시작. "작업 시작", "새 작업", "work start", "feature", "기능 추가", "bugfix", "버그 수정", "refactor", "리팩토링", "release", "릴리스", "security", "보안 패치"를 요청할 때 사용합니다.
---

# Work Start

새 작업 단위를 시작합니다. 작업 유형을 감지하고, 인터뷰를 진행하며, 브랜치 생성과 워크플로우를 시작합니다.

## Argument: $ARGUMENTS

인자가 제공되면 인터뷰를 간소화합니다:
- `#123 로그인 기능` → issue=123, type=feature
- `fix #42 TypeError` → issue=42, type=bugfix
- `refactor auth 모듈` → type=refactor
- `v4.12.0 릴리스` → type=release
- `CVE-2024-1234` → type=security
- 인자 없음 → Step 1에서 유형 질문

---

## Step 1: 작업 유형 감지

사용자 입력(`$ARGUMENTS`)에서 작업 유형을 감지합니다:

| 키워드 | 유형 |
|--------|------|
| `feat`, `기능`, `추가`, `새로운`, `feature` | feature |
| `fix`, `bug`, `버그`, `에러`, `오류`, `수정` | bugfix |
| `refactor`, `리팩토링`, `정리`, `개선` | refactor |
| `release`, `릴리스`, `배포`, `버전` | release |
| `security`, `보안`, `취약점`, `패치`, `CVE` | security |

유형을 자동 감지할 수 없으면 사용자에게 질문합니다:

"어떤 종류의 작업인가요?"
1. 새 기능 개발 (feature)
2. 버그 수정 (bugfix)
3. 리팩토링 (refactor)
4. 릴리스 (release)
5. 보안 패치 (security)

---

## Step 2: 컨텍스트 수집 (Interview)

인자(`$ARGUMENTS`)가 충분히 구체적이면 (이슈 번호 + 설명 포함) 확인만 받고 Step 3로 진행합니다.
"빠르게" 또는 "바로 시작" 키워드가 있으면 첫 번째 질문만 수집 후 진행합니다.

인자가 없거나 모호하면, **한 번에 1-2개씩** 순차적으로 질문합니다.

### feature 인터뷰

#### 2-1. 기능 설명 (What)
- "어떤 기능을 구현하고 싶으신가요? 핵심 목표를 설명해 주세요."
- 관련 이슈가 있으면 이슈 번호도 함께 알려주세요.

#### 2-2. 수용 기준 (Acceptance Criteria)
- "이 기능의 성공 기준은 무엇인가요? (2-3개)"
- "사용자 시나리오(Happy Path)를 설명해 주세요."

#### 2-3. 범위 & 제약 (Scope)
- "이번 작업에 포함되는 것과 포함되지 않는 것은?"
- "기술적 제약이나 호환성 요구사항이 있나요?"

#### 2-4. 영향 범위 (Impact)
- "어떤 모듈/파일이 영향을 받을 것 같나요?"
- 코드베이스 관련 사실은 직접 탐색하여 확인합니다.

### bugfix 인터뷰

#### 2-1. 증상 (Symptom)
- "어떤 에러/버그가 발생하나요? 에러 메시지가 있으면 공유해 주세요."
- 관련 이슈 번호가 있으면 함께 알려주세요.

#### 2-2. 재현 단계 (Reproduction)
- "버그를 재현하는 단계를 설명해 주세요."
- "어떤 환경에서 발생하나요? (브라우저, OS, Node 버전 등)"

#### 2-3. 기대 동작 (Expected Behavior)
- "정상적으로 작동한다면 어떤 결과가 나와야 하나요?"

#### 2-4. 영향 & 긴급도 (Impact & Severity)
- "이 버그가 다른 기능에도 영향을 주나요?"
- "긴급도는 어느 정도인가요? (critical / high / medium / low)"

### refactor 인터뷰

#### 2-1. 대상 & 동기 (Target & Motivation)
- "어떤 코드/모듈을 리팩토링하려고 하나요?"
- "리팩토링의 주요 동기는 무엇인가요? (가독성, 성능, 확장성, 중복 제거 등)"

#### 2-2. 범위 & 제약 (Scope)
- "리팩토링 범위는? (단일 파일, 모듈, 아키텍처 레벨)"
- "기존 API/인터페이스를 유지해야 하나요? (breaking change 허용 여부)"

#### 2-3. 검증 전략 (Verification)
- "기존 테스트가 있나요? 리팩토링 후 검증 방법은?"

### release 인터뷰

#### 2-1. 버전 & 유형 (Version)
- "릴리스 버전은? (major / minor / patch 또는 구체적 버전)"
- "릴리스 타입은? (정규 / 핫픽스 / RC)"

#### 2-2. 포함 내용 (Changelog)
- "이번 릴리스에 포함되는 주요 변경사항은?"
- "알려진 이슈나 breaking change가 있나요?"

#### 2-3. 배포 전략 (Deploy)
- "배포 환경은? (npm publish, GitHub Release, 자체 배포 등)"
- "릴리스 전 필수 검증 항목은?"

### security 인터뷰

#### 2-1. 보안 이슈 (Issue)
- "어떤 보안 이슈/취약점을 해결하려고 하나요?"
- "CVE 번호나 보안 권고가 있으면 공유해 주세요."

#### 2-2. 영향 & 심각도 (Impact & Severity)
- "이 취약점의 심각도는? (critical / high / medium / low)"
- "영향 받는 모듈/엔드포인트는?"
- "데이터 유출 가능성이 있나요?"

#### 2-3. 긴급도 (Urgency)
- "이미 exploit되고 있나요?"
- "패치 배포 시점은?"

---

## Step 3: 브랜치 생성 & 워크플로우 시작

### 3-1. 현재 상태 확인

```bash
git status --short
git branch --show-current
```

현재 브랜치가 main이 아니면 사용자에게 확인:
- "현재 `<branch>` 브랜치입니다. main에서 새 브랜치를 생성할까요?"

### 3-2. 브랜치 생성

| 유형 | prefix | 예시 |
|------|--------|------|
| feature | `feat/` | `feat/user-profile` |
| bugfix | `fix/` | `fix/42-login-error` |
| refactor | `refactor/` | `refactor/auth-module` |
| release | (없음) | 현재 브랜치(보통 main)에서 진행 |
| security | `security/` | `security/xss-patch` |

release를 제외한 모든 유형:
```bash
git checkout main
git pull --rebase origin main
git checkout -b <prefix>/<description>
```

이슈 번호가 있으면: `<prefix>/<issue-number>-<description>`

### 3-3. Knowledge Vault 초기화

`.knowledge/` 디렉토리가 존재하면 브랜치 문서를 초기화합니다:

```
.knowledge/branches/<branch-name>/
├── spec.md
├── design.md
├── decisions.md
└── notes.md
```

> Knowledge Vault가 없으면 이 단계를 건너뜁니다.

### 3-4. 워크플로우 시작

인터뷰에서 수집한 정보를 context로 변환하여 MCP 도구를 호출합니다:

```tool
harness_workflow({
  projectRoot: "<프로젝트 루트>",
  action: "start",
  workflow: "<유형>",
  context: JSON.stringify({
    description: "<설명>",
    branch: "<브랜치명>",
    relatedIssue: "<이슈 번호 또는 null>",
    ...수집된 유형별 컨텍스트 필드
  })
})
```

### 3-5. 작업 상태 기록

`.harness/state/current-work.json`에 기록:
```json
{
  "branch": "<branch-name>",
  "type": "<유형>",
  "description": "<description>",
  "startedAt": "<ISO timestamp>",
  "issueNumber": null
}
```

---

## Step 4: 후속 안내

| 유형 | 첫 단계 안내 | 추천 |
|------|-------------|------|
| feature | 요구사항 분석 | `/plan-gate` — 상세 계획 수립 권장 |
| bugfix | 코드베이스 탐색 + 원인 분석 | 에러 로그/스택 트레이스 제공 시 즉시 분석 시작 |
| refactor | 리팩토링 계획 | `/plan-gate` — 아키텍처 변경 시 **필수** 권장 |
| release | 보안 검토부터 시작 | 수동 단계별 실행 권장 (자동 모드 비권장) |
| security | 취약점 스캔 | `/security-audit` — 보안 감사 실행 권장 |

모든 유형 공통:
- `harness_workflow({ action: "status" })` — 현재 상태 확인

---

## Rules

### 공통
- 인터뷰 중 코드를 작성하거나 수정하지 않습니다.
- 코드베이스 관련 사실은 직접 탐색하여 확인합니다.

### 유형별
- **feature**: Ubiquitous Language 용어를 사용합니다.
- **bugfix**: severity가 critical이면 인터뷰를 최소화하고 즉시 진행합니다.
- **refactor**: 기존 테스트가 있으면 반드시 통과 확인 후 리팩토링을 시작합니다.
- **release**: 릴리스 전 모든 테스트 통과 확인. CHANGELOG.md 업데이트. npm publish 등 외부 배포는 반드시 사용자 확인 후 실행합니다.
- **security**: 보안 취약점 정보는 공개 채널에 노출하지 않습니다. 패치는 최소 범위로 적용합니다 (surgical fix). 수정 후 반드시 보안 테스트를 실행합니다.
