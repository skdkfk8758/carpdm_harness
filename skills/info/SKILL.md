---
name: harness-info
description: 현재 프로젝트의 harness 설치 상태를 조회합니다. "harness 상태", "설치 정보"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_info` MCP 도구를 호출하세요.

## 실행
```tool
harness_info({ projectRoot: "<감지된 프로젝트 루트>" })
```
