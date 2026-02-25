# Verify Loop (자동 재시도 검증)

빌드, 린트, 테스트를 실행하고, 실패 시 자동으로 수정 후 재시도한다. 최대 3회까지 반복한다.

> 원칙: 한 번 실패에 포기하지 않는다. 자동 수정 가능한 문제는 스스로 고친다.

## Instructions

### Step 1: 검증 대상 식별

프로젝트의 검증 도구를 감지한다:

| 도구 | 감지 조건 | 명령 |
|------|----------|------|
| TypeScript 빌드 | `tsconfig.json` 존재 | `npx tsc --noEmit` |
| ESLint | `.eslintrc*` 또는 `eslint.config.*` 존재 | `npx eslint .` |
| Prettier | `.prettierrc*` 존재 | `npx prettier --check .` |
| Jest/Vitest | `jest.config.*` 또는 `vitest.config.*` | `npm test` |
| pytest | `pytest.ini` 또는 `pyproject.toml[tool.pytest]` | `pytest -q` |
| Go | `go.mod` 존재 | `go build ./... && go test ./...` |

### Step 2: 검증 루프 실행 (최대 3회)

```
attempt = 1
while attempt <= 3:
    results = run_all_checks()
    if all_passed(results):
        report_success(attempt)
        break

    failures = get_failures(results)
    if attempt < 3:
        auto_fix(failures)  # Step 3 참조
        attempt += 1
    else:
        report_final_failure(failures)
```

### Step 3: 자동 수정 전략

실패 유형별 자동 수정:

| 실패 유형 | 자동 수정 방법 |
|----------|--------------|
| TypeScript 타입 에러 | 에러 메시지 분석 → 타입 수정 |
| ESLint 에러 | `npx eslint --fix` 실행 |
| Prettier 포맷 | `npx prettier --write` 실행 |
| 테스트 실패 | 에러 스택트레이스 분석 → 코드 수정 |
| import 에러 | 누락 import 추가 / 경로 수정 |
| 빌드 에러 | 에러 메시지 기반 수정 |

자동 수정 불가능한 에러(로직 오류, 설계 문제):
→ 수정 시도하지 않고 실패 보고

### Step 4: 결과 보고

`.omc/state/verify-loop-result`에 저장:

```
## Verify Loop Result
- Date: YYYY-MM-DD HH:MM
- Total Attempts: N/3
- Final Status: PASS | FAIL

### Attempt History
| # | 빌드 | 린트 | 테스트 | 자동수정 |
|---|------|------|--------|---------|
| 1 | FAIL | PASS | PASS   | eslint --fix |
| 2 | PASS | PASS | PASS   | -        |

### Summary
- 전체 통과 (2번째 시도에서 성공)
```

## Rules
- 최대 3회까지만 재시도한다. 무한 루프 방지
- 자동 수정은 안전한 수정만 시도한다 (포맷팅, 타입 수정, import 수정)
- 로직 변경이 필요한 실패는 자동 수정하지 않는다
- 각 시도의 전체 출력을 보존한다
- 1회차에서 모두 통과하면 즉시 종료한다
- 자동 수정 후 반드시 전체 검증을 다시 실행한다 (부분 실행 금지)

## Argument: $ARGUMENTS
`--max N` — 최대 재시도 횟수 변경 (기본 3)
`--no-fix` — 자동 수정 없이 검증만 실행
`--only build|lint|test` — 특정 검증만 실행
