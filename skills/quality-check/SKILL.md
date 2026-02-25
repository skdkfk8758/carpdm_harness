---
name: harness-quality-check
description: TRUST 5 품질 게이트를 수동 실행합니다. "품질 검사", "quality check", "TRUST 검증"을 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_quality_check` MCP 도구를 호출하세요.

## 인자 매핑
- 기준 이름(`tested`|`readable`|`unified`|`secured`|`trackable`)이면 `criteria` 배열로 전달
- 파일 경로 목록이면 `files` 배열로 전달
- `"verbose"` 또는 `"상세"` 포함 시 `verbose: true`
- 인자 없으면 git staged 파일 대상으로 전체 기준 실행

## 실행
```tool
harness_quality_check({ projectRoot: "<감지된 프로젝트 루트>" })
```

## 예시
- 특정 기준만: `harness_quality_check({ projectRoot: "...", criteria: ["tested", "secured"] })`
- 특정 파일만: `harness_quality_check({ projectRoot: "...", files: ["src/core/config.ts"], verbose: true })`

## 후속 안내
- BLOCK 결과 시 실패 항목별 수정 방법을 안내하세요.
- WARN 결과 시 개선 권장 사항을 설명하세요.
- PASS 결과 시 `/carpdm-harness:harness-workflow-advance`로 다음 단계 진행을 권장하세요.
