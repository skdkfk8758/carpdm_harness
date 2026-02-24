#!/bin/bash
# Hook: PostToolUse - Secret Filter
# 도구 실행 결과에서 시크릿 패턴을 감지하여 경고를 출력합니다.
# 항상 exit 0 (차단하지 않음, 경고만)

INPUT=$(cat)

# Worktree-aware: CLAUDE_CWD → git worktree root → pwd
CWD="${CLAUDE_CWD:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$CWD" 2>/dev/null || exit 0

# tool_result에서 텍스트 콘텐츠 추출 후 시크릿 패턴 감지
echo "$INPUT" | python3 -c "
import sys, json, re

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

# tool_result 추출 (문자열, 배열, 딕셔너리 모두 처리)
result = data.get('tool_result', '')
if isinstance(result, list):
    # MCP 스타일: [{\"type\": \"text\", \"text\": \"...\"}]
    text = ' '.join(
        item.get('text', '') if isinstance(item, dict) else str(item)
        for item in result
    )
elif isinstance(result, dict):
    text = result.get('content', result.get('text', str(result)))
else:
    text = str(result)

# 시크릿 패턴 정의 (패턴명, 정규식)
patterns = [
    ('OpenAI API Key',      r'sk-[A-Za-z0-9]{20,}'),
    ('AWS Access Key',      r'AKIA[0-9A-Z]{16}'),
    ('GitHub PAT (ghp_)',   r'ghp_[A-Za-z0-9]{36}'),
    ('GitHub PAT (ghs_)',   r'ghs_[A-Za-z0-9]{36}'),
    ('Slack Bot Token',     r'xoxb-[0-9A-Za-z\-]{40,}'),
    ('Slack User Token',    r'xoxp-[0-9A-Za-z\-]{40,}'),
    ('Bearer Token',        r'[Bb]earer\s+[A-Za-z0-9\-_\.]{20,}'),
    ('Private Key Block',   r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
    ('PASSWORD 환경변수',    r'PASSWORD\s*=\s*\S+'),
    ('SECRET 환경변수',      r'SECRET\s*=\s*\S+'),
    ('TOKEN 환경변수',       r'TOKEN\s*=\s*\S+'),
    ('API_KEY 환경변수',     r'API_KEY\s*=\s*\S+'),
]

found = []
for name, pattern in patterns:
    if re.search(pattern, text):
        found.append(name)

for secret_type in found:
    print(f'[Security] 시크릿 패턴 감지: {secret_type}. 커밋 전 확인하세요.', file=sys.stderr)
" 2>&1

exit 0
