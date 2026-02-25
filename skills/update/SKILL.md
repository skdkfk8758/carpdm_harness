---
name: harness-update
description: 설치된 워크플로우 템플릿을 diff 기반으로 업데이트합니다. "harness 업데이트", "템플릿 업데이트"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_update` MCP 도구를 호출하세요.

## 인자 매핑
- `"dry-run"` 포함 시 `dryRun: true`
- `"모두 수락"` 또는 `"accept all"` 포함 시 `acceptAll: true`
- 특정 모듈명이 있으면 `module`로 전달
- `"ontology"` 포함 시 `refreshOntology: true`

## 실행
```tool
harness_update({ projectRoot: "<감지된 프로젝트 루트>" })
```
