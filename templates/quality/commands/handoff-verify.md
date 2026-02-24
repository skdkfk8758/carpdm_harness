# Handoff Verify (Fresh-Context 검증)

현재 작업 의도를 기록하고, 새로운 컨텍스트의 에이전트가 독립적으로 빌드/린트/테스트를 검증한다.
기존 컨텍스트의 편향(confirmation bias)을 제거하여 검증 신뢰도를 높인다.

> 원칙: 코드를 작성한 에이전트가 검증하면 자기 확인 편향이 발생한다. 독립 검증이 진짜 검증이다.

## Instructions

### Step 1: 작업 의도 기록

`.omc/state/handoff-intent.md`에 현재 작업 의도를 기록한다:

```markdown
# Handoff Intent
- Date: YYYY-MM-DD HH:MM
- Task: [작업 설명]
- Changed Files: [변경 파일 목록]
- Expected Behavior: [기대 동작]
- Acceptance Criteria:
  - [ ] 빌드 성공
  - [ ] 기존 테스트 통과
  - [ ] 새 기능 테스트 통과
  - [ ] lint 에러 없음
```

### Step 2: 변경 사항 스냅샷

```bash
git diff --stat HEAD
git diff --name-only HEAD
```

변경 파일 목록과 diff 통계를 기록한다.

### Step 3: Fresh-Context 에이전트 호출

Task 도구로 새로운 verifier 에이전트를 생성하여 독립 검증을 실행한다:

```
Task(subagent_type="oh-my-claudecode:verifier", prompt="
.omc/state/handoff-intent.md를 읽고, 다음을 독립적으로 검증하세요:
1. 빌드 성공 여부 (프로젝트의 빌드 도구로 실행)
2. 전체 테스트 통과 여부
3. lint 에러 없음
4. 변경 파일이 intent에 기록된 것과 일치하는지
5. Acceptance Criteria 각 항목 충족 여부
결과를 .omc/state/handoff-verify-result에 저장하세요.
")
```

### Step 4: 결과 확인 및 보고

`.omc/state/handoff-verify-result`를 읽어 최종 보고:

```
========================================
  Handoff Verify 결과
========================================
검증 에이전트: fresh-context verifier
의도 파일: .omc/state/handoff-intent.md

✅ 빌드: PASS
✅ 테스트: PASS (42/42)
✅ Lint: PASS
✅ 파일 일치: PASS
✅ Acceptance: 3/3 충족

최종 판정: PASS — 커밋/PR 진행 가능
```

## Rules
- 검증 에이전트는 반드시 새로운 컨텍스트에서 실행한다 (Task 도구 사용)
- 의도 파일은 검증 전에 완성되어야 한다
- 검증 에이전트에게 "수정"을 요청하지 않는다 — 검증만 수행
- 실패 시 원래 에이전트(자신)가 수정 후 다시 handoff-verify를 실행한다
- 의도 파일과 실제 변경이 불일치하면 FAIL 처리한다

## Argument: $ARGUMENTS
`--quick` — 빌드+테스트만 검증 (lint, acceptance 생략)
`--strict` — 모든 항목 필수 (하나라도 FAIL이면 전체 FAIL)
