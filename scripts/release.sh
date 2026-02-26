#!/bin/bash
set -euo pipefail

# carpdm-harness 릴리스 자동화 스크립트
# 사용법: bash scripts/release.sh [patch|minor|major]
#
# 동작:
#   1. clean working tree + main 브랜치 확인
#   2. npm version (package.json + git tag)
#   3. .claude-plugin/plugin.json 버전 동기화
#   4. git commit + push + GitHub Release 생성

BUMP_TYPE="${1:-patch}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_JSON="$PROJECT_ROOT/.claude-plugin/plugin.json"
MARKETPLACE_JSON="$PROJECT_ROOT/.claude-plugin/marketplace.json"
SERVER_TS="$PROJECT_ROOT/src/server.ts"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ─── 사전 검증 ───

# bump type 확인
case "$BUMP_TYPE" in
    patch|minor|major) ;;
    *) error "유효하지 않은 bump type: $BUMP_TYPE (patch|minor|major 중 선택)" ;;
esac

# 프로젝트 루트로 이동
cd "$PROJECT_ROOT"

# clean working tree 확인
if [ -n "$(git status --porcelain)" ]; then
    error "작업 트리가 clean하지 않습니다. 변경사항을 먼저 커밋하거나 stash하세요."
fi

# main 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    error "main 브랜치에서만 릴리스할 수 있습니다. (현재: $CURRENT_BRANCH)"
fi

# 원격과 동기화 확인
info "원격 저장소와 동기화 확인 중..."
git fetch origin main --tags
LOCAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse origin/main)
if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
    error "로컬과 원격이 동기화되지 않았습니다. git pull을 먼저 실행하세요."
fi

# gh CLI 확인
if ! command -v gh >/dev/null 2>&1; then
    error "gh (GitHub CLI)가 설치되어 있지 않습니다. https://cli.github.com 참조"
fi

# ─── 현재 버전 확인 ───

CURRENT_VERSION=$(node -p "require('./package.json').version")
info "현재 버전: v$CURRENT_VERSION"
info "Bump type: $BUMP_TYPE"

# ─── npm version (package.json + git tag) ───

info "버전 bump 실행 중..."
NEW_VERSION=$(npm version "$BUMP_TYPE" --no-git-tag-version | sed 's/^v//')
ok "package.json 버전 업데이트: v$CURRENT_VERSION → v$NEW_VERSION"

# ─── plugin.json 버전 동기화 ───

if [ -f "$PLUGIN_JSON" ]; then
    info "plugin.json 버전 동기화 중..."
    # node를 사용하여 JSON 안전하게 수정
    node -e "
        const fs = require('fs');
        const path = '$PLUGIN_JSON';
        const pkg = JSON.parse(fs.readFileSync(path, 'utf-8'));
        pkg.version = '$NEW_VERSION';
        fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
    "
    ok "plugin.json 동기화 완료: v$NEW_VERSION"
else
    warn "plugin.json을 찾을 수 없습니다: $PLUGIN_JSON"
fi

# ─── marketplace.json 버전 동기화 ───

if [ -f "$MARKETPLACE_JSON" ]; then
    info "marketplace.json 버전 동기화 중..."
    node -e "
        const fs = require('fs');
        const path = '$MARKETPLACE_JSON';
        const pkg = JSON.parse(fs.readFileSync(path, 'utf-8'));
        if (pkg.plugins && pkg.plugins.length > 0) {
            pkg.plugins[0].version = '$NEW_VERSION';
        }
        fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
    "
    ok "marketplace.json 동기화 완료: v$NEW_VERSION"
else
    warn "marketplace.json을 찾을 수 없습니다: $MARKETPLACE_JSON"
fi

# ─── src/server.ts 버전 동기화 ───

if [ -f "$SERVER_TS" ]; then
    info "src/server.ts 버전 동기화 중..."
    sed -i.bak "s/version: '[0-9]*\.[0-9]*\.[0-9]*'/version: '$NEW_VERSION'/" "$SERVER_TS"
    rm -f "${SERVER_TS}.bak"
    ok "src/server.ts 동기화 완료: v$NEW_VERSION"
else
    warn "src/server.ts를 찾을 수 없습니다: $SERVER_TS"
fi

# ─── Git commit + tag ───

info "변경사항 커밋 중..."
git add package.json
[ -f "$PLUGIN_JSON" ] && git add "$PLUGIN_JSON"
[ -f "$MARKETPLACE_JSON" ] && git add "$MARKETPLACE_JSON"
[ -f "$SERVER_TS" ] && git add "$SERVER_TS"

git commit -m "$(cat <<EOF
chore(release): bump version to v$NEW_VERSION

버전 $CURRENT_VERSION → $NEW_VERSION ($BUMP_TYPE release)
- package.json 버전 업데이트
- plugin.json 버전 동기화
- marketplace.json 버전 동기화
- src/server.ts 버전 동기화
EOF
)"

git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
ok "커밋 + 태그 생성 완료: v$NEW_VERSION"

# ─── Push ───

info "원격 저장소에 push 중..."
git push origin main --tags
ok "push 완료"

# ─── GitHub Release ───

info "GitHub Release 생성 중..."
gh release create "v$NEW_VERSION" \
    --title "v$NEW_VERSION" \
    --generate-notes
ok "GitHub Release 생성 완료"

# ─── 결과 출력 ───

RELEASE_URL="https://github.com/skdkfk8758/carpdm_harness/releases/tag/v$NEW_VERSION"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  릴리스 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  이전 버전:  ${BLUE}v${CURRENT_VERSION}${NC}"
echo -e "  새 버전:    ${BLUE}v${NEW_VERSION}${NC}"
echo -e "  Bump type:  ${BLUE}${BUMP_TYPE}${NC}"
echo -e "  릴리스:     ${BLUE}${RELEASE_URL}${NC}"
echo ""
echo -e "  ${YELLOW}플러그인 업데이트:${NC}"
echo -e "  claude plugin update carpdm-harness@carpdm"
echo ""
