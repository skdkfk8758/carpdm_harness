---
name: harness-manage-verify
description: 검증 스킬을 관리합니다. git 변경 분석 → 드리프트 탐지 → verify 스킬 자동 생성/업데이트. "드리프트 분석", "verify 스킬 관리", "manage verify"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_manage_verify` MCP 도구를 호출하세요.

## 인자 매핑
- `action`: `analyze` (분석만) 또는 `apply` (제안 적용까지)
- 사용자가 "적용", "생성", "만들어줘" 등을 포함하면 `action: "apply"`
- 기본값은 `analyze` (분석 결과만 보여주기)

## 실행
```tool
harness_manage_verify({ projectRoot: "<감지된 프로젝트 루트>", action: "analyze" })
```

## 예시
- 분석만: `harness_manage_verify({ projectRoot: "...", action: "analyze" })`
- 적용까지: `harness_manage_verify({ projectRoot: "...", action: "apply" })`

## 후속 안내
- 갭이 발견되면 `action: "apply"`로 자동 생성을 권장하세요
- 생성된 스킬은 `.claude/skills/verify-*/SKILL.md`에 위치합니다
- 생성 후 `harness_verify_all`로 통합 검증을 실행하세요
