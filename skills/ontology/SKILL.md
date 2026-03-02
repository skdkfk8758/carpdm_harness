---
name: harness-ontology
description: 온톨로지 생성 또는 갱신. "온톨로지", "ontology", "온톨로지 생성", "온톨로지 갱신"을 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 적절한 온톨로지 MCP 도구를 호출하세요.

## 인자 매핑
- `"생성"`, `"generate"`, `"전체"`, `"초기화"` → `harness_ontology_generate` 호출
- `"갱신"`, `"refresh"`, `"업데이트"`, `"동기화"` → `harness_ontology_refresh` 호출
- 인자 없음 → `harness_ontology_refresh` (기본: 점진적 갱신)
- `"dry-run"` 포함 시 `dryRun: true`
- 언어 지정 시 `languages`로 전달 (예: "typescript,python") — generate 전용

## 실행 예시

### 점진적 갱신 (기본)
```tool
harness_ontology_refresh({ projectRoot: "<감지된 프로젝트 루트>" })
```

### 전체 생성
```tool
harness_ontology_generate({ projectRoot: "<감지된 프로젝트 루트>" })
```
