---
name: harness-sync
description: 플러그인 업데이트 + 프로젝트 템플릿 동기화를 원스톱으로 실행합니다. "플러그인 업데이트", "harness 동기화", "sync"를 요청할 때 사용합니다.
---

carpdm-harness 플러그인을 최신 버전으로 갱신하고, 현재 프로젝트의 템플릿을 동기화합니다.

## 워크플로우

### Phase 1: 플러그인 코드 갱신

GitHub에서 최신 플러그인 코드를 가져옵니다.

```bash
claude plugin update carpdm-harness
```

실패 시:
- `claude plugin list`로 설치 상태 확인
- 미설치면: `claude plugin add https://github.com/skdkfk8758/carpdm_harness`
- 그래도 실패하면 사용자에게 수동 안내

### Phase 2: 프로젝트 템플릿 동기화

현재 프로젝트에 설치된 템플릿을 최신 버전과 비교하여 업데이트합니다.

```tool
harness_update({ projectRoot: "<감지된 프로젝트 루트>", acceptAll: true, refreshOntology: true })
```

### Phase 3: Local MCP 충돌 확인

프로젝트 `.mcp.json`에 `carpdm-harness`가 Local MCP로 등록되어 있는지 확인합니다.

```bash
# .mcp.json에서 carpdm-harness 항목 확인
cat .mcp.json 2>/dev/null | grep -c "carpdm-harness"
```

Local MCP로 등록되어 있으면:
- 사용자에게 안내: "`.mcp.json`에서 `carpdm-harness` 항목을 제거하면 슬래시 커맨드와 훅이 정상 동작합니다."
- Plugin 시스템이 MCP 서버를 자동 제공하므로 수동 등록이 불필요합니다.

### Phase 4: 결과 보고

업데이트 결과를 요약합니다:
- 플러그인 버전 (이전 → 이후)
- 업데이트된 템플릿 파일 수
- 건너뛴 파일 수 (사용자 수정)
- Local MCP 충돌 여부

## 인자 매핑
- `"dry-run"` 포함 시 Phase 2에서 `dryRun: true` (변경 미적용, 미리보기만)
- `"플러그인만"` 포함 시 Phase 1만 실행
- `"템플릿만"` 포함 시 Phase 2만 실행
