---
name: ontology-domain-write
description: Domain 레이어 분석 결과를 저장합니다. "도메인 레이어 저장", "domain write"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_ontology_domain_write` MCP 도구를 호출하세요.

## 인자 매핑
- `domainYaml`: Domain 레이어 YAML 문자열
- `domainMarkdown`: Domain 레이어 마크다운 문서 (선택)

## 실행
```tool
harness_ontology_domain_write({ projectRoot: "<감지된 프로젝트 루트>", domainYaml: "<YAML>" })
```
