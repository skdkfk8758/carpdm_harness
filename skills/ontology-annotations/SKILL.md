---
name: harness-ontology-annotations
description: '@MX 어노테이션을 조회/필터링합니다. "어노테이션 조회", "MX 태그", "annotations"를 요청할 때 사용합니다.'
---

현재 프로젝트 루트를 감지하고 `harness_ontology_annotations` MCP 도구를 호출하세요.

## 인자 매핑
- 태그 이름(`ANCHOR`|`WARN`|`NOTE`|`TODO`)이면 `tag`로 전달
- 파일 경로이면 `file`로 전달
- 숫자이면 `minFanIn`으로 전달 (ANCHOR 필터)
- 인자 없으면 전체 어노테이션 조회

## 실행
```tool
harness_ontology_annotations({ projectRoot: "<감지된 프로젝트 루트>" })
```

## 예시
- 태그 필터: `harness_ontology_annotations({ projectRoot: "...", tag: "ANCHOR" })`
- 파일 필터: `harness_ontology_annotations({ projectRoot: "...", file: "src/core/config.ts" })`
- fan_in 필터: `harness_ontology_annotations({ projectRoot: "...", tag: "ANCHOR", minFanIn: 5 })`

## 후속 안내
- 온톨로지가 없으면 `/carpdm-harness:harness-ontology-generate`를 먼저 실행하도록 안내하세요.
- WARN 태그가 많으면 해당 파일의 리팩토링을 권장하세요.
