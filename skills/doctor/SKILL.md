---
name: doctor
description: 설치된 워크플로우의 건강 상태를 진단합니다. "harness 진단", "건강 진단", "doctor"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_doctor` MCP 도구를 호출하세요.

## 실행
```tool
harness_doctor({ projectRoot: "<감지된 프로젝트 루트>" })
```

## 후속 안내
문제가 발견되면 `/carpdm-harness:update`로 수정을 권장하세요.
