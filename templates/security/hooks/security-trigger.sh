#!/bin/bash
# Hook: PostToolUse (Edit|Write) - Security Trigger
# 보안 민감 파일 수정 시 경고를 출력합니다.
# 세션당 같은 파일에 대해 1회만 경고합니다.
# 항상 exit 0 (차단하지 않음, 경고만)

INPUT=$(cat)

# Worktree-aware: CLAUDE_CWD → git worktree root → pwd
CWD="${CLAUDE_CWD:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$CWD" 2>/dev/null || exit 0

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

# 파일 경로가 없으면 종료
[ -z "$FILE_PATH" ] && exit 0

# 파일명만 추출 (패턴 매칭용)
FILE_BASENAME=$(basename "$FILE_PATH")
FILE_LOWER=$(echo "$FILE_PATH" | tr '[:upper:]' '[:lower:]')

# 보안 민감 파일 패턴 목록
python3 -c "
import sys, re

file_path = '''$FILE_LOWER'''
file_base = '''$FILE_BASENAME'''

# 보안 민감 파일 패턴 (패턴명, 정규식)
patterns = [
    ('인증',        r'auth'),
    ('로그인',      r'login'),
    ('세션',        r'session'),
    ('토큰',        r'token'),
    ('JWT',         r'jwt'),
    ('OAuth',       r'oauth'),
    ('자격증명',    r'credential'),
    ('권한',        r'permission'),
    ('미들웨어',    r'middleware'),
    ('환경변수',    r'\.env(\.|$)'),
    ('보안',        r'security'),
    ('RLS',         r'rls'),
    ('정책',        r'policy'),
    ('마이그레이션', r'migration'),
    ('라우트',      r'route\.(ts|js|tsx|jsx)$'),
    ('API',         r'api/'),
    ('암호화',      r'encrypt'),
    ('복호화',      r'decrypt'),
    ('해시',        r'hash'),
    ('암호',        r'crypto'),
]

matched_patterns = []
for name, pattern in patterns:
    if re.search(pattern, file_path, re.IGNORECASE):
        matched_patterns.append(name)

if matched_patterns:
    print('MATCHED:' + ','.join(matched_patterns))
else:
    print('NO_MATCH')
" 2>/dev/null | {
    read MATCH_RESULT
    if [ "$MATCH_RESULT" = "NO_MATCH" ] || [ -z "$MATCH_RESULT" ]; then
        exit 0
    fi

    # 매칭된 패턴 추출
    MATCHED_PATTERNS="${MATCH_RESULT#MATCHED:}"

    # 세션당 중복 경고 방지 — 마커 파일 기반
    MARKER_DIR="/tmp/security-suggest"
    mkdir -p "$MARKER_DIR" 2>/dev/null

    # 파일 경로에서 안전한 마커 파일명 생성 (슬래시 → 언더스코어)
    SAFE_PATH=$(echo "$FILE_PATH" | tr '/' '_' | tr ' ' '_')
    MARKER_FILE="${MARKER_DIR}/${SAFE_PATH}"

    # 이미 경고한 파일이면 건너뜀
    if [ -f "$MARKER_FILE" ]; then
        exit 0
    fi

    # 마커 파일 생성 (이후 동일 파일 경고 억제)
    touch "$MARKER_FILE" 2>/dev/null

    # 경고 출력
    echo "[Security] 보안 관련 파일 수정 감지: ${FILE_BASENAME} (패턴: ${MATCHED_PATTERNS}). 커밋 전 보안 검토를 권장합니다." >&2
}

# === 누적 보안 변경 감지 → security-audit 자동 권장 ===
SECURITY_MARKER_DIR="/tmp/security-suggest"
if [ -d "$SECURITY_MARKER_DIR" ]; then
    SECURITY_COUNT=$(ls -1 "$SECURITY_MARKER_DIR" 2>/dev/null | wc -l | tr -d ' ')
    # 정확히 3개째에서만 트리거 (매번 반복 방지)
    if [ "${SECURITY_COUNT}" -eq 3 ]; then
        echo "[Security] 보안 관련 파일이 ${SECURITY_COUNT}개 이상 수정되었습니다." >&2
        echo "  /security-audit를 실행하여 보안 취약점을 종합 점검하세요." >&2
        echo "  (OWASP Top 10 + 시크릿 스캔 + 의존성 점검)" >&2
    fi
fi

exit 0
