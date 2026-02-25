# Ship Release — PR 머지 + 릴리스 원스톱 실행

오픈된 PR을 머지하고, 버전을 올려 GitHub Release를 생성한다.

## Argument: $ARGUMENTS
PR 번호 또는 버전 타입 (예: "#42 patch", "minor", 비어있으면 자동 감지)

## Instructions

### Phase 1: 현재 상태 분석

```bash
# 1. 오픈 PR 목록 확인
gh pr list --state open

# 2. 현재 브랜치의 PR 확인 (인자 없을 때 사용)
gh pr view --json number,title,headRefName,state,statusCheckRollup

# 3. 최근 릴리스 버전 확인
git tag --sort=-v:refname | head -5
```

- $ARGUMENTS에서 PR 번호 파싱 (예: "#42" → 42)
- PR 번호 없으면 현재 브랜치의 PR 자동 감지
- 오픈된 PR이 없으면 "머지할 PR이 없습니다"를 출력하고 종료

### Phase 2: PR 머지

```bash
# 1. PR 체크 상태 확인
gh pr checks <number>

# 2. 체크 통과 확인 후 머지
gh pr merge <number> --squash --delete-branch

# 3. 로컬 main 업데이트
git checkout main && git pull origin main
```

- PR 체크가 모두 통과했는지 확인
- 체크 미통과 시 사용자에게 알리고 진행 여부를 AskUserQuestion으로 확인
- squash merge로 깔끔한 커밋 히스토리 유지
- 머지된 feature 브랜치 자동 삭제

### Phase 3: 버전 결정

$ARGUMENTS에서 버전 타입을 파싱한다 (patch/minor/major).

#### 자동 감지 (버전 타입 미지정 시)

PR의 커밋 메시지를 분석하여 자동 결정:

| 커밋 패턴 | 버전 타입 |
|-----------|----------|
| `feat:` 포함 | minor |
| `fix:` / `refactor:` / `docs:` / `chore:` | patch |
| `BREAKING CHANGE` 포함 | major |

```bash
# PR 커밋 메시지 분석
gh pr view <number> --json commits --jq '.commits[].messageHeadline'
```

#### 사용자 확인

버전 결정 후 AskUserQuestion으로 확인:

```
현재 버전: v2.0.0
제안 버전: v2.1.0 (minor — feat: 커밋 감지)

진행할까요?
```

### Phase 4: 릴리스 실행

```bash
# scripts/release.sh가 있으면 사용
bash scripts/release.sh <type>
```

스크립트가 없을 경우 직접 실행:

```bash
# 1. npm version (package.json 버전 bump, --no-git-tag-version)
npm version <type> --no-git-tag-version

# 2. .claude-plugin/plugin.json 버전 동기화
node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf-8'));
    pkg.version = require('./package.json').version;
    fs.writeFileSync('.claude-plugin/plugin.json', JSON.stringify(pkg, null, 2) + '\n');
"

# 3. 커밋 + 태그
git add package.json .claude-plugin/plugin.json
git commit -m "release: v<new-version>"
git tag -a "v<new-version>" -m "Release v<new-version>"

# 4. Push + GitHub Release
git push origin main --tags
gh release create "v<new-version>" --title "v<new-version>" --generate-notes
```

### Phase 5: 결과 보고

```
========================================
  Ship Release 완료
========================================

PR:       #42 (squash merged)
버전:     v2.0.0 → v2.1.0 (minor)
릴리스:   https://github.com/.../releases/tag/v2.1.0
브랜치:   feat/xxx (삭제됨)

다른 프로젝트 업데이트: /harness-sync 실행
```

## Rules
- main 브랜치에서만 릴리스 가능
- PR 체크 미통과 시 머지하지 않음 (사용자 확인 없이 자동 머지 금지)
- force push 금지
- 버전 타입 결정은 반드시 사용자 확인 후 진행
- .claude-plugin/plugin.json 버전 동기화 필수
- 커밋 메시지는 `release: v<version>` 형식
- GitHub Release는 --generate-notes로 자동 릴리스 노트 생성
