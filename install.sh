#!/bin/bash
set -euo pipefail

# carpdm-harness 설치 스크립트
# 사용법: curl -fsSL https://raw.githubusercontent.com/skdkfk8758/carpdm_harness/main/install.sh | bash

REPO="skdkfk8758/carpdm_harness"
INSTALL_DIR="$HOME/.claude/plugins/carpdm-harness"
MIN_NODE_VERSION=18

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

# ─── 의존성 확인 ───

check_command() {
    command -v "$1" >/dev/null 2>&1 || error "$1이 설치되어 있지 않습니다. 먼저 설치해 주세요."
}

check_node_version() {
    local node_version
    node_version=$(node -v | sed 's/^v//' | cut -d. -f1)
    if [ "$node_version" -lt "$MIN_NODE_VERSION" ]; then
        error "Node.js >= $MIN_NODE_VERSION 필요 (현재: v$(node -v | sed 's/^v//'))"
    fi
}

info "의존성 확인 중..."
check_command "node"
check_command "npm"
check_command "git"
check_node_version
ok "의존성 확인 완료 (node $(node -v), npm $(npm -v), git $(git --version | cut -d' ' -f3))"

# ─── 기존 설치 확인 ───

if [ -d "$INSTALL_DIR" ]; then
    warn "기존 설치가 감지되었습니다: $INSTALL_DIR"
    info "업데이트하려면 Claude 대화에서 harness_update(updatePlugin: true)를 사용하세요."
    info "재설치하려면 먼저 기존 디렉토리를 삭제하세요: rm -rf $INSTALL_DIR"
    exit 0
fi

# ─── 설치 디렉토리 생성 ───

info "설치 디렉토리 생성 중..."
mkdir -p "$(dirname "$INSTALL_DIR")"

# ─── 최신 태그 조회 ───

info "최신 릴리스 확인 중..."
LATEST_TAG=$(git ls-remote --tags --sort=-v:refname "https://github.com/$REPO.git" 'v*.*.*' 2>/dev/null \
    | head -1 \
    | sed 's/.*refs\/tags\///' \
    | sed 's/\^{}//')

if [ -z "$LATEST_TAG" ]; then
    warn "릴리스 태그를 찾을 수 없습니다. main 브랜치에서 설치합니다."
    LATEST_TAG="main"
    VERSION="dev"
else
    VERSION="${LATEST_TAG#v}"
    ok "최신 릴리스: $LATEST_TAG"
fi

# ─── Clone ───

info "저장소 클론 중... ($LATEST_TAG)"
if [ "$LATEST_TAG" = "main" ]; then
    git clone --depth 1 "https://github.com/$REPO.git" "$INSTALL_DIR" 2>/dev/null
else
    git clone --depth 1 --branch "$LATEST_TAG" "https://github.com/$REPO.git" "$INSTALL_DIR" 2>/dev/null
fi
ok "클론 완료"

# ─── 빌드 ───

info "의존성 설치 중..."
cd "$INSTALL_DIR"
npm install --production 2>/dev/null
ok "의존성 설치 완료"

info "빌드 중..."
npm run build 2>/dev/null
ok "빌드 완료"

# ─── MCP 서버 등록 ───

info "Claude Code MCP 서버 등록 중..."
if command -v claude >/dev/null 2>&1; then
    claude mcp add carpdm-harness -- node "$INSTALL_DIR/dist/server.js" 2>/dev/null && \
        ok "MCP 서버 등록 완료" || \
        warn "MCP 서버 자동 등록 실패. 수동 등록이 필요합니다."
else
    warn "claude CLI를 찾을 수 없습니다. MCP 서버를 수동으로 등록해 주세요."
fi

# ─── 결과 출력 ───

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  carpdm-harness 설치 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  버전:    ${BLUE}v${VERSION}${NC}"
echo -e "  경로:    ${BLUE}${INSTALL_DIR}${NC}"
echo -e "  서버:    ${BLUE}${INSTALL_DIR}/dist/server.js${NC}"
echo ""
echo -e "  ${YELLOW}다음 단계:${NC}"
echo -e "  1. Claude Code를 열고 대화를 시작하세요"
echo -e "  2. harness_init(projectRoot: \"/your/project\") 실행"
echo -e "  3. /workflow-guide 로 워크플로우 가이드 확인"
echo ""
echo -e "  ${YELLOW}수동 MCP 등록 (자동 등록 실패 시):${NC}"
echo -e "  claude mcp add carpdm-harness -- node ${INSTALL_DIR}/dist/server.js"
echo ""
