# Update All — 환경 전체 업데이트

설치된 플러그인, MCP 서버, CLI 도구, 스킬을 한 번에 최신 버전으로 업데이트한다.


## Argument: $ARGUMENTS
업데이트 옵션 (예: "전체", "cli만", "mcp만", "스킬만", "플러그인만", "dry-run")

## Instructions

### Phase 0: 현재 환경 스캔

업데이트 전 현재 설치 상태를 파악한다.

```bash
echo "=== 현재 환경 스캔 ==="

# 1. Claude Code 버전
echo "[Claude Code]"
claude --version 2>/dev/null || echo "미설치"

# 2. 글로벌 npm 패키지
echo ""
echo "[글로벌 npm 패키지]"
npm list -g --depth=0 2>/dev/null | grep -E "claude-code|codex|gemini"

# 3. oh-my-claudecode 플러그인
echo ""
echo "[OMC 플러그인]"
claude plugin list 2>/dev/null | grep -i "oh-my-claudecode" || echo "미설치"

# 4. MCP 서버 (프로젝트 레벨)
echo ""
echo "[MCP 서버]"
if [ -f ".mcp.json" ]; then
    cat .mcp.json | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    servers = data.get('mcpServers', {})
    for name in servers:
        print(f'  - {name}')
except:
    print('  파싱 실패')
" 2>/dev/null
else
    echo "  .mcp.json 없음"
fi

# 5. 설치된 스킬 (사용 가능한 커맨드)
echo ""
echo "[커스텀 커맨드]"
ls .claude/commands/*.md 2>/dev/null | while read f; do
    echo "  - $(basename "$f" .md)"
done
ls "$HOME/.claude/commands/"*.md 2>/dev/null | while read f; do
    echo "  - $(basename "$f" .md) (글로벌)"
done

# 6. 훅 파일
echo ""
echo "[훅]"
ls .claude/hooks/*.sh 2>/dev/null | while read f; do
    echo "  - $(basename "$f")"
done

# 7. CLI 도구
echo ""
echo "[교차 검증 CLI]"
command -v codex &>/dev/null && echo "  Codex: $(codex --version 2>/dev/null || echo 'installed')" || echo "  Codex: 미설치"
command -v gemini &>/dev/null && echo "  Gemini: $(gemini --version 2>/dev/null || echo 'installed')" || echo "  Gemini: 미설치"

# 8. carpdm-harness 플러그인
echo ""
echo "[carpdm-harness]"
# MCP 도구 등록 여부로 확인
if [ -f ".mcp.json" ]; then
    python3 -c "
import json
with open('.mcp.json') as f:
    data = json.load(f)
if 'carpdm-harness' in data.get('mcpServers', {}):
    print('  상태: 등록됨')
else:
    print('  상태: 미등록')
" 2>/dev/null
else
    echo "  상태: .mcp.json 없음"
fi
```

스캔 결과를 사용자에게 보여준다.

### Phase 1: 업데이트 대상 선택

`$ARGUMENTS`에 따라 업데이트 범위를 결정한다:

| 인자 | 업데이트 대상 |
|------|-------------|
| `전체` 또는 빈 값 | 아래 전부 |
| `cli만` | Codex CLI + Gemini CLI |
| `mcp만` | MCP 서버 (npx 패키지) |
| `스킬만` | 커스텀 커맨드 + 훅 |
| `플러그인만` | oh-my-claudecode |
| `harness만` | harness_update MCP 도구로 설치된 템플릿 업데이트 |
| `dry-run` | 업데이트 예정 항목만 표시, 실행 안 함 |

### Phase 2: 플러그인 업데이트

```bash
echo "=== Phase 2: 플러그인 업데이트 ==="

# oh-my-claudecode 업데이트
claude plugin update oh-my-claudecode 2>/dev/null && \
    echo "[OK] oh-my-claudecode 업데이트 완료" || \
    echo "[WARN] oh-my-claudecode 업데이트 실패 또는 미설치"

# carpdm-harness 업데이트
claude plugin update carpdm-harness@carpdm 2>/dev/null && \
    echo "[OK] carpdm-harness 업데이트 완료" || \
    echo "[WARN] carpdm-harness 업데이트 실패 또는 미설치"
```

### Phase 3: CLI 도구 업데이트

```bash
echo "=== Phase 3: CLI 업데이트 ==="

# Codex CLI
if command -v codex &>/dev/null; then
    npm update -g @openai/codex 2>/dev/null && \
        echo "[OK] Codex CLI 업데이트 완료" || \
        echo "[WARN] Codex CLI 업데이트 실패"
else
    echo "[SKIP] Codex CLI 미설치"
fi

# Gemini CLI
if command -v gemini &>/dev/null; then
    npm update -g @google/gemini-cli 2>/dev/null && \
        echo "[OK] Gemini CLI 업데이트 완료" || \
        echo "[WARN] Gemini CLI 업데이트 실패"
else
    echo "[SKIP] Gemini CLI 미설치"
fi

# Claude Code 자체
npm update -g @anthropic-ai/claude-code 2>/dev/null && \
    echo "[OK] Claude Code 업데이트 완료" || \
    echo "[WARN] Claude Code 업데이트 실패"
```

### Phase 4: MCP 서버 업데이트

MCP 서버는 `npx -y` 방식이므로 캐시를 정리하면 다음 실행 시 최신 버전을 가져온다.

```bash
echo "=== Phase 4: MCP 서버 캐시 갱신 ==="

# npx 캐시 중 MCP 관련 패키지 정리
npx clear-npx-cache 2>/dev/null || echo "[INFO] npx 캐시 수동 정리 필요"

# .mcp.json에 등록된 서버 목록 확인
if [ -f ".mcp.json" ]; then
    echo "[INFO] 등록된 MCP 서버:"
    python3 -c "
import json
with open('.mcp.json') as f:
    data = json.load(f)
for name, config in data.get('mcpServers', {}).items():
    args = config.get('args', [])
    pkg = next((a for a in args if '@' in a and not a.startswith('-')), 'unknown')
    print(f'  - {name}: {pkg}')
" 2>/dev/null
    echo "[OK] 다음 MCP 호출 시 최신 버전이 자동 적용됩니다"
else
    echo "[SKIP] .mcp.json 없음"
fi
```

### Phase 5: carpdm-harness 템플릿 업데이트

설치된 carpdm-harness 템플릿을 MCP 도구로 최신 버전으로 업데이트한다.

#### 5-1. 프로젝트 루트 감지

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

#### 5-2. harness_update MCP 도구 호출

carpdm-harness가 설치된 프로젝트인 경우:

```
harness_update(
  projectRoot: PROJECT_ROOT,
  acceptAll: true,
  refreshOntology: true
)
```

carpdm-harness가 설치되어 있지 않은 경우:
- `[SKIP] carpdm-harness 미설치 — /harness-init으로 먼저 설치하세요`

#### 5-3. 결과 확인

- 업데이트된 파일 수, 건너뛴 파일 수, 충돌 수를 보고
- 충돌이 있는 경우 사용자에게 수동 확인을 안내
- 사용자 수정 파일(USER_MODIFIED)은 자동으로 보호됨

**주의:** CLAUDE.md, docs/conventions.md 등 프로젝트별 커스터마이즈 파일은 harness_update가 자동으로 보호한다 (USER_MODIFIED 상태로 건너뜀).

### Phase 6: 업데이트 결과 보고

업데이트 전후 버전을 비교하여 보고한다:

```
=== 업데이트 결과 ===

| 항목 | 이전 | 이후 | 상태 |
|------|------|------|------|
| carpdm-harness | - | - | ✓ N개 파일 업데이트 |
| Claude Code | 1.x.x | 1.y.y | ✓ 업데이트됨 |
| oh-my-claudecode | 3.x.x | 4.x.x | ✓ 업데이트됨 |
| Codex CLI | 1.x.x | 1.y.y | ✓ 업데이트됨 |
| Gemini CLI | - | - | ─ 미설치 |
| MCP 서버 | (캐시 갱신) | - | ✓ 다음 실행 시 적용 |
| 커맨드/훅 | harness_update로 갱신 | - | ✓ 업데이트 완료 |

[주의] CLAUDE.md는 자동 업데이트하지 않았습니다 (USER_MODIFIED 상태로 보호됨).
```

## Rules
- CLAUDE.md, docs/conventions.md 등 프로젝트별 커스터마이즈 파일은 절대 덮어쓰지 않는다
- 업데이트 실패 시 이전 버전으로 롤백하지 않고 경고만 출력한다
- dry-run 모드에서는 어떤 변경도 실행하지 않는다
- 설치되지 않은 도구는 SKIP 처리한다 (강제 설치하지 않음)
- git 상태가 dirty한 경우 훅/커맨드 복사 전 경고한다
