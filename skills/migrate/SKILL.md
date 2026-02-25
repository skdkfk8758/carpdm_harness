---
name: migrate
description: 레거시 상태를 마이그레이션합니다. "harness 마이그레이션", "migrate"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_migrate` MCP 도구를 호출하세요.

## 인자 매핑
- `"dry-run"` 포함 시 `dryRun: true`

## 실행
```tool
harness_migrate({ projectRoot: "<감지된 프로젝트 루트>" })
```
