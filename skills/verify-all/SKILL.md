---
name: harness-verify-all
description: TRUST 5 + 프로젝트 커스텀 verify 스킬 통합 검증을 실행합니다. "통합 검증", "전체 검증", "verify all", "품질 검사", "quality check", "TRUST 검증"을 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_verify_all` MCP 도구를 호출하세요.

## 인자 매핑
- 파일 경로 목록이면 `files` 배열로 전달
- `"verbose"` 또는 `"상세"` 포함 시 `verbose: true`
- `"trust"`, `"TRUST만"`, `"trust only"`, `"품질"` 포함 시 `skipCustom: true` (TRUST 5만 실행)
- `"커스텀만"` 또는 `"custom only"` 포함 시 `skipTrust: true`
- 인자 없으면 git 변경 파일 대상으로 전체 검증

## 실행
```tool
harness_verify_all({ projectRoot: "<감지된 프로젝트 루트>" })
```

## 예시
- 전체: `harness_verify_all({ projectRoot: "..." })`
- TRUST만: `harness_verify_all({ projectRoot: "...", skipCustom: true })`
- 상세: `harness_verify_all({ projectRoot: "...", verbose: true })`
- 특정 파일: `harness_verify_all({ projectRoot: "...", files: ["src/core/config.ts"] })`

## 후속 안내
- FAIL 결과 시 실패 항목별 수정 방법을 안내하세요
- 커스텀 verify 스킬이 없으면 `harness_manage_verify(action: "apply")`로 생성을 권장하세요
- PASS 결과 시 워크플로우 다음 단계 진행을 권장하세요
