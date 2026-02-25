---
name: harness-memory-list
description: 팀 공유 메모리를 조회합니다. "메모리 조회", "팀 메모리 보기"를 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_memory_list` MCP 도구를 호출하세요.

## 인자 매핑
- 특정 카테고리 지정 시 `category`로 전달
- 기본값: 전체 조회

## 실행
```tool
harness_memory_list({ projectRoot: "<감지된 프로젝트 루트>" })
```
