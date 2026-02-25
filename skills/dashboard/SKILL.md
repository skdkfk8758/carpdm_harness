---
name: harness-dashboard
description: 워크플로우 대시보드를 생성합니다. "대시보드", "dashboard"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_dashboard` MCP 도구를 호출하세요.

## 인자 매핑
- `"전체"` 또는 `"full"` 포함 시 `sections`에 모든 섹션 포함
- 특정 섹션 지정 시 해당 섹션만 전달 (overview, modules, hooks, events, ontology, memory)

## 실행
```tool
harness_dashboard({ projectRoot: "<감지된 프로젝트 루트>" })
```
