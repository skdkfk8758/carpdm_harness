# Update Check — 설치 환경 버전 확인 (업데이트 실행 안 함)

현재 설치된 모든 컴포넌트의 버전을 확인하고, 업데이트 가능 여부를 보고한다.
실제 업데이트는 수행하지 않는다. 업데이트를 실행하려면 `/update-all`을 사용한다.

## Argument: $ARGUMENTS
필터 (예: "harness만", "mcp만", 비어있으면 전체)

## Instructions

### Phase 1: 로컬 설치 상태 스캔

```bash
echo "=== 설치 환경 버전 확인 ==="

# 1. carpdm-harness
echo ""
echo "[carpdm-harness]"
if [ -f "carpdm-harness.config.json" ]; then
    echo "  설치됨"
    cat carpdm-harness.config.json | node -e "
      const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));
      console.log('  preset:', d.preset || 'unknown');
      console.log('  modules:', (d.modules||[]).join(', '));
      console.log('  updatedAt:', d.updatedAt || 'unknown');
    " 2>/dev/null
else
    echo "  미설치"
fi

# 2. oh-my-claudecode
echo ""
echo "[oh-my-claudecode]"
OMC_CONFIG="$HOME/.claude/.omc-config.json"
if [ -f "$OMC_CONFIG" ]; then
    node -e "
      const d=JSON.parse(require('fs').readFileSync('$OMC_CONFIG','utf-8'));
      console.log('  version:', d.version || 'unknown');
    " 2>/dev/null
else
    echo "  미설치"
fi

# 3. Claude Code
echo ""
echo "[Claude Code]"
claude --version 2>/dev/null || echo "  미설치"

# 4. Skills (커스텀 커맨드)
echo ""
echo "[Skills]"
SKILL_COUNT=$(ls .claude/commands/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "  프로젝트: ${SKILL_COUNT}개"
GLOBAL_SKILL_COUNT=$(ls "$HOME/.claude/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "  글로벌: ${GLOBAL_SKILL_COUNT}개"

# 5. Hooks
echo ""
echo "[Hooks]"
HOOK_COUNT=$(ls .claude/hooks/*.sh 2>/dev/null | wc -l | tr -d ' ')
echo "  프로젝트: ${HOOK_COUNT}개"

# 6. MCP 서버
echo ""
echo "[MCP 서버]"
if [ -f ".claude-plugin/plugin.json" ]; then
    node -e "
      const d=JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf-8'));
      const s=d.mcpServers;
      if(typeof s==='object'&&s!==null){Object.keys(s).forEach(k=>console.log('  -',k))}
      else{console.log('  외부 참조:',s)}
    " 2>/dev/null
elif [ -f ".mcp.json" ]; then
    node -e "
      const d=JSON.parse(require('fs').readFileSync('.mcp.json','utf-8'));
      Object.keys(d.mcpServers||{}).forEach(k=>console.log('  -',k));
    " 2>/dev/null
else
    echo "  없음"
fi

# 7. CLI 도구
echo ""
echo "[CLI 도구]"
command -v codex &>/dev/null && echo "  Codex: $(codex --version 2>&1 | head -1)" || echo "  Codex: 미설치"
command -v gemini &>/dev/null && echo "  Gemini: $(gemini --version 2>&1 | head -1)" || echo "  Gemini: 미설치"
```

### Phase 2: 최신 버전 확인 (npm registry)

```bash
echo ""
echo "=== 최신 버전 확인 ==="

# carpdm-harness
echo ""
HARNESS_LATEST=$(npm view carpdm-harness version 2>/dev/null || echo "조회 실패")
echo "[carpdm-harness] latest: $HARNESS_LATEST"

# oh-my-claudecode
OMC_LATEST=$(npm view oh-my-claude-sisyphus version 2>/dev/null || echo "조회 실패")
echo "[oh-my-claudecode] latest: $OMC_LATEST"

# Claude Code
CC_LATEST=$(npm view @anthropic-ai/claude-code version 2>/dev/null || echo "조회 실패")
echo "[Claude Code] latest: $CC_LATEST"
```

### Phase 3: 결과 요약

스캔 결과를 테이블로 정리하여 보고한다:

```
┌──────────────────┬──────────┬──────────┬──────────┐
│ 컴포넌트         │ 현재     │ 최신     │ 상태     │
├──────────────────┼──────────┼──────────┼──────────┤
│ carpdm-harness   │ 4.0.0    │ 4.1.0    │ ⚠️ 업데이트 가능 │
│ oh-my-claudecode │ 3.2.0    │ 3.2.0    │ ✅ 최신  │
│ Claude Code      │ 2.1.x    │ 2.1.y    │ ⚠️ 업데이트 가능 │
│ Skills           │ 20개     │ -        │ ✅       │
│ Hooks            │ 11개     │ -        │ ✅       │
│ MCP 서버         │ 1개      │ -        │ ✅       │
└──────────────────┴──────────┴──────────┴──────────┘

업데이트가 필요하면: /update-all 실행
```

## Rules
- 이 스킬은 확인만 수행하며, 어떤 파일도 변경하지 않는다
- npm registry 조회 실패 시 "조회 실패"로 표시하고 계속 진행
- 미설치 항목은 "미설치"로 표시하고 설치를 강제하지 않는다
