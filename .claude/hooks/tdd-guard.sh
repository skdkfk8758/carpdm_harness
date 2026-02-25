#!/bin/bash
# Hook: PreToolUse (Edit|Write) - TDD Guard
# 소스 코드 수정 시 대응하는 테스트 파일 존재 여부 확인
# 테스트 파일이 없으면 Block (exit 1) 또는 Warn (exit 0 + 경고)
source "$(dirname "$0")/_harness-common.sh"

# stdin에서 JSON 읽기
INPUT=$(cat)

# Worktree-aware: CLAUDE_CWD → git worktree root → pwd
harness_set_cwd
harness_init_event_log "$INPUT"

# === 1. TDD 활성화 확인 ===
MEMORY_FILE=".omc/project-memory.json"
if [ ! -f "$MEMORY_FILE" ]; then
    exit 0
fi

TDD_ENABLED=$(python3 -c "
import json, sys
try:
    data = json.load(open('$MEMORY_FILE'))
    tdd = data.get('tdd', {})
    print('true' if tdd.get('enabled', False) else 'false')
except:
    print('false')
" 2>/dev/null)

if [ "$TDD_ENABLED" != "true" ]; then
    exit 0
fi

# === 2. TDD 모드 확인 (block/warn) ===
TDD_MODE=$(python3 -c "
import json
try:
    data = json.load(open('$MEMORY_FILE'))
    print(data.get('tdd', {}).get('mode', 'block'))
except:
    print('block')
" 2>/dev/null)

# Speed Mode 확인 → block을 warn으로 완화
SPEED_MODE_WARN=$(python3 -c "
import json
try:
    data = json.load(open('$MEMORY_FILE'))
    print('true' if data.get('tdd', {}).get('speedModeWarn', True) else 'false')
except:
    print('true')
" 2>/dev/null)

if [ "$SPEED_MODE_WARN" = "true" ] && [ -f "$HARNESS_STATE_DIR/task-mode" ]; then
    CURRENT_MODE=$(cat "$HARNESS_STATE_DIR/task-mode" 2>/dev/null)
    if [ "$CURRENT_MODE" = "Speed" ]; then
        TDD_MODE="warn"
    fi
fi

# === 3. 수정 대상 파일 추출 ===
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    inp = data.get('tool_input', {})
    print(inp.get('file_path', inp.get('path', '')))
except:
    print('')
" 2>/dev/null)

[ -z "$FILE_PATH" ] && exit 0

# 상대 경로로 변환
REL_PATH="${FILE_PATH#$CWD/}"

# === 4. 제외 대상 확인 ===
# 설정/문서/.claude/.omc/.agent 파일은 제외
case "$REL_PATH" in
    .claude/*|.omc/*|.agent/*|docs/*|*.md|*.json|*.yaml|*.yml|*.toml|*.cfg|*.ini|*.env*|*.gitignore|*.lock|Makefile|Dockerfile|docker-compose*|*.sh|*.txt|*.csv|*.xml|*.html|*.css|*.scss|*.less|*.svg|*.png|*.jpg|*.gif|*.ico)
        exit 0
        ;;
esac

# === 5. 테스트 파일 자체 수정 확인 ===
case "$REL_PATH" in
    # Python 테스트
    test_*|*/test_*|*_test.py|tests/*|**/tests/*)
        exit 0
        ;;
    # JS/TS 테스트
    *.test.*|*.spec.*|*__tests__/*|**/__tests__/*)
        exit 0
        ;;
    # Go 테스트
    *_test.go)
        exit 0
        ;;
    # Rust 테스트
    tests/*.rs|**/tests/*.rs)
        exit 0
        ;;
    # Java/Kotlin 테스트
    *Test.java|*Test.kt|*Spec.java|*Spec.kt|src/test/*)
        exit 0
        ;;
esac

# === 6. 소스 코드 파일인지 확인 ===
case "$REL_PATH" in
    *.py|*.ts|*.tsx|*.js|*.jsx|*.go|*.rs|*.java|*.kt|*.swift|*.c|*.cpp|*.cs|*.rb)
        # 소스 코드 파일 → 테스트 매핑 진행
        ;;
    *)
        # 소스 코드가 아닌 파일 → 통과
        exit 0
        ;;
esac

# === 7. 언어별 테스트 파일 매핑 ===
FILENAME=$(basename "$REL_PATH")
DIRNAME=$(dirname "$REL_PATH")
NAME_NO_EXT="${FILENAME%.*}"
EXT="${FILENAME##*.}"

TEST_FOUND=false

case "$EXT" in
    py)
        # Python: tests/test_foo.py → src/tests/test_foo.py → src/test_foo.py
        for TEST_PATH in \
            "tests/test_${NAME_NO_EXT}.py" \
            "${DIRNAME}/tests/test_${NAME_NO_EXT}.py" \
            "${DIRNAME}/test_${NAME_NO_EXT}.py" \
            "test/test_${NAME_NO_EXT}.py" \
            "tests/${DIRNAME}/test_${NAME_NO_EXT}.py"; do
            if [ -f "$TEST_PATH" ]; then
                TEST_FOUND=true
                break
            fi
        done
        ;;
    ts|tsx|js|jsx)
        # JS/TS: __tests__/foo.test.ts → foo.test.ts → foo.spec.ts
        BASE_EXT="$EXT"
        # tsx→tsx, ts→ts 유지
        for TEST_PATH in \
            "${DIRNAME}/__tests__/${NAME_NO_EXT}.test.${BASE_EXT}" \
            "${DIRNAME}/${NAME_NO_EXT}.test.${BASE_EXT}" \
            "${DIRNAME}/${NAME_NO_EXT}.spec.${BASE_EXT}" \
            "${DIRNAME}/__tests__/${NAME_NO_EXT}.test.ts" \
            "${DIRNAME}/${NAME_NO_EXT}.test.ts" \
            "${DIRNAME}/${NAME_NO_EXT}.spec.ts" \
            "tests/${NAME_NO_EXT}.test.${BASE_EXT}" \
            "test/${NAME_NO_EXT}.test.${BASE_EXT}"; do
            if [ -f "$TEST_PATH" ]; then
                TEST_FOUND=true
                break
            fi
        done
        ;;
    go)
        # Go: 같은 디렉토리에 foo_test.go
        if [ -f "${DIRNAME}/${NAME_NO_EXT}_test.go" ]; then
            TEST_FOUND=true
        fi
        ;;
    rs)
        # Rust: tests/foo.rs 또는 인라인 #[cfg(test)]
        if [ -f "tests/${NAME_NO_EXT}.rs" ]; then
            TEST_FOUND=true
        elif [ -f "$REL_PATH" ] && grep -q '#\[cfg(test)\]' "$REL_PATH" 2>/dev/null; then
            TEST_FOUND=true
        fi
        ;;
    java|kt)
        # Java/Kotlin: src/test/.../FooTest.java
        TEST_DIR_PATH=$(echo "$REL_PATH" | sed 's|src/main/|src/test/|')
        TEST_FILE_PATH="${TEST_DIR_PATH%.*}Test.${EXT}"
        if [ -f "$TEST_FILE_PATH" ]; then
            TEST_FOUND=true
        fi
        # Spec 패턴도 확인
        SPEC_FILE_PATH="${TEST_DIR_PATH%.*}Spec.${EXT}"
        if [ -f "$SPEC_FILE_PATH" ]; then
            TEST_FOUND=true
        fi
        ;;
    swift)
        # Swift: Tests/FooTests.swift
        for TEST_PATH in \
            "Tests/${NAME_NO_EXT}Tests.swift" \
            "${DIRNAME}/Tests/${NAME_NO_EXT}Tests.swift"; do
            if [ -f "$TEST_PATH" ]; then
                TEST_FOUND=true
                break
            fi
        done
        ;;
    c|cpp|cs|rb)
        # C/C++/C#/Ruby: 기본 패턴
        for TEST_PATH in \
            "tests/test_${NAME_NO_EXT}.${EXT}" \
            "test/test_${NAME_NO_EXT}.${EXT}" \
            "${DIRNAME}/test_${NAME_NO_EXT}.${EXT}"; do
            if [ -f "$TEST_PATH" ]; then
                TEST_FOUND=true
                break
            fi
        done
        ;;
esac

# === 8. 결과 처리 ===
if [ "$TEST_FOUND" = true ]; then
    harness_log_event "tdd-guard" "PASS" "PreToolUse" "" "" "$REL_PATH"
    exit 0
fi

# 테스트 파일 미존재
if [ "$TDD_MODE" = "block" ]; then
    cat <<EOF
[TDD GUARD] 테스트 파일이 존재하지 않습니다.

  소스 파일: ${REL_PATH}
  TDD 원칙: 테스트를 먼저 작성한 후 소스 코드를 수정하세요.

  테스트 파일을 먼저 생성하세요:
EOF
    # 언어별 테스트 경로 안내
    case "$EXT" in
        py)  echo "    → tests/test_${NAME_NO_EXT}.py" ;;
        ts|tsx|js|jsx) echo "    → ${DIRNAME}/__tests__/${NAME_NO_EXT}.test.${EXT}" ;;
        go)  echo "    → ${DIRNAME}/${NAME_NO_EXT}_test.go" ;;
        rs)  echo "    → tests/${NAME_NO_EXT}.rs" ;;
        java|kt) echo "    → $(echo "$REL_PATH" | sed 's|src/main/|src/test/|' | sed "s|\.${EXT}$|Test.${EXT}|")" ;;
    esac
    echo ""
    echo "  /tdd-cycle 커맨드로 Red-Green-Refactor 사이클을 시작할 수 있습니다."
    echo "  단순 1-2줄 수정이면 사유를 명시하고 진행하세요."
    harness_log_event "tdd-guard" "BLOCK" "PreToolUse" "테스트 파일 미존재" "" "$REL_PATH"
    exit 1
else
    cat <<EOF
[TDD GUARD] 테스트 파일이 없습니다 (Speed Mode — 경고만 표시).

  소스 파일: ${REL_PATH}
  권장: 작업 완료 후 테스트를 추가하세요.
EOF
    harness_log_event "tdd-guard" "WARN" "PreToolUse" "Speed Mode" "" "$REL_PATH"
    exit 0
fi
