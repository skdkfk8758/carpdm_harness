#!/bin/bash
# Hook: PreToolUse (Edit|Write) - Plan Guard
# 코드 파일 수정 시 plan.md 승인 여부 확인
# plan이 없거나 DRAFT 상태면 경고 주입
source "$(dirname "$0")/_harness-common.sh"

# stdin에서 JSON 읽기
INPUT=$(cat)

# Worktree-aware: CLAUDE_CWD → git worktree root → pwd
harness_set_cwd
harness_init_event_log "$INPUT"

# 수정 대상 파일 추출
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    inp = data.get('tool_input', {})
    print(inp.get('file_path', inp.get('path', '')))
except:
    print('')
" 2>/dev/null)

# 설정/문서 파일은 plan 없이도 허용
case "$FILE_PATH" in
    */.claude/*|*/.omc/*|*/.agent/*|*/docs/*|*.md|*/.gitignore|*/.env*)
        exit 0
        ;;
esac

# plan.md 경로 탐색 (.agent/ 우선)
PLAN_FILE=""
if [ -f ".agent/plan.md" ]; then PLAN_FILE=".agent/plan.md"
elif [ -f "plan.md" ]; then PLAN_FILE="plan.md"; fi

# 소스 코드 파일인지 확인
case "$FILE_PATH" in
    *.py|*.ts|*.tsx|*.js|*.jsx|*.sql)
        # OMC 모드 활성 시 경고를 hint 수준으로 완화
        if harness_omc_mode_active; then
            if [ -z "$PLAN_FILE" ]; then
                echo "[PLAN GUARD] plan.md가 없습니다. OMC 모드 활성 중 — 작업 후 plan.md 작성을 고려하세요."
            else
                STATUS=$(grep -oE 'DRAFT|APPROVED|IN_PROGRESS|COMPLETED' "$PLAN_FILE" 2>/dev/null | head -1)
                if [ "$STATUS" = "DRAFT" ]; then
                    echo "[PLAN GUARD] plan.md가 DRAFT 상태입니다. OMC 모드 활성 중 — 승인 후 진행을 권장합니다."
                fi
            fi
            exit 0
        fi

        # plan.md 확인
        if [ -z "$PLAN_FILE" ]; then
            cat <<'EOF'
⚠️ [PLAN GUARD] plan.md가 존재하지 않습니다.
Plan-First 원칙: 코드 수정 전에 .agent/plan.md를 작성하고 사용자 승인을 받으세요.
- .agent/plan.md 초안 작성 → 사용자 OK → 그 후 코드 수정
- 단순 1-2줄 버그 수정은 예외 (사유를 명시하세요)
EOF
        else
            STATUS=$(grep -oE 'DRAFT|APPROVED|IN_PROGRESS|COMPLETED' "$PLAN_FILE" 2>/dev/null | head -1)
            if [ "$STATUS" = "DRAFT" ]; then
                cat <<'EOF'
⚠️ [PLAN GUARD] plan.md가 DRAFT 상태입니다. 아직 승인되지 않았습니다.
사용자에게 plan을 제시하고 OK를 받은 후 코드를 수정하세요.
EOF
            elif [ "$STATUS" = "APPROVED" ] || [ "$STATUS" = "IN_PROGRESS" ]; then
                cat <<'EOF'
💡 [SPEC-FIRST] 수정 작업이라면 plan.md(Spec)를 먼저 업데이트했는지 확인하세요.
- Spec이 진실의 원천: 수정 요청 → plan.md 갱신 → 재구현
- plan.md §0(As-Is)과 §1(Goal)이 현재 수정 방향과 일치하는지 확인
- 계획 변경 없는 단순 구현이면 이 메시지를 무시하세요
EOF
            fi
        fi
        ;;
esac
harness_log_event "plan-guard" "PASS" "PreToolUse" "" "" "$FILE_PATH"
exit 0
