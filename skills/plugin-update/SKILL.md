---
name: harness-plugin-update
description: carpdm-harness와 oh-my-claudecode 플러그인의 최신 버전을 확인하고 업데이트합니다. "플러그인 업데이트", "최신 버전 확인", "plugin update"를 요청할 때 사용합니다.
---

carpdm-harness와 oh-my-claudecode 플러그인의 GitHub 최신 릴리스를 확인하고, 현재 설치된 버전과 비교하여 업데이트합니다.

## 대상 플러그인

| 플러그인 | GitHub 저장소 | 업데이트 명령 |
|----------|--------------|--------------|
| carpdm-harness | `skdkfk8758/carpdm_harness` | `claude plugin update carpdm-harness@carpdm` |
| oh-my-claudecode | `Yeachan-Heo/oh-my-claudecode` | `claude plugin update oh-my-claudecode` |

## 워크플로우

아래 Step 1~3을 **각 플러그인에 대해 순서대로** 실행합니다.

### Step 1: GitHub 최신 버전 확인

각 플러그인의 GitHub 최신 릴리스를 조회합니다.

**carpdm-harness:**
```bash
gh release view --repo skdkfk8758/carpdm_harness --json tagName,publishedAt,name --jq '"\(.tagName) (\(.name)) - \(.publishedAt)"' 2>/dev/null || echo "FETCH_FAILED"
```

**oh-my-claudecode:**
```bash
gh release view --repo Yeachan-Heo/oh-my-claudecode --json tagName,publishedAt,name --jq '"\(.tagName) (\(.name)) - \(.publishedAt)"' 2>/dev/null || echo "FETCH_FAILED"
```

`gh` 실패 시 curl fallback:
```bash
curl -sL "https://api.github.com/repos/<owner>/<repo>/releases/latest" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"tag_name\"]} ({d[\"name\"]}) - {d[\"published_at\"]}')" 2>/dev/null || echo "FETCH_FAILED"
```

둘 다 실패하면 해당 플러그인은 "GitHub 접근 불가 — 네트워크 또는 인증을 확인하세요"로 안내하고 건너뜁니다.

### Step 2: 현재 설치 버전 확인

```bash
claude plugin list 2>/dev/null
```

각 플러그인 이름으로 grep하여 설치 여부와 버전을 확인합니다.
출력이 없으면 해당 플러그인은 미설치 상태입니다. Step 3의 "미설치" 분기로 진행합니다.

### Step 3: 버전 비교 및 업데이트

**이미 최신인 경우:**
- "현재 설치된 버전이 최신입니다 (vX.Y.Z)"로 안내합니다.

**업데이트 필요한 경우:**
```bash
# carpdm-harness
claude plugin update carpdm-harness@carpdm

# oh-my-claudecode
claude plugin update oh-my-claudecode
```

**미설치인 경우:**
```bash
# carpdm-harness
claude plugin install carpdm-harness@carpdm

# oh-my-claudecode (GitHub marketplace에서 설치)
claude plugin install oh-my-claudecode
```

### Step 4: 결과 보고

```
=== 플러그인 업데이트 결과 ===

| 플러그인 | GitHub 최신 | 이전 버전 | 이후 버전 | 상태 |
|----------|------------|----------|----------|------|
| carpdm-harness | vX.Y.Z | vA.B.C | vX.Y.Z | 업데이트 완료 |
| oh-my-claudecode | vX.Y.Z | vA.B.C | vX.Y.Z | 이미 최신 |
```

업데이트 후 프로젝트 템플릿도 동기화하려면 `/carpdm-harness:sync`를 안내합니다.
