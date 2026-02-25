---
name: harness-workflow-start
description: 워크플로우를 시작합니다. "워크플로우 시작", "workflow start"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_workflow` MCP 도구를 `start` 액션으로 호출하세요.

## 인자 매핑
- 워크플로우 이름 필수: `feature`, `bugfix`, `refactor`, `release`, `security`
- 컨텍스트(설명, 브랜치 등)가 있으면 `context` JSON으로 전달

## 실행
```tool
harness_workflow({ projectRoot: "<감지된 프로젝트 루트>", action: "start", workflow: "feature", context: "{\"description\": \"...\"}" })
```

## 워크플로우 시작 후
- 반환된 첫 단계의 OMC 스킬을 실행하세요
- 각 단계 완료 시 `harness_workflow({ action: "advance" })`로 진행하세요
- 체크포인트 단계에서는 사용자 승인을 받은 후 `harness_workflow({ action: "approve" })`
