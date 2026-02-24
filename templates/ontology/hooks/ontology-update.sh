#!/bin/bash
# 온톨로지 자동 갱신 훅 (PostToolUse:Edit|Write)
# 코드 파일 변경 시 Structure + Semantics 레이어를 백그라운드로 점진 갱신
source "$(dirname "$0")/_harness-common.sh"

harness_set_cwd

# 플러그인 루트 확인
PLUGIN_ROOT=""
if [ -f ".harness/plugin-root" ]; then
    PLUGIN_ROOT=$(cat ".harness/plugin-root" 2>/dev/null)
fi

if [ -z "$PLUGIN_ROOT" ] || [ ! -d "$PLUGIN_ROOT" ]; then
    exit 0
fi

REFRESH_SCRIPT="$PLUGIN_ROOT/dist/ontology-refresh.js"
if [ ! -f "$REFRESH_SCRIPT" ]; then
    exit 0
fi

# 디바운스 (5초 이내 중복 실행 방지)
CACHE_FILE=".harness/state/ontology-last-update"
if [ -f "$CACHE_FILE" ]; then
    LAST=$(cat "$CACHE_FILE" 2>/dev/null)
    NOW=$(date +%s)
    if [ -n "$LAST" ] && [ $((NOW - LAST)) -lt 5 ]; then
        exit 0
    fi
fi

mkdir -p ".harness/state" 2>/dev/null
date +%s > "$CACHE_FILE" 2>/dev/null

# 백그라운드로 점진적 갱신 실행
node "$REFRESH_SCRIPT" "$CWD" >/dev/null 2>&1 &
exit 0
