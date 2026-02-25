#!/usr/bin/env bash
# Hook wrapper — dist/ 부재 시 graceful fallback
# Usage: bash run-hook.sh <hook-name>
# Example: bash run-hook.sh session-end

HOOK_NAME="$1"
HOOK_PATH="${CLAUDE_PLUGIN_ROOT}/dist/hooks/${HOOK_NAME}.js"

if [ -z "$HOOK_NAME" ]; then
  echo '{"result":"continue"}' >&2
  echo '{"result":"continue"}'
  exit 0
fi

if [ ! -f "$HOOK_PATH" ]; then
  echo "[harness] Hook not found: ${HOOK_PATH} — skipping (dist/ not built?)" >&2
  echo '{"result":"continue"}'
  exit 0
fi

node "$HOOK_PATH"
