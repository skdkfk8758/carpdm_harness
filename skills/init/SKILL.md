---
name: harness-init
description: 프로젝트에 AI 협업 워크플로우를 설치합니다. 사용자가 "harness 설치", "워크플로우 설치", "프로젝트 초기화"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_init` MCP 도구를 호출하세요.

## 인자 매핑
- 인자가 프리셋 이름(`full`|`standard`|`minimal`|`tdd`|`secure`)이면 `preset`으로 전달
- 쉼표 구분 모듈 목록이면 `modules`로 전달
- 기본값: preset `"standard"`
- `"dry-run"` 포함 시 `dryRun: true`
- `"ontology"` 포함 시 `enableOntology: true`

## 실행
```tool
harness_init({ projectRoot: "<감지된 프로젝트 루트>", preset: "standard" })
```

## 후속 안내
설치 완료 후 `/carpdm-harness:harness-doctor`로 건강 진단을 권장하세요.
