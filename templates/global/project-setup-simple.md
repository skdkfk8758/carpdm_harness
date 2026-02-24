# Project Setup Simple — 초보자용 간소화 프로젝트 세팅

AI 협업 환경을 빠르게 구축합니다. 복잡한 선택 없이 핵심만 설치합니다.

## Argument: $ARGUMENTS
프로젝트 설명 (예: "React 블로그", "FastAPI 서버", "Next.js 쇼핑몰")

## Instructions

### Phase 1: 환경 확인

```bash
node --version && npm --version
git --version
git rev-parse --show-toplevel 2>/dev/null || echo "git 저장소가 아닙니다"
```

git 저장소가 아니면 `git init`을 권유한다.

### Phase 2: 간단 인터뷰 (4문항)

AskUserQuestion으로 간단히 확인한다:

**질문 1: 기술 스택**
- "어떤 기술 스택을 사용하나요?"
- 선택지: React / Vue / Next.js / FastAPI / Express / Django / 기타
- 복수 선택 가능

**질문 2: 프로젝트 유형**
- "어떤 종류의 프로젝트인가요?"
- 선택지: 웹앱 / API 서버 / 풀스택 / CLI 도구 / 라이브러리 / 기타

**질문 3: 프로그래밍 언어**
- "주 언어는?"
- 선택지: TypeScript / JavaScript / Python / Go / 기타

**질문 4: 응답 언어**
- "AI 응답을 어떤 언어로 받고 싶나요?"
- 선택지: 한국어 (Recommended) / English / 日本語 / 中文
- 기본값: 한국어

**질문 5: TDD (테스트 주도 개발)**
- "코드 수정 시 테스트 파일을 강제하시겠습니까?"
- 선택지: Block — 테스트 없으면 수정 차단 (Recommended) / Warn — 경고만 표시 / Off — 사용 안 함
- 기본값: Block

### Phase 3: 파일 생성

인터뷰 결과를 바탕으로 아래 파일들을 생성한다.

#### 3-1. CLAUDE.md

프로젝트 루트에 생성. 아래 구조를 따른다:

```markdown
# 프로젝트명

## 개요
[인터뷰에서 파악한 프로젝트 설명]

## 기술 스택
- [감지/인터뷰한 기술들]

## 개발 명령어
- 설치: `npm install` 또는 `pip install -r requirements.txt`
- 실행: `npm run dev` 또는 `python main.py`
- 테스트: `npm test` 또는 `pytest`
- 빌드: `npm run build`

## 프로젝트 구조
[주요 디렉토리 설명]

## 언어 정책
[인터뷰 질문 4 결과에 따라 생성]
- 한국어 선택 시: "모든 응답, 코드 주석, 문서는 한국어로 작성한다. 커밋 메시지와 변수/함수명만 영문."
- English 선택 시: "All responses, code comments, and documentation must be written in English."

## 작업 규칙
1. 코드 수정 전에 plan.md를 먼저 작성
2. 작업 단위별로 todo.md에 기록
3. 완료 후 테스트 실행
4. 의미 있는 단위로 커밋
```

#### 3-2. docs/templates/plan-template.md

```markdown
mkdir -p docs/templates
```

```markdown
# Plan: [작업 제목]

## 상태: DRAFT | APPROVED | IN_PROGRESS | COMPLETED

## 목표
[이 작업의 목표]

## 작업 항목
1. [ ] 항목 1
2. [ ] 항목 2
3. [ ] 항목 3

## 완료 조건
- [ ] 모든 테스트 통과
- [ ] 코드 리뷰 완료
```

#### 3-3. docs/templates/todo-template.md

```markdown
# TODO

## 진행 중
- [ ] 작업 항목 ← CURRENT

## 완료
- [x] 완료된 항목
```

#### 3-4. carpdm-harness 최소 워크플로우 설치

```
harness_init(
  projectRoot: PROJECT_ROOT,
  preset: "minimal",
  installGlobal: true
)
```

이 도구가 기본 커맨드와 훅을 자동 생성한다.

#### 3-5. .claude/settings.local.json

TDD 질문 5의 답변이 Off가 아니면 `tdd-guard.sh`를 훅에 추가한다:

**TDD Off인 경우:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/plan-guard.sh"
          }
        ]
      }
    ]
  }
}
```

**TDD Block/Warn인 경우:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/plan-guard.sh"
          },
          {
            "type": "command",
            "command": "bash .claude/hooks/tdd-guard.sh"
          }
        ]
      }
    ]
  }
}
```

TDD 활성 시 `.omc/project-memory.json`도 생성한다:
```json
{
  "tdd": {
    "enabled": true,
    "mode": "block",
    "speedModeWarn": true,
    "framework": "auto"
  }
}
```
- Block 선택: `"mode": "block"`, Warn 선택: `"mode": "warn"`

TDD 활성 시 `.claude/hooks/tdd-guard.sh`도 `templates/`에서 복사한다.

#### 3-6. .gitignore 업데이트

기존 .gitignore에 아래 항목이 없으면 추가:

```
# AI 작업 파일 (커밋하지 않음)
.omc/
plan.md
todo.md
context.md
```

### Phase 4: 검증

```bash
# 훅 문법 검증
bash -n .claude/hooks/plan-guard.sh && echo "[OK] 훅 정상" || echo "[ERROR] 훅 문법 오류"

# 생성된 파일 확인
echo ""
echo "=== 생성된 파일 ==="
ls -la CLAUDE.md .claude/hooks/plan-guard.sh .claude/settings.local.json docs/templates/ 2>/dev/null
```

### Phase 5: 완료 보고

```
========================================
  세팅 완료! (Simple 버전)
========================================

생성된 파일:
  ✓ CLAUDE.md — AI에게 프로젝트 정보 전달
  ✓ .claude/hooks/plan-guard.sh — 코드 수정 전 계획 확인
  ✓ .claude/hooks/tdd-guard.sh — 테스트 없으면 수정 차단 (TDD 활성 시)
  ✓ .claude/settings.local.json — 훅 등록
  ✓ docs/templates/plan-template.md — 계획서 양식
  ✓ docs/templates/todo-template.md — 할 일 목록 양식

사용법:
  1. 작업 시작 전: plan.md 작성 (양식: docs/templates/plan-template.md)
  2. 할 일 관리: todo.md 작성 (양식: docs/templates/todo-template.md)
  3. 코드 수정: plan.md가 없으면 자동 알림
  4. TDD: 테스트를 먼저 작성 → 구현 → 리팩토링 (/tdd-cycle)
  5. 커밋: 의미 있는 단위로 git commit

고급 기능이 필요하면:
  /project-setup "프로젝트 설명"  (전체 버전)
```

## Rules
- 질문은 5개를 초과하지 않는다
- MCP, Codex, Gemini 등 외부 도구를 설치하지 않는다
- oh-my-claudecode 플러그인을 설치하지 않는다
- 훅은 plan-guard.sh 1개만 설치한다 (최소 구성)
- 사용자가 선택해야 하는 것을 최소화한다
- 생성되는 파일은 최대 6개 이내
