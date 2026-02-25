#!/bin/bash
set -euo pipefail

# carpdm-harness Skill 스캐폴드 스크립트
# 사용법: bash scripts/create-skill.sh <skill-name> <description> [tool-name]
#
# 예시:
#   bash scripts/create-skill.sh quality-check "TRUST 5 품질 게이트 실행" harness_quality_check
#   bash scripts/create-skill.sh my-skill "새로운 기능 설명"
#
# 동작:
#   1. skills/<skill-name>/SKILL.md 생성
#   2. 대응하는 MCP 도구가 있으면 도구 호출 템플릿 포함
#   3. 기존 skill이 있으면 덮어쓰기 방지

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/skills"

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

# ─── 인자 검증 ───

if [ $# -lt 2 ]; then
    echo ""
    echo "사용법: bash scripts/create-skill.sh <skill-name> <description> [tool-name]"
    echo ""
    echo "인자:"
    echo "  skill-name    Skill 이름 (kebab-case, 예: quality-check)"
    echo "  description   Skill 설명 (한국어 권장)"
    echo "  tool-name     대응하는 MCP 도구 이름 (선택, 예: harness_quality_check)"
    echo ""
    echo "예시:"
    echo "  bash scripts/create-skill.sh quality-check \"TRUST 5 품질 게이트 실행\" harness_quality_check"
    echo "  bash scripts/create-skill.sh my-composite \"복합 워크플로우\""
    echo ""
    echo "현재 등록된 skills:"
    for dir in "$SKILLS_DIR"/*/; do
        [ -d "$dir" ] && echo "  - $(basename "$dir")"
    done
    echo ""
    exit 1
fi

SKILL_NAME="$1"
DESCRIPTION="$2"
TOOL_NAME="${3:-}"

SKILL_DIR="$SKILLS_DIR/$SKILL_NAME"
SKILL_FILE="$SKILL_DIR/SKILL.md"

# ─── 검증 ───

# kebab-case 확인
if [[ ! "$SKILL_NAME" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]]; then
    error "Skill 이름은 kebab-case여야 합니다 (예: quality-check, my-skill)"
fi

# 중복 확인
if [ -f "$SKILL_FILE" ]; then
    error "이미 존재하는 skill입니다: $SKILL_NAME ($SKILL_FILE)"
fi

# 도구 존재 확인 (선택)
if [ -n "$TOOL_NAME" ]; then
    TOOL_FILE="$PROJECT_ROOT/src/tools/${SKILL_NAME}.ts"
    if [ ! -f "$TOOL_FILE" ]; then
        warn "대응하는 도구 파일이 없습니다: $TOOL_FILE"
        warn "도구 없이 복합(composite) skill로 생성합니다."
    fi
fi

# ─── SKILL.md 생성 ───

info "Skill 디렉토리 생성 중: $SKILL_DIR"
mkdir -p "$SKILL_DIR"

if [ -n "$TOOL_NAME" ]; then
    # MCP 도구가 있는 skill 템플릿
    cat > "$SKILL_FILE" << EOF
---
name: $SKILL_NAME
description: $DESCRIPTION
---

현재 프로젝트 루트를 감지하고 \`$TOOL_NAME\` MCP 도구를 호출하세요.

## 인자 매핑
- (인자 매핑 규칙을 작성하세요)

## 실행
\`\`\`tool
$TOOL_NAME({ projectRoot: "<감지된 프로젝트 루트>" })
\`\`\`

## 후속 안내
- (실행 후 안내 사항을 작성하세요)
EOF
else
    # 복합(composite) skill 템플릿
    cat > "$SKILL_FILE" << EOF
---
name: $SKILL_NAME
description: $DESCRIPTION
---

(이 skill의 동작을 설명하세요)

## 워크플로우
1. (단계를 작성하세요)

## 주의사항
- (주의사항을 작성하세요)
EOF
fi

ok "Skill 생성 완료: $SKILL_FILE"

# ─── 결과 출력 ───

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Skill 생성 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  이름:     ${BLUE}$SKILL_NAME${NC}"
echo -e "  경로:     ${BLUE}$SKILL_FILE${NC}"
echo -e "  도구:     ${BLUE}${TOOL_NAME:-없음 (composite)}${NC}"
echo -e "  커맨드:   ${BLUE}/carpdm-harness:$SKILL_NAME${NC}"
echo ""
echo -e "  ${YELLOW}다음 단계:${NC}"
echo -e "  1. $SKILL_FILE 내용을 편집하세요"
echo -e "  2. 플러그인을 다시 빌드하세요: npm run build"
echo -e "  3. 플러그인을 업데이트하세요: claude plugin update carpdm-harness"
echo ""

# ─── 현재 상태 요약 ───

SKILL_COUNT=$(find "$SKILLS_DIR" -name "SKILL.md" | wc -l | tr -d ' ')
TOOL_COUNT=$(find "$PROJECT_ROOT/src/tools" -name "*.ts" ! -name "index.ts" | wc -l | tr -d ' ')

info "현재 상태: skills ${SKILL_COUNT}개 / tools ${TOOL_COUNT}개"

# 누락 확인
MISSING=""
for tool_file in "$PROJECT_ROOT"/src/tools/*.ts; do
    [ "$(basename "$tool_file")" = "index.ts" ] && continue
    tool_base="$(basename "$tool_file" .ts)"
    if [ ! -d "$SKILLS_DIR/$tool_base" ]; then
        MISSING="$MISSING $tool_base"
    fi
done

if [ -n "$MISSING" ]; then
    warn "Skill이 없는 도구:$MISSING"
fi
