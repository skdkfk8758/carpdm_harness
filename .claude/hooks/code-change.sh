#!/bin/bash
# Hook: PostToolUse (Edit|Write) - Code Change Logger + Quality Reminder
# 코드 변경 후: (1) 변경 기록 자동 저장, (2) 품질 체크 리마인더, (3) todo.md 갱신 알림
source "$(dirname "$0")/_harness-common.sh"

INPUT=$(cat)

# Worktree-aware: CLAUDE_CWD → git worktree root → pwd
harness_set_cwd
harness_init_event_log "$INPUT"

# 수정된 파일 경로 추출
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    inp = data.get('tool_input', {})
    print(inp.get('file_path', inp.get('path', '')))
except:
    print('')
" 2>/dev/null)

# 도구 이름 추출 (Edit/Write 구분)
TOOL_NAME=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_name', 'unknown'))
except:
    print('unknown')
" 2>/dev/null)

# 소스 코드 변경인 경우에만 처리
case "$FILE_PATH" in
    *.py|*.ts|*.tsx|*.js|*.jsx|*.go|*.rs|*.java|*.rb|*.swift|*.kt|*.c|*.cpp|*.cs|*.sql)

        # === 1. 변경 기록 자동 저장 (.harness/change-log.md) ===
        mkdir -p ".harness" 2>/dev/null
        CHANGE_LOG=".harness/change-log.md"
        TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
        DATE_HEADER=$(date '+%Y-%m-%d')

        # 변경 유형 판별
        if [ "$TOOL_NAME" = "Write" ]; then
            CHANGE_TYPE="CREATE"
        else
            CHANGE_TYPE="MODIFY"
        fi

        # 현재 진행 중인 TODO 항목 추출 (왜 수정했는지)
        CURRENT_TASK=""
        if [ -f ".agent/todo.md" ]; then
            CURRENT_TASK=$(grep -m1 '← CURRENT' .agent/todo.md 2>/dev/null | sed 's/.*\] //' | sed 's/ ← CURRENT//' | head -c 80)
        elif [ -f "todo.md" ]; then
            CURRENT_TASK=$(grep -m1 '← CURRENT' todo.md 2>/dev/null | sed 's/.*\] //' | sed 's/ ← CURRENT//' | head -c 80)
        fi
        # todo.md가 없거나 CURRENT 항목이 없으면 기본값 설정
        if [ -z "$CURRENT_TASK" ]; then
            CURRENT_TASK="(작업 항목 미지정 — todo.md에 ← CURRENT 마커를 추가하세요)"
        fi

        # plan.md 상태 확인 (.agent/ 우선)
        PLAN_STATUS=""
        PLAN_FILE=""
        if [ -f ".agent/plan.md" ]; then
            PLAN_FILE=".agent/plan.md"
        elif [ -f "plan.md" ]; then
            PLAN_FILE="plan.md"
        fi
        if [ -n "$PLAN_FILE" ]; then
            PLAN_STATUS=$(grep -oE 'DRAFT|APPROVED|IN_PROGRESS|COMPLETED' "$PLAN_FILE" 2>/dev/null | head -1)
        fi

        # 변경 로그 파일 초기화 (없으면 생성)
        if [ ! -f "$CHANGE_LOG" ]; then
            cat > "$CHANGE_LOG" << 'HEADER'
# Change Log

에이전트가 작업 중 수정한 파일의 자동 기록입니다.
각 항목은 **무엇을**(파일), **어떻게**(변경 유형), **왜**(현재 TODO) 수정했는지 추적합니다.

---
HEADER
        fi

        # 날짜 헤더가 없으면 추가
        if ! grep -q "## ${DATE_HEADER}" "$CHANGE_LOG" 2>/dev/null; then
            echo "" >> "$CHANGE_LOG"
            echo "## ${DATE_HEADER}" >> "$CHANGE_LOG"
            echo "" >> "$CHANGE_LOG"
            echo "| 시각 | 유형 | 파일 | 이유 (현재 TODO) |" >> "$CHANGE_LOG"
            echo "|------|------|------|-----------------|" >> "$CHANGE_LOG"
        fi

        # 기록 추가
        RELATIVE_PATH="${FILE_PATH#$CWD/}"
        echo "| ${TIMESTAMP##* } | ${CHANGE_TYPE} | \`${RELATIVE_PATH}\` | ${CURRENT_TASK} |" >> "$CHANGE_LOG"

        # === 2. 품질 체크 리마인더 출력 ===
        TODO_REMINDER=""
        TODO_FILE=""
        if [ -f ".agent/todo.md" ]; then
            TODO_FILE=".agent/todo.md"
        elif [ -f "todo.md" ]; then
            TODO_FILE="todo.md"
        fi
        if [ -n "$TODO_FILE" ]; then
            REMAINING=$(grep -c '\[ \]' "$TODO_FILE" 2>/dev/null) || true; REMAINING=${REMAINING:-0}
            TODO_REMINDER="todo.md: ${REMAINING}개 항목 남음 - 완료된 항목은 체크하세요"
        else
            TODO_REMINDER=".agent/todo.md가 없습니다 - 생성을 고려하세요"
        fi

        # 변경 규모 판별 (Demand Elegance 적용 여부)
        FILE_LINES=0
        if [ -f "$FILE_PATH" ]; then
            FILE_LINES=$(wc -l < "$FILE_PATH" 2>/dev/null | tr -d ' ')
        fi

        ELEGANCE_HINT=""
        if [ "$FILE_LINES" -gt 30 ] || [ "$CHANGE_TYPE" = "CREATE" ]; then
            ELEGANCE_HINT="
- Demand Elegance: 비자명 코드입니다. 제출 전 \"더 우아한 방법 없나?\" 자문하세요
  (단순 수정/오타 수정은 건너뛰기)"
        fi

        # === TDD 수정 순서 추적 ===
        TDD_EDIT_HINT=""
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
                harness_ensure_state_dir
                TDD_ORDER_FILE="$HARNESS_STATE_DIR/tdd-edit-order"
                TDD_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

                # 테스트 파일인지 소스 파일인지 판별
                IS_TEST=false
                case "$RELATIVE_PATH" in
                    test_*|*/test_*|*_test.*|tests/*|**/tests/*|*.test.*|*.spec.*|*__tests__/*|**/__tests__/*|*_test.go|*Test.java|*Test.kt|src/test/*)
                        IS_TEST=true
                        ;;
                esac

                if [ "$IS_TEST" = true ]; then
                    echo "TEST:${RELATIVE_PATH}:${TDD_TIMESTAMP}" >> "$TDD_ORDER_FILE"
                else
                    echo "SOURCE:${RELATIVE_PATH}:${TDD_TIMESTAMP}" >> "$TDD_ORDER_FILE"

                    # 연속 SOURCE 수정 감지 (최근 3개가 모두 SOURCE이면 경고)
                    RECENT_SOURCES=$(tail -3 "$TDD_ORDER_FILE" 2>/dev/null | grep -c '^SOURCE:') || true
                    if [ "${RECENT_SOURCES:-0}" -ge 3 ]; then
                        TDD_EDIT_HINT="
- [TDD] 소스 파일만 연속 수정 중입니다. 테스트를 먼저 작성하세요! (Red-Green-Refactor)"
                    fi
                fi
            fi
        fi

        cat <<EOF
[CODE CHANGE] ${FILE_PATH##*/} ${CHANGE_TYPE}
- ${TODO_REMINDER}
- Core Principles: Simplicity First / No Laziness / Minimal Impact / Surgical Changes
- Surgical Changes: 요청 범위 내 파일만 수정했는지 확인 (인접 코드 개선/리팩토링 금지)
- 기존 코드 스타일 일치: 네이밍, 포맷, 패턴을 주변 코드에 맞추기
- DDD 확인: Model→Store→Service→Route 계층 준수
- 명명 확인: Ubiquitous Language (docs/conventions.md)
- 의사결정 기록: 설계 결정/트레이드오프 발생 시 .agent/context.md에 기록 (Think Before Coding)
- 변경 기록: .harness/change-log.md에 자동 저장됨${ELEGANCE_HINT}${TDD_EDIT_HINT}
EOF
        ;;
esac
harness_log_event "code-change" "PASS" "PostToolUse" "$CHANGE_TYPE" "$TOOL_NAME" "$FILE_PATH"
exit 0
