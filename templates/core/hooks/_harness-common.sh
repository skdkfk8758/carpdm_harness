#!/bin/bash
# Harness 공통 유틸리티 함수
# 모든 harness 훅에서 source "$(dirname "$0")/_harness-common.sh" 로 로드

# === 상태 경로 상수 ===
HARNESS_STATE_DIR=".harness/state"

# === OMC 감지 함수 ===

# OMC가 설치되어 있는지 확인 (config 또는 디렉토리 존재)
harness_omc_installed() {
    [ -f "$HOME/.claude/.omc-config.json" ] || [ -d ".omc" ]
}

# OMC 모드가 현재 활성 상태인지 확인
# .omc/state/ 하위에 *-state.json 파일이 존재하고 "active": true 포함 시 true
harness_omc_mode_active() {
    if [ ! -d ".omc/state" ]; then
        return 1
    fi
    for state_file in .omc/state/*-state.json; do
        if [ -f "$state_file" ] && grep -q '"active": true' "$state_file" 2>/dev/null; then
            return 0
        fi
    done
    return 1
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
