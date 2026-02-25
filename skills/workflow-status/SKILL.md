---
name: harness-workflow-status
description: 현재 워크플로우 진행 상태를 확인합니다. "워크플로우 상태", "workflow status"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_workflow` MCP 도구를 `status` 액션으로 호출하세요.

## 실행
```tool
harness_workflow({ projectRoot: "<감지된 프로젝트 루트>", action: "status" })
```
