# Plan Gate (Interview + SPARC Process)

사용자 요청을 분석하고, **인터뷰를 통해 요구사항을 명확히 한 후** SPARC(Spec→Pseudocode→Architecture→Refinement→Completion) 프로세스로 계획을 수립한다. 코드 작성 전에 반드시 계획을 수립하고 승인을 받는다.

## Argument: $ARGUMENTS
요청 내용을 분석하여 plan-gate를 실행한다.

## Instructions

### Phase 1: 사용자 인터뷰 (Discovery Interview)

코드를 작성하기 전에 사용자와 대화하며 요구사항을 구체화한다.
AskUserQuestion 도구를 활용하여 한 번에 1-2개씩 순차적으로 질문한다.

#### 1-1. 목표 & 범위 (Goal & Scope)
- **핵심 질문**: "이 작업의 핵심 목표는 무엇인가요?"
- 후속 확인:
  - 해결하려는 문제가 정확히 무엇인지
  - 기대하는 최종 결과물
  - 이 작업의 성공 기준은?

#### 1-2. 사용자 시나리오 (User Scenarios)
- **핵심 질문**: "주요 사용자와 핵심 유스케이스는 무엇인가요?"
- 후속 확인:
  - 대상 사용자 (페르소나)
  - 핵심 플로우 (Happy Path)
  - 엣지 케이스 (2개 이상 식별 필수)

#### 1-3. 기술적 제약 (Technical Constraints)
- **핵심 질문**: "기술적 제약이나 호환성 요구사항이 있나요?"
- 후속 확인:
  - 기존 시스템/코드와의 호환성
  - 성능 요구사항 (응답 시간, 처리량)
  - 외부 의존성/라이브러리 제한

> 코드베이스 사실은 사용자에게 묻지 않는다 — 직접 코드를 읽고 확인한다.

#### 1-4. 우선순위 & 스코프 (Priority & Scope Boundary)
- **핵심 질문**: "Must-have와 Nice-to-have를 구분해 주세요."
- 후속 확인:
  - 이번 작업에 포함되는 것 / 포함되지 않는 것
  - 향후 확장 계획 (있다면)
  - 타임라인/데드라인

#### 1-5. 리스크 & 검증 (Risk & Verification)
- **핵심 질문**: "허용 가능한 리스크 수준과 테스트 전략은?"
- 후속 확인:
  - 기존 기능에 미치는 영향
  - 롤백 전략
  - 검증 방법 (수동 테스트, 자동 테스트, 둘 다)

#### 인터뷰 진행 규칙
- 한 번에 1-2개 카테고리만 질문 (사용자 피로도 관리)
- 사용자 답변이 충분히 명확하면 후속 질문 생략 가능
- 코드베이스 관련 사실은 질문하지 않고 직접 탐색
- 모호한 비즈니스 규칙은 반드시 질문 (No Hallucination)
- Speed Mode일 경우: 1-1, 1-4만 필수, 나머지 선택
- Safety Mode일 경우: 전체 5개 카테고리 필수

### Phase 2: 도메인 컨텍스트 로딩

인터뷰 완료 후, 해당 도메인의 관련 파일을 읽는다:

1. 사용자의 요청에서 **도메인**을 식별한다.
2. 해당 도메인의 관련 파일을 읽는다:
   - `docs/conventions.md` (전체 규약)
   - 해당 도메인의 모델/타입 파일
   - 해당 도메인의 Store/Repository 파일
   - 해당 도메인의 Route/Controller 파일
3. "로드한 문서 목록"을 명시한다.
4. 기존 패턴을 분석한다 (Pattern Copy 원칙).

### Phase 3: SPARC 기반 Plan 작성

`docs/templates/plan-template.md` 템플릿을 참고하여 인터뷰 결과를 반영한 `plan.md` 초안을 작성한다:

**S - Spec (명세):**
- 목표/범위/비범위 (인터뷰 1-1, 1-4 반영)
- 사용자 시나리오 (인터뷰 1-2 반영)
- Edge Case 2개 이상 (인터뷰에서 식별된 것 + 추가 분석)

**P - Pseudocode (의사코드):**
- 핵심 로직을 자연어/의사코드로 설명
- 데이터 흐름 정의

**A - Architecture (구조):**
- 변경 파일 목록(예상)
- 의존성 방향 (Domain Map 참조)
- 기술적 제약 반영 (인터뷰 1-3)

**R - Refinement (정제):**
- 리스크/검증 계획 (인터뷰 1-5 반영)
- 보안/성능 체크포인트

**C - Completion (완성 계획):**
- 단계별 TODO 분해 (커밋 단위)
- 우선순위 기반 순서 (인터뷰 1-4 반영)
- 검증 명령어 (pytest, tsc 등)

### Phase 4: 승인 요청

1. `todo.md`도 함께 초안을 작성한다 (`docs/templates/todo-template.md` 기반).
2. `context.md`도 초기화한다 (`docs/templates/context-template.md` 기반).
   - 인터뷰 결과에서 도출된 주요 결정사항을 첫 번째 Decision으로 기록
   - 검토한 대안이 있으면 Trade-offs에 기록
3. 인터뷰 결과 요약을 plan.md 상단에 포함한다.
4. 마지막에 반드시: **"OK 주시면 todo 1번부터 진행합니다."**

## Rules
- 인터뷰 없이 plan을 작성하지 않는다 (인터뷰 스킵 불가)
- 이 단계에서 코드를 작성하거나 수정하지 않는다
- 기존 패턴을 반드시 확인한다 (Pattern Copy 원칙)
- Ubiquitous Language 용어를 사용한다
- 모호한 비즈니스 규칙은 질문한다 (No Hallucination)
- Edge Case를 반드시 2개 이상 식별한다
- Speed Mode: 인터뷰 간소화 + SPARC의 P/R 간소화 가능
- Safety Mode: 인터뷰 전체 + 모든 SPARC 단계 상세 작성
