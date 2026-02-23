#!/bin/bash
# Hook: UserPromptSubmit - Pre-task 자동 감지
# 매 사용자 요청마다 실행: 도메인 식별, plan-first 강제, 모드 감지, 현재 상태 출력

# stdin에서 사용자 입력 읽기 (있으면)
INPUT=$(cat 2>/dev/null || echo "")

# Worktree-aware: CLAUDE_CWD → git worktree root → pwd
CWD="${CLAUDE_CWD:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$CWD" 2>/dev/null || exit 0

# === Task Mode + Bug Mode 감지 ===
MODE="Standard"
MODE_DESC=""
IS_BUG_FIX=false

# 사용자 입력에서 키워드 감지
USER_TEXT=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('user_prompt', data.get('message', data.get('content', str(data)))))
except:
    print('')
" 2>/dev/null)

# Speed Mode 키워드
if echo "$USER_TEXT" | grep -qiE '프로토타입|빠르게|빨리|긴급|핫픽스|MVP|PoC|poc|mvp|prototype|quick|hotfix|urgent'; then
    MODE="Speed"
    MODE_DESC="Speed Mode: 동작 우선, plan 간소화, 에러 핸들링 최소화"
# Safety Mode 키워드
elif echo "$USER_TEXT" | grep -qiE '배포|운영|프로덕션|릴리스|deploy|production|release|신중|꼼꼼'; then
    MODE="Safety"
    MODE_DESC="Safety Mode: 보안/테스트/예외처리 극도로 엄격"
fi

# Bug Fix Mode 감지 (Autonomous Bug Fixing)
if echo "$USER_TEXT" | grep -qiE '버그|에러|오류|실패|안.?되|깨짐|크래시|bug|error|fail|broken|crash|500|404|exception|CI.*실패'; then
    IS_BUG_FIX=true
fi

# === 파일 경로 탐색 (.agent/ 우선, 루트 fallback) ===
PLAN_FILE=""
TODO_FILE=""
CTX_FILE=""
LESSONS_FILE=""
SESSION_LOG=""

if [ -f ".agent/plan.md" ]; then PLAN_FILE=".agent/plan.md"
elif [ -f "plan.md" ]; then PLAN_FILE="plan.md"; fi

if [ -f ".agent/todo.md" ]; then TODO_FILE=".agent/todo.md"
elif [ -f "todo.md" ]; then TODO_FILE="todo.md"; fi

if [ -f ".agent/context.md" ]; then CTX_FILE=".agent/context.md"
elif [ -f "context.md" ]; then CTX_FILE="context.md"; fi

if [ -f ".agent/lessons.md" ]; then LESSONS_FILE=".agent/lessons.md"
elif [ -f "lessons.md" ]; then LESSONS_FILE="lessons.md"; fi

if [ -f ".agent/session-log.md" ]; then SESSION_LOG=".agent/session-log.md"
elif [ -f "session-log.md" ]; then SESSION_LOG="session-log.md"; fi

# === plan.md 상태 확인 ===
PLAN_STATUS="NONE"
if [ -n "$PLAN_FILE" ]; then
    PLAN_STATUS=$(grep -oE 'DRAFT|APPROVED|IN_PROGRESS|COMPLETED' "$PLAN_FILE" 2>/dev/null | head -1)
    [ -z "$PLAN_STATUS" ] && PLAN_STATUS="EXISTS"
fi

# === todo.md 상태 확인 ===
TODO_STATUS=""
if [ -n "$TODO_FILE" ]; then
    DONE=$(grep -c '\[x\]' "$TODO_FILE" 2>/dev/null) || true; DONE=${DONE:-0}
    REMAINING=$(grep -c '\[ \]' "$TODO_FILE" 2>/dev/null) || true; REMAINING=${REMAINING:-0}
    TOTAL=$((DONE + REMAINING))
    CURRENT=$(grep -m1 '← CURRENT' "$TODO_FILE" 2>/dev/null | sed 's/.*\] //' | sed 's/ ← CURRENT//' | head -c 60)
    TODO_STATUS="[${DONE}/${TOTAL} done]"
    [ -n "$CURRENT" ] && TODO_STATUS="${TODO_STATUS} Current: ${CURRENT}"
fi

# === context.md 존재 확인 ===
CTX_EXISTS="no"
[ -n "$CTX_FILE" ] && CTX_EXISTS="yes"

# === lessons.md 상태 확인 (Self-Improvement Loop) ===
LESSONS_STATUS="NOT_FOUND"
LESSONS_COUNT=0
LESSONS_UPGRADE=""
if [ -n "$LESSONS_FILE" ]; then
    LESSONS_COUNT=$(grep -c '^- \*\*상황\*\*' "$LESSONS_FILE" 2>/dev/null) || true; LESSONS_COUNT=${LESSONS_COUNT:-0}
    LESSONS_STATUS="LOADED (${LESSONS_COUNT}개 규칙)"

    # (C) CLAUDE.md 승급 감지: 카테고리별 교훈 수 확인
    # 같은 카테고리에 3개 이상이면 CLAUDE.md 통합 권고
    for CATEGORY in "코딩 규칙" "아키텍처 규칙" "테스트 규칙" "비즈니스 도메인 규칙" "도구/환경 규칙"; do
        # 카테고리 헤딩 다음 줄부터 ~ 다음 ## 헤딩 전까지의 교훈 수 카운트
        CAT_COUNT=$(awk -v cat="$CATEGORY" 'BEGIN{f=0} $0 ~ "^## "cat"$"{f=1;next} f && /^## /{exit} f' "$LESSONS_FILE" 2>/dev/null | grep -c '^- \*\*상황\*\*') || true; CAT_COUNT=${CAT_COUNT:-0}
        if [ "$CAT_COUNT" -ge 3 ]; then
            LESSONS_UPGRADE="${LESSONS_UPGRADE}
  - \"${CATEGORY}\"에 ${CAT_COUNT}개 교훈 누적 → CLAUDE.md 통합 검토"
        fi
    done
fi

# === session-log.md 컨텍스트 복원 ===
SESSION_STATUS="NOT_FOUND"
LAST_SESSION_PREVIEW=""
if [ -n "$SESSION_LOG" ]; then
    SESSION_COUNT=$(grep -c '^## ' "$SESSION_LOG" 2>/dev/null) || true; SESSION_COUNT=${SESSION_COUNT:-0}
    SESSION_STATUS="LOADED (${SESSION_COUNT}개 세션)"
    # 마지막 세션 요약 추출 + Privacy 태그 필터링
    LAST_SESSION_PREVIEW=$(awk '/^## /{if(found) exit; found=1} found' "$SESSION_LOG" \
      | sed '/<!-- PRIVATE -->/,/<!-- \/PRIVATE -->/d' | head -15)
fi

# === TDD 상태 확인 ===
TDD_STATUS="DISABLED"
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
        TDD_STATUS="ENABLED"
        # 마지막 TDD 결과 확인
        if [ -f ".omc/state/tdd-result" ]; then
            TDD_LAST=$(grep -m1 'Target:' .omc/state/tdd-result 2>/dev/null | sed 's/.*Target: //' | head -c 40)
            TDD_PHASE=$(grep -E '^\| (RED|GREEN|REFACTOR)' .omc/state/tdd-result 2>/dev/null | tail -1 | awk -F'|' '{print $2}' | tr -d ' ')
            [ -n "$TDD_LAST" ] && TDD_STATUS="ENABLED (Last: ${TDD_LAST}, Phase: ${TDD_PHASE})"
        fi
    fi
fi

# Mode를 task-mode 파일에 기록 (tdd-guard.sh 연동)
mkdir -p ".omc/state" 2>/dev/null
echo "$MODE" > ".omc/state/task-mode"

# === 출력 ===
cat <<EOF
[OFFICE STANDARD] Plan-First + DDD + SPARC + Boris Cherny Workflow Active
- Mode: ${MODE} ${MODE_DESC:+— $MODE_DESC}
- plan.md: ${PLAN_STATUS}
- todo.md: ${TODO_STATUS:-NOT_FOUND}
- context.md: ${CTX_EXISTS}
- lessons.md: ${LESSONS_STATUS}
- session-log.md: ${SESSION_STATUS}
$([ -n "$LESSONS_UPGRADE" ] && echo "
[UPGRADE RECOMMENDED] lessons.md 교훈이 카테고리별 3개 이상 누적:${LESSONS_UPGRADE}
  → 반복 교훈은 CLAUDE.md AI Collaboration Standard에 통합하세요.
  → 통합 후 lessons.md에서 해당 항목을 '승급됨' 표시 또는 삭제")
- tdd: ${TDD_STATUS}
Workflow (SPARC): Spec → Pseudocode → Architecture → Refinement → Completion

Core Principles:
  Simplicity First — 작동하는 가장 단순한 구현이 최선 (200줄이 50줄로 가능하면 다시 작성)
  No Laziness — 임시방편 금지, 근본 원인 해결
  Minimal Impact — A를 고치려고 B, C, D까지 건드리지 않기
  Think Before Coding — 가정을 명시하고, 혼란스러우면 코딩 전에 멈추기
  Surgical Changes — 요청된 부분만 수정, 인접 코드 개선/리팩토링 금지

Rules:
1. 코드 전 .agent/plan.md 작성 + 승인 필수 (Speed Mode: 간소화 허용)
2. 도메인 식별 → docs/conventions.md + 해당 도메인 문서만 로드
3. Edge Case 2개 이상 먼저 언급 후 코드 작성
4. .agent/todo.md 실시간 갱신 (← CURRENT 마커) + Ubiquitous Language 준수
5. 기존 패턴 복제 (Pattern Copy)
6. 완료 시 "시니어 개발자가 리뷰해도 통과할 수준인가?" 자문
7. 비자명 코드 완성 후 "더 우아한 방법 없나?" 한 번 더 검토 (Demand Elegance)
8. 리서치/탐색은 서브에이전트에 위임 (컨텍스트 보존)
9. 완료 후 .agent/lessons.md에 배운 교훈 기록 (Self-Improvement Loop)
10. 가정이 있으면 명시, 해석이 여러 개면 대안 제시 후 확인 (Think Before Coding)
11. 요청된 코드만 수정 — 주변 코드 리팩토링/스타일 개선 금지 (Surgical Changes)
12. 작업을 검증 가능 목표로 변환: "Step → verify: 검증방법" (Goal-Driven Execution)
EOF

# === Bug Fix 자율 모드 안내 ===
if [ "$IS_BUG_FIX" = true ]; then
    cat <<EOF

[BUG MODE] 자율적 버그 수정 활성화 (Autonomous Bug Fixing)
  → 사용자에게 질문하지 말고 직접 로그/에러/코드를 추적하세요
  → 원인 파악 → 수정 → 테스트 실행까지 자율적으로 진행
  → 수정 완료 후에만 결과를 보고하세요
  → 사용자의 컨텍스트 전환을 최소화하는 것이 목표
EOF
fi

# === 세션 연속성 확인 (Task Management 강화) ===
if [ -n "$TODO_FILE" ]; then
    CURRENT_ITEM=$(grep -m1 '← CURRENT' "$TODO_FILE" 2>/dev/null | sed 's/.*\] //' | sed 's/ ← CURRENT//' | head -c 80)
    if [ -n "$CURRENT_ITEM" ]; then
        echo ""
        echo "[SESSION RESUME] 이전 작업 이어하기: ${CURRENT_ITEM}"
        echo "  ${TODO_FILE}에 ← CURRENT 마커가 있습니다. 이전 세션을 이어서 진행하세요."
    fi
fi

# === 이전 세션 컨텍스트 자동 주입 ===
if [ -n "$LAST_SESSION_PREVIEW" ]; then
    echo ""
    echo "[LAST SESSION] 이전 세션 요약 (<!-- PRIVATE --> 구간 제외):"
    echo "$LAST_SESSION_PREVIEW"
fi
exit 0
