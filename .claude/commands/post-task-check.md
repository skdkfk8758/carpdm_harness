# Post-task Check (교차 검증 포함)

작업 완료 후 자동 검증을 수행한다. **교차 검증**(Codex MCP 또는 서브에이전트)을 포함하여 모든 항목을 통과해야 완료로 인정한다.

## Instructions

### Step 1: 변경 파일 확인
```bash
git diff --stat HEAD
git status -s
```

### Step 2: 교차 검증 (Cross-Verification)

다른 AI 모델로 코드를 교차 리뷰한다. 같은 AI가 작성하고 검증하면 편향이 동일하므로, 반드시 다른 모델을 사용한다.

**방법 A — Codex MCP 사용 (우선):**
```
mcp__plugin_oh-my-claudecode_x__ask_codex(
  agent_role: "code-reviewer",
  context_files: [변경된 파일 경로들],
  prompt: "아래 변경된 코드를 종합 리뷰하세요.
    관점:
    1. 로직 결함 및 엣지 케이스
    2. DDD 패턴 준수 (Model→Store→Service→Route)
    3. 보안 취약점 (OWASP Top 10)
    4. 성능 이슈
    5. 명명규칙 및 Ubiquitous Language 일치"
)
```

**방법 B — Claude 서브에이전트 fallback:**
Codex MCP가 설치되지 않았거나 인증이 안 된 경우:
```
Task(
  subagent_type: "code-reviewer",
  model: "sonnet",
  prompt: "변경된 코드를 종합 리뷰하세요. [변경 파일 목록과 diff 포함]"
)
```

**판단 기준:**
1. `ask_codex` 도구가 사용 가능한지 확인
2. 사용 가능 → 방법 A 실행
3. 사용 불가 (도구 없음 또는 에러) → 방법 B 실행

### Step 3: Surgical Changes 검증 (변경 범위 확인)

요청 범위를 벗어난 수정이 없는지 확인한다.

**체크리스트:**
- 요청된 기능/수정에 직접 관련된 파일만 변경했는가?
- 인접 코드의 스타일 개선, 리팩토링, 네이밍 변경을 "ついで(겸사겸사)" 하지 않았는가?
- 기존 코드의 스타일(네이밍, 포맷, 패턴)과 일치하는가?
- 자신이 만든 orphan(사용되지 않는 코드)만 정리했는가? (기존 코드의 orphan은 건드리지 않음)

**판단 기준:**
```
git diff --stat HEAD  # 변경된 파일 목록을 보고:
- 요청과 무관한 파일이 포함되어 있으면 → 되돌리기
- "이왕 수정하는 김에 주변도 개선하자"는 금지
- 버그 수정 시: 해당 버그와 직접 관련된 코드만 수정
```

### Step 3.5: Spec(plan.md) 기준 일관성 검증

수정이 누적되어도 원래 Spec(plan.md)의 방향과 일치하는지 확인한다.

**체크리스트:**
- 구현 결과가 plan.md §1 목표(Goal)와 일치하는가?
- plan.md §2 범위(Scope)를 벗어난 변경이 없는가?
- 수정 요청이 여러 번 있었다면, 최종 결과가 Spec 기준으로 일관성을 유지하는가?
- plan.md가 변경 사항을 반영하여 업데이트되었는가? (수정 시 Spec 먼저 갱신 원칙)

**판단 기준:**
```
plan.md가 있으면:
  - plan.md §1 목표와 구현 결과를 대조
  - 불일치 발견 시 → plan.md를 먼저 업데이트하거나 구현을 수정
  - "Spec이 진실의 원천(Source of Truth)"
plan.md가 없으면:
  - 이 Step을 건너뛰되, plan 부재를 보고서에 기록
```

### Step 4: Think Before Coding 검증

코드 작성 전에 충분히 생각했는지 확인한다.

- 암묵적 가정이 코드에 숨어있지 않은가? (하드코딩된 값, 특정 환경 의존)
- 요구사항의 해석이 여러 가지일 때, 한 가지만 선택하고 넘어가지 않았는가?
- "왜 이렇게 구현했는가?"에 대한 근거가 plan.md/context.md에 기록되어 있는가?

**적용 기준:** 사소한 수정(오타, 설정값 변경)에는 적용하지 않는다.

### Step 5: Demand Elegance 체크

비자명한 코드(30줄 이상의 신규 파일, 복잡한 로직)에 대해 아래를 자문한다:

- "더 단순하고 우아한 방법이 없는가?"
- "중첩된 조건문을 early return이나 guard clause로 개선할 수 있는가?"
- "반복 패턴을 추상화할 수 있는가?"
- "시니어 개발자가 코드 리뷰를 한다면 통과할 수 있는 수준인가?"

**적용 기준:** 변수명 오타 수정, 단순 설정 변경 등 사소한 수정에는 적용하지 않는다.
개선할 부분이 발견되면 즉시 리팩토링 후 다음 단계로 진행한다.

### Step 6: 자체 검증 (교차 검증과 병행)

교차 검증 결과를 기다리는 동안 아래 항목을 직접 확인한다:

**DDD 패턴 검증:**
- Model → Store → Service → Route 계층 확인
- Store가 Protocol을 구현하는지
- Service가 Store를 통해서만 데이터 접근하는지
- Route가 Service만 호출하는지

**에러 핸들링 검증:**
- 새/변경된 async 함수에 적절한 에러 처리
- HTTP 응답 코드가 올바른지 (400, 404, 500 등)
- 에러 메시지가 사용자에게 유용한지

**보안 검증 (웹/SaaS 15항목):**
- CORS/Preflight: 허용 Origin 화이트리스트, 와일드카드 남용 없음
- CSRF: 상태 변경 요청에 토큰 적용
- XSS+CSP: 입력 이스케이프/새니타이즈, CSP 헤더 설정
- SSRF: 서버 측 URL 요청 시 내부 IP 차단
- AuthN/AuthZ: 보호 엔드포인트에 인증+권한 검증 적용
- RBAC/ABAC+테넌트격리: 역할 기반 접근 제어, 데이터 격리
- 최소 권한: DB·API키·서비스 계정 최소 권한
- Validation+SQLi: 입력 검증 + Parameterized Query
- RateLimit/Bruteforce: 로그인·API에 Rate Limit
- 쿠키(HttpOnly·Secure·SameSite)+세션보안: 세션 고정 방어, 타임아웃
- Secret 관리+Rotation: 환경변수/Vault, 하드코딩 없음
- HTTPS/HSTS+보안헤더: HSTS, X-Frame-Options 등
- AuditLog: 주요 이벤트 로깅
- 에러노출 차단: 스택트레이스/내부경로 미노출
- 의존성 취약점: `npm audit` / `pip-audit` 통과

**Ubiquitous Language 검증:**
- 새로 추가된 모든 식별자가 비즈니스 용어와 일치
- 약어 사용 최소화

### Step 7: 테스트 실행
```bash
pytest -q
```
실패 시 원인 분석 및 수정 방안 제시

### Step 8: TDD 사이클 증거 검증

TDD가 활성화된 프로젝트에서 TDD 사이클 완료를 검증한다.

**TDD 활성 여부 확인:**
```bash
python3 -c "
import json
try:
    data = json.load(open('.omc/project-memory.json'))
    print('ENABLED' if data.get('tdd', {}).get('enabled', False) else 'DISABLED')
except:
    print('DISABLED')
" 2>/dev/null
```

**TDD ENABLED인 경우:**

1. **사이클 결과 확인**: `.omc/state/tdd-result` 파일에서 RED/GREEN/REFACTOR 모두 DONE인지
2. **수정 순서 확인**: `.omc/state/tdd-edit-order`에서 TEST가 SOURCE보다 먼저 기록되었는지
3. **테스트 커버리지 확인**: 변경된 소스 파일에 대응하는 테스트 파일이 존재하는지
4. **Edge Case 확인**: 테스트에 Edge Case가 2개 이상 포함되었는지

**판단 기준:**
```
tdd-result 미존재 → WARNING (TDD 사이클 미실행)
REFACTOR가 DONE이 아님 → WARNING (사이클 미완료)
SOURCE만 있고 TEST 없음 → WARNING (테스트 미작성)
모두 통과 → OK
```

**보고서 TDD 항목:**
```
### TDD 검증 결과
- TDD 사이클: 완료/미완료
- 수정 순서: TEST→SOURCE 준수/미준수
- 테스트 커버리지: N/M 파일 커버
- Edge Case: N개 확인
```

### Step 9: 빌드 검증 (해당 시)
```bash
python -m py_compile src/main.py
cd frontend-next && npx tsc --noEmit 2>&1 | head -20
```

### Step 10: 최종 보고서 생성

교차 검증 결과와 자체 검증 결과를 종합하여 보고한다:

```
## Post-task Report

### 교차 검증 결과 (Codex/서브에이전트)
- 검증 방법: Codex MCP / Claude 서브에이전트
- 발견된 이슈: [목록 또는 "없음"]
- 심각도: Critical / Warning / Info

### 자체 검증 결과
- 변경 파일: [목록]
- 테스트 결과: PASS/FAIL
- DDD 준수: OK/ISSUE
- 보안 검증: OK/ISSUE
- 명명 규칙: OK/ISSUE
- Spec 일관성: OK/ISSUE (plan.md 대비 결과 일치 여부)
- Surgical Changes: OK/ISSUE (요청 범위 외 수정 여부)
- Think Before Coding: OK/ISSUE (암묵적 가정 여부)

### 사용자 확인 필요 항목
- [ ] 실제 환경에서 동작 확인
- [ ] UX/사용성 확인
- [ ] (교차 검증에서 발견된 이슈 해결 확인)

### 남은 TODO
- [있으면 목록]
```

### Step 11: Self-Improvement Loop (교훈 기록)

이번 작업에서 배운 것을 `lessons.md`에 기록한다.

기록 대상:
- 처음에 잘못된 방향으로 갔다가 수정한 경우
- 예상치 못한 엣지 케이스를 발견한 경우
- 교차 검증에서 지적받은 사항
- 프로젝트 특유의 규칙이나 패턴을 발견한 경우

기록하지 않는 경우:
- 단순 오타 수정, 이미 lessons.md에 있는 내용

```
lessons.md에 추가:
- **상황**: [이번에 겪은 상황]
  - ❌ [처음에 했던 잘못된 행동]
  - ✅ [올바른 행동]
```

기존에 비슷한 규칙이 있으면 합치고 더 구체적으로 다듬는다.

## Rules
- 교차 검증은 반드시 실행한다 (Codex 또는 서브에이전트)
- 교차 검증에서 Critical 이슈 발견 시 사용자에게 즉시 알리고 수정 제안
- 자체 검증과 교차 검증 결과가 충돌하면 더 엄격한 쪽을 따른다
- Verification 기준: "시니어 개발자가 코드 리뷰해도 통과할 수준인가?"
- Demand Elegance: 비자명 코드는 제출 전 개선 가능성 검토
- Self-Improvement: 매 작업 완료 시 lessons.md 기록 (같은 실수 반복 방지)
- Spec-First Modification: 수정 요청 시 plan.md를 먼저 업데이트하고 재구현 (Spec이 진실의 원천)
- Surgical Changes: 요청 범위 외 수정 발견 시 되돌리기 (인접 코드 개선 금지)
- Think Before Coding: 암묵적 가정은 명시하고, 근거를 plan.md/context.md에 기록
- Goal-Driven Execution: 모호한 작업은 검증 가능한 목표로 변환 후 실행
- 마커 파일(.omc/state/cross-verified)을 업데이트하여 중복 실행 방지

## Argument: $ARGUMENTS
검증 범위 (빈 경우 전체 변경사항 대상)
