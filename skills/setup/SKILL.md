---
name: harness-setup
description: OMC 기반 원스톱 프로젝트 셋업. "harness 셋업", "프로젝트 셋업", "setup"을 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_setup` MCP 도구를 호출하세요.

## 인자 매핑
- 프리셋 이름(`full`|`standard`|`tdd`|`secure`)이면 `preset`으로 전달
- 기본값: preset `"standard"`
- `"dry-run"` 포함 시 `dryRun: true`

## 실행
```tool
harness_setup({ projectRoot: "<감지된 프로젝트 루트>" })
```

## 전제 조건
- OMC(oh-my-claudecode) 설치 필수
- 미설치 시 `npm i -g oh-my-claudecode && omc setup` 안내

## 후속 안내
셋업 완료 후:
1. `/carpdm-harness:harness-doctor`로 건강 진단
2. `/carpdm-harness:harness-workflow`로 사용 가능한 워크플로우 확인
