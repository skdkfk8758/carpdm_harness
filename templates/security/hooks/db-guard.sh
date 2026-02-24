#!/bin/bash
# Hook: PreToolUse (mcp__*sql*|mcp__*supabase*|mcp__*db*) - DB Guard
# 위험한 SQL 패턴을 감지하여 차단합니다.
# 차단 시: stderr로 BLOCKED 메시지 + exit 2
# 허용 시: exit 0

INPUT=$(cat)

# Worktree-aware: CLAUDE_CWD → git worktree root → pwd
CWD="${CLAUDE_CWD:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$CWD" 2>/dev/null || exit 0

# tool_input에서 SQL 쿼리 추출 (query / sql / statements 필드 모두 시도)
SQL_QUERY=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    inp = data.get('tool_input', {})
    # query, sql, statements 순으로 시도
    query = inp.get('query', inp.get('sql', inp.get('statements', '')))
    if isinstance(query, list):
        query = ' '.join(str(q) for q in query)
    print(query)
except:
    print('')
" 2>/dev/null)

# SQL이 없으면 허용
if [ -z "$SQL_QUERY" ]; then
    exit 0
fi

# 대소문자 통일 (grep -i 사용)
# 차단 패턴 검사

# 1. DROP TABLE / DATABASE / SCHEMA
if echo "$SQL_QUERY" | grep -iqE 'DROP\s+(TABLE|DATABASE|SCHEMA)\s+'; then
    MATCHED=$(echo "$SQL_QUERY" | grep -ioE 'DROP\s+(TABLE|DATABASE|SCHEMA)\s+\S+' | head -1)
    echo "BLOCKED: 위험한 SQL 패턴 차단 — DROP 구문 감지: ${MATCHED}" >&2
    exit 2
fi

# 2. TRUNCATE
if echo "$SQL_QUERY" | grep -iqE '\bTRUNCATE\b'; then
    MATCHED=$(echo "$SQL_QUERY" | grep -ioE 'TRUNCATE\s+\S*' | head -1)
    echo "BLOCKED: 위험한 SQL 패턴 차단 — TRUNCATE 구문 감지: ${MATCHED}" >&2
    exit 2
fi

# 3. DELETE FROM ... (WHERE 절 없음)
# DELETE가 있지만 WHERE가 없는 경우 차단
if echo "$SQL_QUERY" | grep -iqE '\bDELETE\s+FROM\b'; then
    if ! echo "$SQL_QUERY" | grep -iqE '\bWHERE\b'; then
        MATCHED=$(echo "$SQL_QUERY" | grep -ioE 'DELETE\s+FROM\s+\S+' | head -1)
        echo "BLOCKED: 위험한 SQL 패턴 차단 — WHERE 절 없는 DELETE 감지: ${MATCHED}" >&2
        exit 2
    fi
fi

# 4. ALTER TABLE ... DROP (컬럼/제약조건 삭제)
if echo "$SQL_QUERY" | grep -iqE 'ALTER\s+TABLE\s+.*DROP\b'; then
    MATCHED=$(echo "$SQL_QUERY" | grep -ioE 'ALTER\s+TABLE\s+\S+\s+DROP\s+\S+' | head -1)
    echo "BLOCKED: 위험한 SQL 패턴 차단 — ALTER TABLE DROP 감지: ${MATCHED}" >&2
    exit 2
fi

exit 0
