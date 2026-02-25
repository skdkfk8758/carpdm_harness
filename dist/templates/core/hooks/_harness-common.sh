#!/bin/bash
# Harness 공통 유틸리티 함수
# 모든 harness 훅에서 source "$(dirname "$0")/_harness-common.sh" 로 로드

# === 상태 경로 상수 ===
HARNESS_STATE_DIR=".harness/state"

# === OMC 경로 상수 ===
OMC_STATE_DIR=".omc/state"
OMC_CONFIG_PATH="$HOME/.claude/.omc-config.json"

# === OMC 감지 함수 ===

# OMC가 설치되어 있는지 확인 (config 또는 디렉토리 존재)
harness_omc_installed() {
    [ -f "$OMC_CONFIG_PATH" ] || [ -d ".omc" ]
}

# OMC 모드가 현재 활성 상태인지 확인
# .omc/state/ 하위에 *-state.json 파일이 존재하고 "active": true 포함 시 true
harness_omc_mode_active() {
    if [ ! -d "$OMC_STATE_DIR" ]; then
        return 1
    fi
    for state_file in "$OMC_STATE_DIR"/*-state.json; do
        if [ -f "$state_file" ] && grep -q '"active": true' "$state_file" 2>/dev/null; then
            return 0
        fi
    done
    return 1
}

# OMC 활성 모드 이름 반환 (autopilot, ralph, ultrawork, team, pipeline 등)
# 활성 모드가 없으면 빈 문자열 반환
harness_omc_active_mode() {
    if [ ! -d "$OMC_STATE_DIR" ]; then
        echo ""
        return
    fi
    for state_file in "$OMC_STATE_DIR"/*-state.json; do
        if [ -f "$state_file" ] && grep -q '"active": true' "$state_file" 2>/dev/null; then
            # 파일명에서 모드 추출: autopilot-state.json → autopilot
            local mode
            mode=$(basename "$state_file" | sed 's/-state\.json$//')
            echo "$mode"
            return
        fi
    done
    echo ""
}

# OMC가 계획을 관리하는 모드인지 확인 (autopilot, ralph, ultrapilot)
# 이 모드들에서는 plan-guard를 완화해야 함
harness_omc_manages_planning() {
    local mode
    mode=$(harness_omc_active_mode)
    case "$mode" in
        autopilot|ralph|ultrapilot|ultrawork) return 0 ;;
        *) return 1 ;;
    esac
}

# OMC 팀 모드인지 확인 (team, swarm)
# 팀 모드에서는 차단 훅을 비활성화하고 로깅만 유지
harness_omc_team_mode() {
    local mode
    mode=$(harness_omc_active_mode)
    case "$mode" in
        team|swarm) return 0 ;;
        *) return 1 ;;
    esac
}

# === 공통 유틸리티 함수 ===

# CLAUDE_CWD → git worktree root → pwd 순서로 작업 디렉토리 설정
harness_set_cwd() {
    CWD="${CLAUDE_CWD:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
    cd "$CWD" 2>/dev/null || exit 0
}

# .harness/state 디렉토리 보장
harness_ensure_state_dir() {
    mkdir -p "$HARNESS_STATE_DIR" 2>/dev/null
}

# === 이벤트 로깅 ===
HARNESS_EVENTS_DIR=".harness/events"
HARNESS_SESSION_ID=""

harness_init_event_log() {
    local input="$1"
    HARNESS_SESSION_ID=$(echo "$input" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' \
        | head -1 | sed 's/.*: *"//' | sed 's/"//')
    if [ -z "$HARNESS_SESSION_ID" ]; then
        [ -f "$HARNESS_STATE_DIR/current-session" ] && \
            HARNESS_SESSION_ID=$(cat "$HARNESS_STATE_DIR/current-session" 2>/dev/null)
    fi
    [ -z "$HARNESS_SESSION_ID" ] && HARNESS_SESSION_ID="unknown"
    export HARNESS_SESSION_ID
}

harness_log_event() {
    local hook="$1" result="$2" event="$3" detail="${4:-}" tool="${5:-}" file="${6:-}"
    mkdir -p "$CWD/$HARNESS_EVENTS_DIR" 2>/dev/null || return 0
    local ts; ts=$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')
    printf '{"ts":"%s","session":"%s","event":"%s","hook":"%s","result":"%s"' \
        "$ts" "$HARNESS_SESSION_ID" "$event" "$hook" "$result" \
        >> "$CWD/$HARNESS_EVENTS_DIR/${HARNESS_SESSION_ID}.jsonl" 2>/dev/null
    [ -n "$detail" ] && printf ',"detail":"%s"' "$detail" \
        >> "$CWD/$HARNESS_EVENTS_DIR/${HARNESS_SESSION_ID}.jsonl" 2>/dev/null
    [ -n "$tool" ] && printf ',"tool":"%s"' "$tool" \
        >> "$CWD/$HARNESS_EVENTS_DIR/${HARNESS_SESSION_ID}.jsonl" 2>/dev/null
    [ -n "$file" ] && printf ',"file":"%s"' "$file" \
        >> "$CWD/$HARNESS_EVENTS_DIR/${HARNESS_SESSION_ID}.jsonl" 2>/dev/null
    printf '}\n' >> "$CWD/$HARNESS_EVENTS_DIR/${HARNESS_SESSION_ID}.jsonl" 2>/dev/null || true
}

# === plan-guard 설정 읽기 ===

# plan-guard 모드 읽기 (block | warn)
harness_get_plan_guard_mode() {
    local config_file="${CWD:-$(pwd)}/carpdm-harness.config.json"
    if [ ! -f "$config_file" ]; then
        echo "block"
        return
    fi
    local mode
    mode=$(python3 -c "
import json
try:
    data = json.load(open('$config_file'))
    print(data.get('planGuard', 'block'))
except:
    print('block')
" 2>/dev/null)
    # python3 폴백: grep
    if [ -z "$mode" ]; then
        mode=$(grep -o '"planGuard"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" 2>/dev/null | grep -o '"[^"]*"$' | tr -d '"')
        [ -z "$mode" ] && mode="block"
    fi
    echo "$mode"
}

# === capabilities 읽기 ===

# capabilities.json에서 도구 감지 여부 확인
harness_has_capability() {
    local tool_name="$1"
    local caps_file="${CWD:-$(pwd)}/.harness/capabilities.json"
    if [ ! -f "$caps_file" ]; then
        return 1
    fi
    local detected
    detected=$(python3 -c "
import json
try:
    data = json.load(open('$caps_file'))
    tools = data.get('tools', {})
    tool = tools.get('$tool_name', {})
    print('true' if tool.get('detected', False) else 'false')
except:
    print('false')
" 2>/dev/null)
    # python3 폴백: grep
    if [ -z "$detected" ]; then
        if grep -q "\"$tool_name\"" "$caps_file" 2>/dev/null && grep -A2 "\"$tool_name\"" "$caps_file" 2>/dev/null | grep -q '"detected"[[:space:]]*:[[:space:]]*true'; then
            detected="true"
        else
            detected="false"
        fi
    fi
    [ "$detected" = "true" ] && return 0 || return 1
}
