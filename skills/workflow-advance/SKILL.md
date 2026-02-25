---
name: harness-workflow-advance
description: 워크플로우 현재 단계를 완료하고 다음으로 진행합니다. "다음 단계", "advance", "단계 완료"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_workflow` MCP 도구를 `advance` 액션으로 호출하세요.

## 실행
```tool
harness_workflow({ projectRoot: "<감지된 프로젝트 루트>", action: "advance", result: "<이전 단계 결과 요약>" })
```

## 진행 후
- 반환된 다음 단계의 OMC 스킬을 자동으로 실행하세요
- 체크포인트가 있으면 사용자에게 승인 요청
- 모든 단계 완료 시 워크플로우 종료 안내
