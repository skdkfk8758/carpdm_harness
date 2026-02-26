# Quick Check — 빌드 + 타입체크 + 테스트 빠른 실행

변경사항이 기존 코드를 깨뜨리지 않았는지 빠르게 확인한다.

## Argument: $ARGUMENTS
특정 테스트 파일/패턴 (예: "workflow", "tests/quality.test.ts"). 없으면 전체 실행.

## Instructions

### Step 1: 타입체크

```bash
npx tsc --noEmit 2>&1
```

타입체크가 없는 프로젝트면 SKIP.

### Step 2: 빌드

```bash
npm run build 2>&1
```

### Step 3: 테스트

$ARGUMENTS가 있으면 해당 테스트만:
```bash
npx vitest run $ARGUMENTS 2>&1
```

없으면 전체:
```bash
npm test 2>&1
```

### Step 4: 결과 요약

성공 시:
```
Quick Check 결과
━━━━━━━━━━━━━━━
✅ Typecheck: 0 errors
✅ Build: success (2.1s)
✅ Test: 273 passed (4.3s)
━━━━━━━━━━━━━━━
ALL PASS ✅
```

실패 시:
```
Quick Check 결과
━━━━━━━━━━━━━━━
✅ Typecheck: 0 errors
❌ Build: 1 error
⏭️  Test: skipped (build 실패)
━━━━━━━━━━━━━━━
FAIL ❌ — 빌드 에러 수정 필요

[에러 요약]
...
```

## Rules
- typecheck → build → test 순서로 실행
- 앞 단계 실패 시 뒷 단계 스킵 가능 (시간 절약)
- 에러 출력은 핵심 부분만 요약 (마지막 20줄)
- 프로젝트에 없는 도구는 SKIP 처리
