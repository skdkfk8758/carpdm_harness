#!/bin/bash
# Hook: Stop - Post-task 검증 리마인더 + 교차 검증 자동 트리거
# AI가 응답을 마칠 때 실행: 미완료 항목 확인, 교차 검증 실행

# Worktree-aware: CLAUDE_CWD → git worktree root → pwd
CWD="${CLAUDE_CWD:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$CWD" 2>/dev/null || exit 0

OUTPUT=""

# === 파일 경로 탐색 (.agent/ 우선, 루트 fallback) ===
TODO_FILE=""
PLAN_FILE=""
CTX_FILE=""
LESSONS_FILE=""
SESSION_LOG=""

if [ -f ".agent/todo.md" ]; then TODO_FILE=".agent/todo.md"
elif [ -f "todo.md" ]; then TODO_FILE="todo.md"; fi

if [ -f ".agent/plan.md" ]; then PLAN_FILE=".agent/plan.md"
elif [ -f "plan.md" ]; then PLAN_FILE="plan.md"; fi

if [ -f ".agent/context.md" ]; then CTX_FILE=".agent/context.md"
elif [ -f "context.md" ]; then CTX_FILE="context.md"; fi

if [ -f ".agent/lessons.md" ]; then LESSONS_FILE=".agent/lessons.md"
elif [ -f "lessons.md" ]; then LESSONS_FILE="lessons.md"; fi

if [ -f ".agent/session-log.md" ]; then SESSION_LOG=".agent/session-log.md"
elif [ -f "session-log.md" ]; then SESSION_LOG="session-log.md"; fi

# === 초기 상태 가이드 (plan/todo 모두 없을 때) ===
if [ -z "$PLAN_FILE" ] && [ -z "$TODO_FILE" ]; then
    OUTPUT="[POST-TASK] 작업 문서가 아직 없습니다. 시작하려면:
  1. .agent/plan.md 작성 (목표, Edge Case, 변경 범위)
  2. .agent/todo.md 작성 (체크리스트 + ← CURRENT 마커)
  3. .agent/context.md 생성 (의사결정 기록용)
  4. .agent/session-log.md (세션 요약 — TODO 완료 시 자동 안내됨)"
fi

# todo.md 잔여 항목 확인
if [ -n "$TODO_FILE" ]; then
    DONE=$(grep -c '\[x\]' "$TODO_FILE" 2>/dev/null) || true; DONE=${DONE:-0}
    REMAINING=$(grep -c '\[ \]' "$TODO_FILE" 2>/dev/null) || true; REMAINING=${REMAINING:-0}
    TOTAL=$((DONE + REMAINING))

    if [ "$REMAINING" -gt 0 ]; then
        OUTPUT="[POST-TASK] todo.md: ${DONE}/${TOTAL} completed (${REMAINING} remaining)"
    fi
fi

# plan.md가 있고 IN_PROGRESS인데 todo가 다 끝났으면 완료 처리 알림
if [ -n "$PLAN_FILE" ] && [ -n "$TODO_FILE" ]; then
    PLAN_STATUS=$(grep -oE 'DRAFT|APPROVED|IN_PROGRESS|COMPLETED' "$PLAN_FILE" 2>/dev/null | head -1)
    REMAINING=$(grep -c '\[ \]' "$TODO_FILE" 2>/dev/null) || true; REMAINING=${REMAINING:-0}

    if [ "$PLAN_STATUS" = "IN_PROGRESS" ] && [ "$REMAINING" -eq 0 ]; then
        OUTPUT="${OUTPUT}
[POST-TASK] 모든 TODO 완료! Post-task 검증을 실행하세요:
- pytest -q (테스트 통과 확인)
- DDD 패턴 준수 확인
- plan.md 상태를 COMPLETED로 변경
- Verification: '시니어 개발자가 리뷰해도 통과할 수준인가?' 자문"
    fi
fi

# === context.md 의사결정 기록 리마인더 ===
if [ -n "$CTX_FILE" ]; then
    DECISION_COUNT=$(grep -c '^### Decision' "$CTX_FILE" 2>/dev/null) || true; DECISION_COUNT=${DECISION_COUNT:-0}
    OUTPUT="${OUTPUT}
[CONTEXT] context.md: ${DECISION_COUNT}개 결정 기록됨
  설계 결정/트레이드오프 발생 시 .agent/context.md에 기록하세요 (승인된 결정만)."
elif [ -n "$PLAN_FILE" ]; then
    OUTPUT="${OUTPUT}
[CONTEXT] context.md가 없습니다. .agent/context.md를 생성하세요.
  의사결정 근거를 기록해야 세션 간 컨텍스트가 유지됩니다."
fi

# === Self-Improvement Loop: 실수 감지 + lessons.md 기록 검증 ===
mkdir -p ".omc/state" 2>/dev/null
MISTAKE_DETECTED=false
MISTAKE_SIGNALS=""

# (A) 실수 신호 감지
# 신호 1: 최근 커밋에서 연속 fix 패턴 (같은 파일을 고치는 fix 커밋 2회 이상)
if command -v git &>/dev/null; then
    FIX_COMMITS=$(git log --oneline -10 2>/dev/null | grep -ciE '^[a-f0-9]+ (fix|hotfix|patch|revert)') || true; FIX_COMMITS=${FIX_COMMITS:-0}
    if [ "$FIX_COMMITS" -ge 2 ]; then
        MISTAKE_DETECTED=true
        MISTAKE_SIGNALS="${MISTAKE_SIGNALS}\n  - 연속 fix 커밋 ${FIX_COMMITS}회 감지 (같은 문제를 반복 수정)"
    fi
fi

# 신호 2: todo.md에서 체크 해제(되돌림) 흔적 — 완료 수가 이전보다 줄었으면
LESSONS_COUNTER=".omc/state/lessons-counter"
if [ -n "$TODO_FILE" ]; then
    CURRENT_DONE=$(grep -c '\[x\]' "$TODO_FILE" 2>/dev/null) || true; CURRENT_DONE=${CURRENT_DONE:-0}
    if [ -f ".omc/state/todo-done-count" ]; then
        PREV_DONE=$(cat ".omc/state/todo-done-count" 2>/dev/null || echo "0")
        if [ "$CURRENT_DONE" -lt "$PREV_DONE" ]; then
            MISTAKE_DETECTED=true
            MISTAKE_SIGNALS="${MISTAKE_SIGNALS}\n  - TODO 되돌림 감지 (완료 ${PREV_DONE}→${CURRENT_DONE}, 이전 작업을 번복)"
        fi
    fi
    echo "$CURRENT_DONE" > ".omc/state/todo-done-count"
fi

# 신호 3: Dumb Zone 카운터가 이미 2 이상 (반복 수정 진행 중)
EDIT_COUNTER_VAL=0
if [ -f ".omc/state/edit-counter" ]; then
    EDIT_COUNTER_VAL=$(cat ".omc/state/edit-counter" 2>/dev/null || echo "0")
    if [ "$EDIT_COUNTER_VAL" -ge 2 ]; then
        MISTAKE_DETECTED=true
        MISTAKE_SIGNALS="${MISTAKE_SIGNALS}\n  - 동일 파일 반복 수정 ${EDIT_COUNTER_VAL}회 (Dumb Zone 접근 중)"
    fi
fi

# (A) 실수 감지 시 강화 메시지
if [ "$MISTAKE_DETECTED" = true ]; then
    OUTPUT="${OUTPUT}

[LESSONS - MISTAKE DETECTED] 실수 신호가 감지되었습니다:${MISTAKE_SIGNALS}

반드시 .agent/lessons.md에 구체적으로 기록하세요:
  - **상황**: [어떤 작업에서 문제가 발생했는지]
    - ❌ [처음에 했던 잘못된 접근]
    - ✅ [올바른 접근 (지금 알게 된 것)]
  카테고리: 코딩/아키텍처/테스트/도메인/도구 중 선택"
else
    # 실수 미감지 시 일반 리마인더 (기존 동작)
    if [ -n "$TODO_FILE" ]; then
        DONE_COUNT=$(grep -c '\[x\]' "$TODO_FILE" 2>/dev/null) || true; DONE_COUNT=${DONE_COUNT:-0}
        if [ "$DONE_COUNT" -gt 0 ]; then
            OUTPUT="${OUTPUT}
[LESSONS] 이번 작업에서 배운 교훈이 있으면 .agent/lessons.md에 기록하세요.
  형식: 상황 → ❌ 잘못된 행동 → ✅ 올바른 행동"
        fi
    fi
fi

# (B) lessons.md 기록 검증: 이전 카운트 vs 현재 카운트 비교
if [ -n "$LESSONS_FILE" ]; then
    CURRENT_LESSONS=$(grep -c '^- \*\*상황\*\*' "$LESSONS_FILE" 2>/dev/null) || true; CURRENT_LESSONS=${CURRENT_LESSONS:-0}
    if [ -f "$LESSONS_COUNTER" ]; then
        PREV_LESSONS=$(cat "$LESSONS_COUNTER" 2>/dev/null || echo "0")
        NEW_LESSONS=$((CURRENT_LESSONS - PREV_LESSONS))
        if [ "$NEW_LESSONS" -gt 0 ]; then
            OUTPUT="${OUTPUT}
[LESSONS] 이번 세션에서 ${NEW_LESSONS}개 교훈 추가됨 (총 ${CURRENT_LESSONS}개) ✓"
        elif [ "$MISTAKE_DETECTED" = true ]; then
            OUTPUT="${OUTPUT}
[LESSONS] 실수가 감지되었으나 교훈이 기록되지 않았습니다. lessons.md를 업데이트하세요."
        fi
    fi
    echo "$CURRENT_LESSONS" > "$LESSONS_COUNTER"
fi

# === 세션 요약 자동 생성 ===
if [ -n "$TODO_FILE" ]; then
    SUMMARY_REMAINING=$(grep -c '\[ \]' "$TODO_FILE" 2>/dev/null) || true; SUMMARY_REMAINING=${SUMMARY_REMAINING:-0}
    if [ "$SUMMARY_REMAINING" -eq 0 ]; then
        SUMMARY_DATE=$(date '+%Y-%m-%d %H:%M')
        OUTPUT="${OUTPUT}

[SESSION SUMMARY] 모든 작업 완료 — .agent/session-log.md에 세션 요약을 작성하세요:
  형식:
  ## ${SUMMARY_DATE} 세션
  - **목표**: (이번 세션의 핵심 목표)
  - **완료**: (완료된 작업 요약, 1-3줄)
  - **결정사항**: (주요 설계 결정과 근거)
  - **변경 파일**: (핵심 변경 파일 목록)
  - **미완료/다음 할 일**: (남은 작업이 있으면 기록)
  기존 session-log.md가 있으면 맨 위에 추가하세요 (최신이 위로).
  <!-- PRIVATE -->...<!-- /PRIVATE --> 태그로 민감 정보를 보호할 수 있습니다."
    fi
fi

# === Dumb Zone 감지 (컨텍스트 포화 방지) ===
# 동일 파일이 3회 이상 수정되었으면 리셋 권고
if command -v git &>/dev/null; then
    # git log에서 최근 세션(1시간 이내) 동일 파일 수정 횟수 확인
    DUMB_ZONE_FILES=$(git diff --name-only 2>/dev/null | sort | uniq -c | sort -rn | awk '$1 >= 3 {print $2}' 2>/dev/null)
    # 대안: staged + unstaged 합쳐서 반복 수정 파일 감지
    if [ -z "$DUMB_ZONE_FILES" ]; then
        REPEAT_EDITS=$({ git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null; } | sort | uniq -d 2>/dev/null)
        # .omc에 수정 카운터 유지
        mkdir -p ".omc/state" 2>/dev/null
        EDIT_COUNTER=".omc/state/edit-counter"
        if [ -n "$REPEAT_EDITS" ] && [ -f "$EDIT_COUNTER" ]; then
            PREV_COUNT=$(cat "$EDIT_COUNTER" 2>/dev/null || echo "0")
            NEW_COUNT=$((PREV_COUNT + 1))
            echo "$NEW_COUNT" > "$EDIT_COUNTER"
            if [ "$NEW_COUNT" -ge 3 ]; then
                OUTPUT="${OUTPUT}

[DUMB ZONE WARNING] 동일 파일이 반복 수정되고 있습니다 (${NEW_COUNT}회 감지).
컨텍스트 포화 신호:
  - 같은 파일을 계속 고치고 있다면
  - 수정할수록 품질이 하락한다면
  - 앞뒤가 안 맞는 결과가 나온다면

리셋 절차를 권고합니다:
  1. 지금까지 확정된 내용/결정/남은 작업을 1페이지로 요약
  2. .agent/context.md에 요약 기록
  3. 새 세션에서 context.md + plan.md 기반으로 재시작
  (같은 대화창에서 계속 수정하면 Dumb Zone에 빠집니다)"
                # 리셋 후 카운터 초기화를 위해 유지
            fi
        elif [ -n "$REPEAT_EDITS" ]; then
            echo "1" > "$EDIT_COUNTER"
        fi
    fi
fi

# === TDD 사이클 완료 확인 ===
TDD_MEMORY=".omc/project-memory.json"
if [ -f "$TDD_MEMORY" ]; then
    TDD_ON=$(python3 -c "
import json
try:
    data = json.load(open('$TDD_MEMORY'))
    print('true' if data.get('tdd', {}).get('enabled', False) else 'false')
except:
    print('false')
" 2>/dev/null)
    if [ "$TDD_ON" = "true" ]; then
        TDD_RESULT=".omc/state/tdd-result"
        TDD_ORDER=".omc/state/tdd-edit-order"

        # tdd-result 확인: Refactor Phase가 DONE인지
        if [ -f "$TDD_RESULT" ]; then
            REFACTOR_DONE=$(grep -c 'REFACTOR.*DONE' "$TDD_RESULT" 2>/dev/null) || true
            if [ "${REFACTOR_DONE:-0}" -eq 0 ]; then
                OUTPUT="${OUTPUT}

[TDD] TDD 사이클이 완료되지 않았습니다.
  → .omc/state/tdd-result에 REFACTOR Phase가 DONE이 아닙니다.
  → /tdd-cycle 커맨드로 사이클을 완료하세요."
            else
                OUTPUT="${OUTPUT}

[TDD] TDD 사이클 완료 확인 ✓"
            fi
        fi

        # tdd-edit-order 분석: 소스만 수정하고 테스트 미작성 확인
        if [ -f "$TDD_ORDER" ]; then
            SOURCE_ONLY=$(grep -c '^SOURCE:' "$TDD_ORDER" 2>/dev/null) || true
            TEST_COUNT=$(grep -c '^TEST:' "$TDD_ORDER" 2>/dev/null) || true
            if [ "${SOURCE_ONLY:-0}" -gt 0 ] && [ "${TEST_COUNT:-0}" -eq 0 ]; then
                OUTPUT="${OUTPUT}

[TDD] 소스 파일만 수정되고 테스트가 작성되지 않았습니다.
  → 소스 수정 ${SOURCE_ONLY}건, 테스트 수정 ${TEST_COUNT}건
  → TDD 원칙: 테스트를 먼저 작성한 후 소스 코드를 수정하세요."
            fi
        fi
    fi
fi

# === Verify 게이트 (실행 기반 검증 확인) ===
# 코드/훅 변경이 있는데 verify-result가 없으면 경고
VERIFY_RESULT=".omc/state/verify-result"
VG_CODE=$(git diff --name-only 2>/dev/null | grep -cE '\.(py|ts|tsx|js|jsx|go|rs|java|rb|swift|kt|c|cpp|cs|sh)$') || true; VG_CODE=${VG_CODE:-0}
VG_STAGED=$(git diff --cached --name-only 2>/dev/null | grep -cE '\.(py|ts|tsx|js|jsx|go|rs|java|rb|swift|kt|c|cpp|cs|sh)$') || true; VG_STAGED=${VG_STAGED:-0}
TOTAL_SIGNIFICANT=$((VG_CODE + VG_STAGED))

if [ "$TOTAL_SIGNIFICANT" -gt 0 ]; then
    if [ -f "$VERIFY_RESULT" ]; then
        # verify-result가 있으면 요약 표시
        VERIFY_PASS=$(grep -c '| PASS |' "$VERIFY_RESULT" 2>/dev/null) || true; VERIFY_PASS=${VERIFY_PASS:-0}
        VERIFY_FAIL=$(grep -c '| FAIL |' "$VERIFY_RESULT" 2>/dev/null) || true; VERIFY_FAIL=${VERIFY_FAIL:-0}
        if [ "$VERIFY_FAIL" -gt 0 ]; then
            OUTPUT="${OUTPUT}

[VERIFY] 실행 검증 결과: ${VERIFY_PASS} PASS / ${VERIFY_FAIL} FAIL — 실패 항목을 확인하세요."
        else
            OUTPUT="${OUTPUT}

[VERIFY] 실행 검증 완료: ${VERIFY_PASS}개 항목 모두 PASS ✓"
        fi
    else
        OUTPUT="${OUTPUT}

[VERIFY] 코드/훅 변경이 감지되었으나 실행 기반 검증이 없습니다.
  /verify를 실행하여 변경사항을 실제 실행으로 검증하세요.
  (패턴 매칭 ≠ 검증. 실행 결과가 증거입니다)"
    fi
fi

# === 교차 검증 자동 트리거 ===
# 코드 파일 변경 감지
CODE_CHANGED=$(git diff --name-only 2>/dev/null | grep -cE '\.(py|ts|tsx|js|jsx|go|rs|java|rb|swift|kt|c|cpp|cs)$') || true; CODE_CHANGED=${CODE_CHANGED:-0}
STAGED_CODE=$(git diff --cached --name-only 2>/dev/null | grep -cE '\.(py|ts|tsx|js|jsx|go|rs|java|rb|swift|kt|c|cpp|cs)$') || true; STAGED_CODE=${STAGED_CODE:-0}

# 변경된 파일이 있는지 확인
CHANGED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHANGED" -gt 0 ] || [ "$STAGED" -gt 0 ]; then
    OUTPUT="${OUTPUT}
[GIT] 커밋되지 않은 변경: ${CHANGED} unstaged, ${STAGED} staged"
fi

# 코드 변경이 있을 때만 교차 검증 실행
if [ "$CODE_CHANGED" -gt 0 ] || [ "$STAGED_CODE" -gt 0 ]; then
    # 무한루프 방지: 마커 파일 확인
    mkdir -p ".omc/state" 2>/dev/null
    VERIFY_MARKER=".omc/state/cross-verified"

    SHOULD_VERIFY=true
    if [ -f "$VERIFY_MARKER" ]; then
        # 마커가 5분(300초) 이내면 스킵
        if command -v stat &>/dev/null; then
            if [ "$(uname)" = "Darwin" ]; then
                MARKER_TIME=$(stat -f %m "$VERIFY_MARKER" 2>/dev/null || echo "0")
            else
                MARKER_TIME=$(stat -c %Y "$VERIFY_MARKER" 2>/dev/null || echo "0")
            fi
            NOW=$(date +%s)
            ELAPSED=$((NOW - MARKER_TIME))
            if [ "$ELAPSED" -lt 300 ]; then
                SHOULD_VERIFY=false
            fi
        fi
    fi

    if [ "$SHOULD_VERIFY" = true ]; then
        # 변경된 코드 파일 목록 수집
        CHANGED_FILES=$({ git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null; } | grep -E '\.(py|ts|tsx|js|jsx|go|rs|java|rb|swift|kt|c|cpp|cs)$' | sort -u | head -10)

        # 마커 생성 (다음 5분간 재실행 방지)
        date +%s > "$VERIFY_MARKER"

        OUTPUT="${OUTPUT}

[CROSS-VERIFY] 코드 변경 감지 — 교차 검증을 자동 실행합니다.
변경 파일:
${CHANGED_FILES}

아래 절차를 즉시 실행하세요:
1. Codex MCP 사용 가능 여부 확인 (ask_codex 도구 존재 여부)
2-A. Codex 사용 가능: mcp__plugin_oh-my-claudecode_x__ask_codex(agent_role: \"code-reviewer\", context_files: [변경 파일 경로], prompt: \"아래 변경된 코드를 종합 리뷰하세요. 관점: 로직 결함, 패턴 준수, 보안 취약점, 성능, 명명규칙\")
2-B. Codex 사용 불가: Task(subagent_type: \"code-reviewer\", prompt: \"변경된 코드를 종합 리뷰하세요\", model: \"sonnet\")로 서브에이전트 생성
3. 검증 결과를 사용자에게 간결하게 보고"
    fi
fi

[ -n "$OUTPUT" ] && echo "$OUTPUT"
exit 0
