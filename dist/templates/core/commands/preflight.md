# Preflight — 작업 전 종합 점검

작업 시작 전에 환경이 준비되었는지 확인한다. 빌드, 타입체크, 테스트, git 상태를 점검.

## Instructions

### Step 1: Git 상태 점검

```bash
# 현재 브랜치
BRANCH=$(git branch --show-current)

# uncommitted changes
CHANGES=$(git status --porcelain | wc -l | tr -d ' ')

# main 대비 상태
git fetch origin main --quiet 2>/dev/null
AHEAD=$(git rev-list origin/main..HEAD --count 2>/dev/null || echo "?")
BEHIND=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "?")

# stash
STASH=$(git stash list | wc -l | tr -d ' ')
```

### Step 2: 빌드 점검

```bash
# TypeScript 타입체크
if [ -f "tsconfig.json" ]; then
    npx tsc --noEmit 2>&1
fi

# 빌드
if [ -f "package.json" ]; then
    npm run build 2>&1
fi
```

### Step 3: 테스트 점검

```bash
npm test 2>&1
```

### Step 4: 환경 점검

```bash
# Node.js 버전
node -v

# 의존성 설치 상태
[ -d "node_modules" ] && echo "node_modules: OK" || echo "node_modules: MISSING"
```

### Step 5: 결과 보고

```
══════════════════════════════════
  Preflight Check
══════════════════════════════════

🔀 Git
  ✅ Branch: feat/42-add-login
  ✅ Clean working tree
  ✅ main 대비: +3 ahead, 0 behind
  ⚠️ Stash: 1개 항목

🔨 Build
  ✅ TypeScript: 0 errors
  ✅ Build: success

🧪 Test
  ✅ 273 tests passed

📦 Environment
  ✅ Node.js v20.x
  ✅ Dependencies installed

══════════════════════════════════
결과: ALL PASS ✅ (또는 N개 실패 ❌)
══════════════════════════════════
```

FAIL 항목이 있으면 수정 방안을 제시한다.

## Rules
- 점검만 수행하고 자동 수정하지 않는다
- FAIL 항목에 대해 수정 방안을 제시한다
- 빌드/테스트 실패 시 에러 메시지를 요약하여 보여준다
- 프로젝트에 없는 도구는 SKIP 처리
