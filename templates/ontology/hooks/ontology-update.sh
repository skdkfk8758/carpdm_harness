#!/bin/bash
# 온톨로지 자동 갱신 훅 (PostToolUse:Edit|Write)

CACHE_FILE=".agent/ontology/.cache/last-update"
if [ -f "$CACHE_FILE" ]; then
  LAST=$(cat "$CACHE_FILE")
  NOW=$(date +%s)
  DIFF=$((NOW - LAST))
  if [ "$DIFF" -lt 5 ]; then
    exit 0
  fi
fi

npx carpdm-harness ontology --refresh --layer structure 2>/dev/null &
mkdir -p "$(dirname "$CACHE_FILE")"
date +%s > "$CACHE_FILE"
