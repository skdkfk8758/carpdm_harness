# Team Memory 가이드

## 개요

Team Memory 모듈은 팀이 발견한 패턴, 컨벤션, 아키텍처 결정, 실수를 Git에 공유 가능한 형태로 관리합니다.

## 구성 요소

### .claude/rules/ — 공유 규칙
Claude Code가 세션 시작 시 자동으로 로드하는 규칙 파일입니다.

| 파일 | 용도 | 적용 범위 |
|------|------|----------|
| `conventions.md` | 코딩 컨벤션 | `src/**` |
| `patterns.md` | 코드 패턴 | `src/**` |
| `decisions.md` | 아키텍처 결정 | 전체 |
| `mistakes.md` | 실수 & 교훈 | 전체 |

### .claude/agents/team-memory-keeper.md — 학습 에이전트
세션 중 자동으로 패턴과 컨벤션을 감지하여 팀 메모리에 기록합니다.

## 사용법

### 항목 추가
```
harness_memory_add({
  projectRoot: "/path/to/project",
  category: "patterns",
  title: "Builder Pattern",
  content: "McpResponseBuilder 플루언트 API 패턴을 사용하여..."
})
```

### 항목 조회
```
harness_memory_list({
  projectRoot: "/path/to/project",
  category: "all"
})
```

### 메모리 검토
`/memory-review` 커맨드로 전체 메모리를 검토하고 정리합니다.

## 워크플로우

1. **자동 기록**: team-memory-keeper 에이전트가 세션 중 패턴/실수를 자동 감지
2. **수동 기록**: `harness_memory_add`로 직접 항목 추가
3. **정기 검토**: `/memory-review`로 주기적 정리
4. **Git 공유**: 규칙 파일을 커밋하여 팀 전체에 공유

## frontmatter paths

`conventions.md`와 `patterns.md`는 frontmatter에 `paths: ["src/**"]`가 설정되어 있어,
`src/` 하위 파일 작업 시에만 Claude Code가 자동 로드합니다.
`decisions.md`와 `mistakes.md`는 paths가 없으므로 항상 로드됩니다.
