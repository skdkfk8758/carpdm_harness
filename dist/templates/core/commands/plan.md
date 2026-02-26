# Plan — 작업 계획 조회

`.agent/plan.md`를 조회하고 주요 정보를 요약한다.

## Argument: $ARGUMENTS
표시 모드. "full"이면 전체 내용, 없으면 요약만.

## Instructions

### Step 1: plan.md 읽기

`.agent/plan.md` 파일을 읽는다. 없으면 안내한다:
"plan.md가 없습니다. `/plan-gate`로 계획을 수립하세요."

### Step 2: 핵심 정보 추출

- **상태**: DRAFT / APPROVED / IN_PROGRESS / COMPLETED
- **목표**: 첫 번째 ## 목표(Objective) 섹션 내용
- **도메인**: 관련 도메인
- **변경 파일 수**: Affected Files 섹션의 파일 수
- **Edge Cases**: 식별된 엣지 케이스 수

### Step 3: 결과 출력

요약 모드 (기본):
```
📝 Plan 요약
━━━━━━━━━━━━━━━━━━━━
상태: APPROVED ✅
목표: <objective>
도메인: <domains>
변경 파일: N개
Edge Cases: N개
━━━━━━━━━━━━━━━━━━━━
변경 파일: file1.ts, file2.ts, ...
```

$ARGUMENTS에 "full"이 있으면 전체 plan.md 내용을 표시한다.

## Rules
- 읽기 전용 (수정 없음)
- 상태가 DRAFT이면 "승인이 필요합니다. `/plan-gate`에서 승인하세요." 경고
- plan-gate와 역할 분리: plan-gate는 작성/승인, 이 스킬은 조회 전용
