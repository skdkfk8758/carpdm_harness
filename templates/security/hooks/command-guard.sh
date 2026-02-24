#!/bin/bash
# Hook: PreToolUse (Bash) - Command Guard
# 위험한 Bash 명령을 차단합니다.
# 차단 시: stderr로 BLOCKED 메시지 + exit 2
# 허용 시: exit 0

INPUT=$(cat)

# Worktree-aware: CLAUDE_CWD → git worktree root → pwd
CWD="${CLAUDE_CWD:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$CWD" 2>/dev/null || exit 0

# tool_input.command 추출 및 위험 패턴 검사
RESULT=$(echo "$INPUT" | python3 -c "
import sys, json, re

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

cmd = data.get('tool_input', {}).get('command', '')
if not cmd:
    sys.exit(0)

# 차단 규칙 정의: (카테고리명, 패턴 목록, localhost 예외 적용 여부)
# localhost 예외: True인 경우 localhost/127.0.0.1 대상이면 허용
rules = [
    # 1. 파괴적 삭제
    ('파괴적 삭제', [
        r'rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+/',
        r'rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+~',
        r'rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+\*',
        r'\bmkfs\b',
        r'dd\s+.*of=/dev/',
    ], False),
    # 2. 시크릿 유출
    ('시크릿 유출', [
        r'^\s*(env|printenv)\s*$',
        r'echo\s+\$\w*KEY\w*',
        r'echo\s+\$\w*SECRET\w*',
        r'echo\s+\$\w*TOKEN\w*',
        r'cat\s+\.env\b',
        r'cat\s+.*\.env(\.[a-z]+)?\b',
        r'cat\s+.*\.ssh/',
    ], False),
    # 3. 경로 순회
    ('경로 순회', [
        r'/etc/passwd',
        r'/etc/shadow',
        r'/proc/self/',
    ], False),
    # 4. 외부 통신 (localhost/127.0.0.1 대상은 허용)
    ('외부 통신', [
        r'\bcurl\b',
        r'\bwget\b',
        r'\bnc\b',
        r'\bssh\b',
        r'\bscp\b',
    ], True),
    # 5. 권한 변경
    ('권한 변경', [
        r'chmod\s+777',
        r'\bchown\b',
        r'\bsudo\b',
        r'\bmount\b',
    ], False),
    # 6. 프로세스 종료
    ('프로세스 종료', [
        r'kill\s+-9',
        r'\bkillall\b',
        r'\bpkill\b',
        r'\bshutdown\b',
        r'\breboot\b',
    ], False),
    # 7. 명령 주입
    ('명령 주입', [
        r'\beval\b',
        r'\bexec\b',
        r'\|\s*sh\b',
        r'\|\s*bash\b',
        r'base64\s+-d\s*\|\s*sh',
        r'base64\s+--decode\s*\|\s*sh',
        r'base64\s+-d\s*\|\s*bash',
        r'base64\s+--decode\s*\|\s*bash',
    ], False),
]

# localhost 패턴 (외부 통신 예외 조건)
localhost_pattern = re.compile(r'(localhost|127\.0\.0\.1|::1)')

for category, patterns, allow_localhost in rules:
    for pattern in patterns:
        if re.search(pattern, cmd, re.IGNORECASE):
            # localhost 예외 처리
            if allow_localhost and localhost_pattern.search(cmd):
                continue
            print(f'BLOCKED:{category}:{pattern}')
            sys.exit(2)

sys.exit(0)
" 2>/dev/null)

EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ] || echo "$RESULT" | grep -q "^BLOCKED:"; then
    # RESULT에서 차단 정보 파싱
    BLOCK_INFO=$(echo "$RESULT" | grep "^BLOCKED:" | head -1)
    CATEGORY=$(echo "$BLOCK_INFO" | cut -d: -f2)
    PATTERN=$(echo "$BLOCK_INFO" | cut -d: -f3-)
    echo "BLOCKED: 위험한 명령 차단 — 카테고리: ${CATEGORY:-알 수 없음} (패턴: ${PATTERN:-알 수 없음})" >&2
    exit 2
fi

exit 0
