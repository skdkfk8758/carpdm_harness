# Diff Summary — 변경사항 요약

현재 변경사항(staged + unstaged + untracked)을 요약하여 보여준다. 커밋 전 리뷰에 유용.

## Instructions

### Step 1: 변경사항 수집

```bash
# Staged
git diff --cached --stat
git diff --cached --name-status

# Unstaged
git diff --stat
git diff --name-status

# Untracked
git ls-files --others --exclude-standard
```

### Step 2: 변경 통계 계산

- 파일별: 추가/수정/삭제 라인 수
- 전체: 총 변경 파일 수, 추가/삭제 라인 합계
- 카테고리별 분류: 소스코드 / 테스트 / 설정 / 문서

### Step 3: 변경 내용 분석

변경된 파일의 diff를 읽고 핵심 변경 내용을 파일별 한 줄로 요약한다.

### Step 4: 결과 출력

```
Diff Summary
━━━━━━━━━━━━━━━━━━━━━━━━
📊 통계: 5 files, +120 -45

Staged (3 files):
  M src/core/workflow.ts    +30 -10  워크플로우 FSM 전이 추가
  A src/tools/new-tool.ts   +80      새 MCP 도구 등록
  M tests/workflow.test.ts  +10 -5   전이 테스트 추가

Unstaged (1 file):
  M src/utils/logger.ts     +5 -2    로그 레벨 조정

Untracked (1 file):
  ? docs/new-feature.md

━━━━━━━━━━━━━━━━━━━━━━━━
다음: /logical-commit 또는 /quick-check
```

## Rules
- 변경 내용을 읽어서 의미 있는 요약 제공
- staged와 unstaged를 명확히 구분
- 바이너리 파일은 "[binary]"로 표시
- 100줄 이상 변경된 파일은 주요 변경점만 요약
