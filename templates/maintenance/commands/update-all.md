# Update All — 환경 전체 업데이트

설치된 플러그인, MCP 서버, CLI 도구, 스킬을 한 번에 최신 버전으로 업데이트한다.

> **Shell 대안**: Claude Code 밖에서 업데이트하려면 `bash install.sh --update` 사용.
> 프로젝트 템플릿까지 배포하려면 `bash install.sh --update --project /path/to/project`.

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

# 8. agent_harness 레포
echo ""
echo "[agent_harness]"
for dir in "$HOME/Workspace/Github/agent_harness" "$HOME/agent_harness"; do
    if [ -d "$dir" ]; then
        echo "  경로: $dir"
        echo "  브랜치: $(git -C "$dir" branch --show-current 2>/dev/null)"
        echo "  최근 커밋: $(git -C "$dir" log -1 --format='%h %s (%cr)' 2>/dev/null)"
        break
    fi
done
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
| `harness만` | agent_harness 레포 pull + 템플릿 배포 (`bash install.sh --update --project .` 동등) |
| `dry-run` | 업데이트 예정 항목만 표시, 실행 안 함 |

### Phase 2: 플러그인 업데이트

```bash
echo "=== Phase 2: 플러그인 업데이트 ==="

# oh-my-claudecode 업데이트
claude plugin update oh-my-claudecode 2>/dev/null && \
    echo "[OK] oh-my-claudecode 업데이트 완료" || \
    echo "[WARN] oh-my-claudecode 업데이트 실패 또는 미설치"
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

### Phase 5: agent_harness 레포 업데이트 + 템플릿 배포

agent_harness 레포 자체를 최신화하고, 최신 템플릿을 현재 프로젝트에 배포한다.

> **참고**: `bash install.sh --update --project $(pwd)` 명령으로 Phase 5 전체를 한 번에 실행할 수 있다.
> 이 경우 git pull, 글로벌 커맨드, 프로젝트 커맨드/훅/문서가 자동 배포된다.

```bash
echo "=== Phase 5: agent_harness + 커맨드 + 훅 업데이트 ==="

# agent_harness 레포 위치 감지
HARNESS_DIR=""
for dir in "$HOME/Workspace/Github/agent_harness" "$HOME/agent_harness"; do
    if [ -d "$dir" ]; then
        HARNESS_DIR="$dir"
        break
    fi
done
```

**agent_harness 레포가 감지된 경우:**

**5-1. agent_harness 레포 자체 최신화:**
```bash
echo "[agent_harness] 레포 업데이트 중..."
cd "$HARNESS_DIR"
BEFORE_SHA=$(git rev-parse HEAD)
git fetch origin
git pull --rebase origin $(git branch --show-current) 2>/dev/null || git pull origin $(git branch --show-current)
AFTER_SHA=$(git rev-parse HEAD)
if [ "$BEFORE_SHA" != "$AFTER_SHA" ]; then
    echo "[OK] agent_harness 업데이트됨: $(git log --oneline ${BEFORE_SHA}..${AFTER_SHA} | wc -l | tr -d ' ')개 커밋"
    git log --oneline ${BEFORE_SHA}..${AFTER_SHA}
else
    echo "[OK] agent_harness 이미 최신"
fi
cd -
```

**5-2. 글로벌 커맨드 갱신:**
   - `cp "$HARNESS_DIR/project-setup.md" "$HOME/.claude/commands/"`
   - `cp "$HARNESS_DIR/project-setup-simple.md" "$HOME/.claude/commands/"`
   - `cp "$HARNESS_DIR/project-init.md" "$HOME/.claude/commands/"`

**5-3. 프로젝트 커맨드 갱신 (현재 프로젝트):**
   - `cp "$HARNESS_DIR/templates/.claude/commands/"*.md .claude/commands/`

**5-4. 훅 갱신:**
   - `cp "$HARNESS_DIR/templates/.claude/hooks/"*.sh .claude/hooks/`

**5-5. 문서 템플릿 갱신:**
   - `cp "$HARNESS_DIR/templates/docs/templates/"*.md docs/templates/`

**agent_harness 레포가 없는 경우:**
- 사용자에게 경로를 질문하거나, 수동 업데이트 가이드 제공

**주의:** CLAUDE.md는 프로젝트별 커스터마이즈가 있으므로 **절대 덮어쓰지 않는다.**

### Phase 6: 업데이트 결과 보고

업데이트 전후 버전을 비교하여 보고한다:

```
=== 업데이트 결과 ===

| 항목 | 이전 | 이후 | 상태 |
|------|------|------|------|
| agent_harness | abc1234 | def5678 | ✓ N개 커밋 업데이트 |
| Claude Code | 1.x.x | 1.y.y | ✓ 업데이트됨 |
| oh-my-claudecode | 3.x.x | 4.x.x | ✓ 업데이트됨 |
| Codex CLI | 1.x.x | 1.y.y | ✓ 업데이트됨 |
| Gemini CLI | - | - | ─ 미설치 |
| MCP 서버 | (캐시 갱신) | - | ✓ 다음 실행 시 적용 |
| 커맨드 (7개) | 갱신됨 | - | ✓ 복사 완료 |
| 훅 (4개) | 갱신됨 | - | ✓ 복사 완료 |

[주의] CLAUDE.md는 자동 업데이트하지 않았습니다.
새 섹션이 있는지 확인하려면: diff <(grep '^## ' CLAUDE.md) <(grep '^## ' /path/to/agent_harness/templates/CLAUDE-sections.md)
```

## Rules
- CLAUDE.md, docs/conventions.md 등 프로젝트별 커스터마이즈 파일은 절대 덮어쓰지 않는다
- 업데이트 실패 시 이전 버전으로 롤백하지 않고 경고만 출력한다
- dry-run 모드에서는 어떤 변경도 실행하지 않는다
- 설치되지 않은 도구는 SKIP 처리한다 (강제 설치하지 않음)
- git 상태가 dirty한 경우 훅/커맨드 복사 전 경고한다
