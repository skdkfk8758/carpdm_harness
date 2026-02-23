# TDD Cycle (Red-Green-Refactor)

TDD 사이클을 실행한다. 실패하는 테스트 작성 → 최소 구현 → 리팩토링 순서로 진행하며, 각 단계의 실행 결과를 증거로 기록한다.

> 원칙: "RED → GREEN → REFACTOR. 테스트 없는 코드는 코드가 아니다."

## Instructions

### Step 1: 대상 확인

`$ARGUMENTS`가 있으면 해당 기능/파일을 대상으로 한다.
없으면 todo.md의 `← CURRENT` 항목을 대상으로 한다.

```bash
# 현재 작업 확인
if [ -f ".agent/todo.md" ]; then
    grep '← CURRENT' .agent/todo.md
elif [ -f "todo.md" ]; then
    grep '← CURRENT' todo.md
fi
```

대상이 명확하지 않으면 사용자에게 확인한다.

### Step 2: 테스트 프레임워크 자동 감지

프로젝트에 설치된 테스트 프레임워크를 감지한다:

```bash
# Python
pip list 2>/dev/null | grep -i pytest && echo "FRAMEWORK: pytest"
[ -f "pyproject.toml" ] && grep -q "pytest" pyproject.toml && echo "FRAMEWORK: pytest"

# JavaScript/TypeScript
[ -f "package.json" ] && cat package.json | python3 -c "
import sys, json
try:
    pkg = json.load(sys.stdin)
    deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
    if 'vitest' in deps: print('FRAMEWORK: vitest')
    elif 'jest' in deps: print('FRAMEWORK: jest')
    elif 'mocha' in deps: print('FRAMEWORK: mocha')
except: pass
" 2>/dev/null

# Go
[ -f "go.mod" ] && echo "FRAMEWORK: go test"

# Rust
[ -f "Cargo.toml" ] && echo "FRAMEWORK: cargo test"
```

감지된 프레임워크에 맞는 테스트 실행 명령을 결정한다.

### 불변 법칙

> **"프로덕션 코드는 선행하는 실패하는 테스트 없이 존재할 수 없다."**

이 원칙에는 예외가 없다. 설정 파일, 문서, 빌드 스크립트는 대상이 아니지만,
비즈니스 로직이 포함된 소스 코드는 반드시 테스트가 선행해야 한다.

### 합리화 반박 (TDD 건너뛰기 방지)

에이전트가 TDD를 건너뛰려 할 때 흔히 쓰는 합리화와 그 반박:

| 합리화 | 반박 |
|--------|------|
| "너무 간단해서 테스트 불필요" | 간단한 코드도 자주 실패한다. 테스트 작성은 초 단위. |
| "나중에 테스트 작성하겠음" | 사후 테스트는 즉시 통과해서 실패 증거를 남기지 못함. RED 단계의 의미가 사라짐. |
| "이미 수동으로 확인함" | 수동 테스트는 반복 불가능하고 불완전하며 임시적. 자동화된 테스트만 유효. |
| "시간이 너무 걸림" | 미검증 코드가 만드는 기술부채가 테스트 비용보다 항상 크다. |
| "리팩토링일 뿐이라 안 깨짐" | 리팩토링이야말로 회귀 테스트가 가장 필수적인 상황. |
| "유틸 함수라 따로 테스트 안 해도 됨" | 유틸 함수는 가장 많이 재사용되므로 가장 먼저 테스트해야 함. |

**이 중 하나라도 떠오르면 → 그것이 바로 테스트가 필요한 신호다.**

### Step 3: RED — 실패하는 테스트 작성

**대상 기능에 대한 테스트를 먼저 작성한다.**

테스트 작성 규칙:
- 기능의 **기대 동작**을 명확히 정의하는 테스트 케이스
- Edge Case 최소 2개 포함
- 기존 테스트 패턴을 참고하여 일관된 스타일로 작성
- 테스트 파일 위치는 프로젝트 규약을 따름

```bash
# 테스트 실행 → 반드시 FAIL 확인
pytest tests/test_<대상>.py -v 2>&1     # Python
npx vitest run <대상>.test.ts 2>&1      # Vitest
npx jest <대상>.test.ts 2>&1            # Jest
go test ./... -run <대상> -v 2>&1       # Go
```

**RED 확인**: 테스트가 실패(FAIL)하는 것을 확인한다.
테스트가 이미 통과하면 테스트가 올바르지 않은 것이므로 수정한다.

**RED 검증 체크리스트:**
- [ ] 테스트가 실패하는 이유가 **기능 미구현** 때문인가? (구문 오류, import 오류가 아닌지 확인)
- [ ] 테스트가 **단일 행동**만 검증하는가? (테스트 이름에 "and"가 있으면 분할 필요)
- [ ] 테스트 이름이 **의도를 명확히 전달**하는가?

### Step 4: GREEN — 최소 구현

**테스트를 통과시키는 최소한의 코드를 작성한다.**

구현 규칙:
- 테스트를 통과시키는 데 필요한 **최소한의 코드만** 작성
- 과도한 추상화나 미래 대비 설계 금지
- 기존 코드 패턴/스타일과 일관성 유지

```bash
# 테스트 실행 → PASS 확인
pytest tests/test_<대상>.py -v 2>&1     # Python
npx vitest run <대상>.test.ts 2>&1      # Vitest
npx jest <대상>.test.ts 2>&1            # Jest
go test ./... -run <대상> -v 2>&1       # Go
```

**GREEN 확인**: 모든 새 테스트가 통과(PASS)하는 것을 확인한다.
기존 테스트도 깨지지 않았는지 전체 실행하여 확인한다.

**GREEN 과도 구현 적신호:**
- "이왕 만드는 김에 이것도 추가" → 금지. 테스트에 없는 기능은 구현하지 않는다.
- "나중에 필요할 것 같으니 미리" → YAGNI 위반. 현재 테스트만 통과시킨다.
- "좀 더 범용적으로 만들면" → 현재 테스트가 요구하지 않는 추상화는 금지.

### Step 5: REFACTOR — 품질 개선

**동작을 유지하면서 코드 품질을 개선한다.**

리팩토링 대상:
- 중복 코드 제거
- 변수/함수 명명 개선
- 복잡한 조건문 단순화 (guard clause, early return)
- 불필요한 코드 정리

```bash
# 리팩토링 후 전체 테스트 실행 → 모두 PASS 확인
pytest -q 2>&1                          # Python
npx vitest run 2>&1                     # Vitest
npx jest 2>&1                           # Jest
go test ./... 2>&1                      # Go
```

**REFACTOR 확인**: 전체 테스트가 여전히 통과하는 것을 확인한다.

### Step 6: 사이클 결과 기록

`.omc/state/tdd-result`에 사이클 결과를 기록한다:

```bash
mkdir -p .omc/state
```

**기록 형식:**
```
## TDD Cycle Result
- Date: YYYY-MM-DD HH:MM
- Target: [대상 기능/파일]
- Framework: [테스트 프레임워크]

### Phases
| Phase | Status | Evidence |
|-------|--------|----------|
| RED | DONE | 테스트 N개 작성, FAIL 확인 |
| GREEN | DONE | 최소 구현 완료, PASS 확인 |
| REFACTOR | DONE | 리팩토링 완료, 전체 PASS 확인 |

### Test Cases
- [x] 기본 동작 테스트
- [x] Edge Case 1: [설명]
- [x] Edge Case 2: [설명]

### Files
- Test: [테스트 파일 경로]
- Source: [소스 파일 경로]
```

### Step 7: 다음 사이클 또는 완료

**추가 테스트 케이스가 필요한지 확인한다:**
- Edge Case가 2개 이상 커버되었는가?
- 경계값(boundary) 테스트가 있는가?
- 에러/예외 케이스가 커버되었는가?

추가 필요 시 Step 3으로 돌아가 새 사이클을 시작한다.
모든 케이스가 커버되면 완료한다.

**완료 보고:**
```
========================================
  TDD Cycle 완료
========================================

  대상: [기능/파일]
  테스트: N개 (전체 PASS)
  사이클: N회

  증거 파일: .omc/state/tdd-result
========================================
```

## Rules
- **RED 없이 GREEN 없다**: 반드시 실패하는 테스트를 먼저 작성
- **최소 구현**: GREEN 단계에서는 테스트 통과에 필요한 최소한만 구현
- **전체 테스트 보호**: 매 단계마다 기존 테스트가 깨지지 않았는지 확인
- **Edge Case 필수**: 최소 2개 이상의 Edge Case 테스트 포함
- **증거 기록**: 각 단계의 실행 결과를 `.omc/state/tdd-result`에 저장
- **기존 패턴 준수**: 테스트 파일 위치, 네이밍, 스타일은 프로젝트 규약을 따름
- **InMemory Store 사용**: DB 테스트는 InMemory 구현 사용 (실 DB 의존 금지)
- **합리화 감지**: 위 테이블의 변명이 떠오르면 그것이 테스트 필요 신호
- **단일 행동 테스트**: 테스트 하나는 동작 하나만 검증. "and" 있으면 분할
- **과도 구현 금지**: GREEN에서는 현재 실패 테스트를 통과시키는 최소한만 작성

## Argument: $ARGUMENTS
TDD 대상 (기능명, 파일 경로, 또는 TODO 항목). 빈 경우 todo.md의 현재 항목을 대상으로 한다.
