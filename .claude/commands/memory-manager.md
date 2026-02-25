# Memory Manager

plan.md, todo.md, context.md 외부 기억장치를 관리한다.

## Instructions

### plan.md 관리
- 새 작업 시작 시: `docs/templates/plan-template.md` 기반으로 `plan.md` 생성
- 계획 변경 시: plan.md 업데이트 후 사용자에게 변경점 알림
- 완료 시: plan.md에 "COMPLETED" 마크 추가

### todo.md 관리
- 계획 승인 후: `docs/templates/todo-template.md` 기반으로 `todo.md` 생성
- 각 단계 완료 시: 체크박스 업데이트 `[ ]` → `[x]`
- 새 발견사항 시: TODO 항목 추가
- 현재 진행 중인 항목에 `← CURRENT` 마크

### context.md 관리
- 승인된 결정만 기록 (미승인 추측은 기록 금지)
- 트레이드오프 근거 필수 포함
- 참조 문서/링크 첨부
- 타임스탬프 포함

### 규칙
1. plan.md에 없는 작업은 실행하지 않는다
2. todo.md는 실시간으로 갱신한다
3. context.md에는 "승인된 것만" 기록한다
4. 3종 파일은 프로젝트 루트에 위치한다

## Actions
- `init`: 3종 파일 초기화 (템플릿 기반)
- `update`: 현재 상태 반영하여 파일 갱신
- `status`: 현재 plan/todo/context 상태 요약 출력
- `close`: 작업 완료 처리 (COMPLETED 마크 + 아카이브)

## Argument: $ARGUMENTS
액션과 대상 (예: "init 새 기능 추가", "update todo 3번 완료", "status", "close")
