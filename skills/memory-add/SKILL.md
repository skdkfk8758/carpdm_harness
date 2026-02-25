---
name: harness-memory-add
description: 팀 공유 메모리에 항목을 추가합니다. "메모리 추가", "팀 메모리 기록"을 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_memory_add` MCP 도구를 호출하세요.

## 인자 매핑
- `category`: conventions | patterns | decisions | mistakes 중 하나 (사용자 의도에서 추론)
- `subcategory`: (conventions인 경우) naming | structure | error-handling | other
- `title`: 항목 제목
- `content`: 마크다운 내용
- `evidence`: 근거 파일 경로 배열 (선택)

## 실행
```tool
harness_memory_add({ projectRoot: "<감지된 프로젝트 루트>", category: "<추론>", title: "<제목>", content: "<내용>" })
```
