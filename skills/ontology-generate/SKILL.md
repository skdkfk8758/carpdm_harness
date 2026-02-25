---
name: ontology-generate
description: 3계층 온톨로지를 생성합니다. "온톨로지 생성", "ontology generate"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_ontology_generate` MCP 도구를 호출하세요.

## 인자 매핑
- `"dry-run"` 포함 시 `dryRun: true`
- 언어 지정 시 `languages`로 전달 (예: "typescript,python")

## 실행
```tool
harness_ontology_generate({ projectRoot: "<감지된 프로젝트 루트>" })
```
