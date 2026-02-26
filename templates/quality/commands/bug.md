# Bug — 빠른 버그 기록

발견한 버그를 `.claude/rules/bugs.md`와 팀 메모리에 기록한다.

## Argument: $ARGUMENTS
버그 설명 (예: "ontology cache가 갱신되지 않는 문제")

## Instructions

### Step 1: 입력 확인

$ARGUMENTS가 비어있으면 AskUserQuestion으로 버그 설명을 물어본다.

### Step 2: 컨텍스트 수집

```bash
BRANCH=$(git branch --show-current)
COMMIT=$(git rev-parse --short HEAD)
```

### Step 3: 버그 기록

`harness_bug_report` MCP 도구가 사용 가능하면 호출:
```
harness_bug_report({
  projectRoot: "<프로젝트 루트>",
  title: "<버그 제목>",
  description: "<상세 설명>",
  context: "<브랜치, 커밋 정보>"
})
```

도구가 없으면 `.claude/rules/bugs.md`에 직접 추가:
```markdown
- [YYYY-MM-DD] **<버그 제목>** — <설명> (branch: <branch>, commit: <commit>)
```

### Step 4: 결과 보고

```
🐛 버그 기록 완료
  "<버그 설명>"
  → .claude/rules/bugs.md에 저장됨
```

## Rules
- 기존 bugs.md에서 유사 버그 존재 여부 확인 (중복 방지)
- 브랜치, 커밋 정보를 자동 첨부
- 긴급도가 높으면 사용자에게 즉시 수정 여부 확인
