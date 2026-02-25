---
name: workflow
description: OMC 워크플로우 오케스트레이션. "워크플로우", "workflow", "파이프라인"을 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 `harness_workflow` MCP 도구를 호출하세요.

## 인자 매핑
- 워크플로우 이름(`feature`|`bugfix`|`refactor`|`release`|`security`)이면 `workflow`로 전달
- 이름 없이 호출하면 사용 가능한 워크플로우 목록 표시
- `"dry-run"` 포함 시 미리보기만

## 액션 (action 파라미터)
| 액션 | 설명 | 필수 파라미터 |
|------|------|-------------|
| `guide` (기본) | 워크플로우 가이드 출력 | `workflow?` |
| `start` | 워크플로우 실행 시작 | `workflow` |
| `advance` | 현재 단계 완료, 다음 진행 | `result?` |
| `status` | 활성 워크플로우 상태 조회 | - |
| `approve` | 체크포인트 승인 | - |
| `reject` | 체크포인트 거부 | `reason?` |
| `retry` | 실패 단계 재시도 | - |
| `skip` | 현재 단계 건너뛰기 | `reason?` |
| `abort` | 워크플로우 중단 | `reason?` |
| `list` | 최근 워크플로우 목록 | - |
| `history` | 이벤트 히스토리 | - |

## 실행 흐름
```
1. harness_workflow({ action: "start", workflow: "feature" })
2. (OMC 스킬 실행)
3. harness_workflow({ action: "advance", result: "결과 요약" })
4. (체크포인트 시) harness_workflow({ action: "approve" })
5. (반복)
6. 워크플로우 완료
```

## 가이드 모드 (기존 호환)
```tool
harness_workflow({ projectRoot: "<감지된 프로젝트 루트>", workflow: "feature" })
```

## 실행 엔진 모드
```tool
harness_workflow({ projectRoot: "<감지된 프로젝트 루트>", action: "start", workflow: "feature" })
```

## OMC 스킬 연동
워크플로우 결과에 포함된 OMC 스킬을 순서대로 실행하세요:

| 에이전트 | OMC 스킬 | 비고 |
|---------|---------|------|
| analyst | `/oh-my-claudecode:analyze` | 요구사항/원인 분석 |
| planner | `/oh-my-claudecode:plan` | 계획 수립 |
| architect | (수동) | OMC 스킬 없음, 직접 호출 |
| executor | `/oh-my-claudecode:autopilot` | 구현 자동 실행 |
| test-engineer | `/oh-my-claudecode:tdd` | TDD 사이클 |
| verifier | (자동 검증) | 스킬 불필요 |
| git-master | `/oh-my-claudecode:git-master` | 커밋/PR |
| explore | `/oh-my-claudecode:deepsearch` | 코드베이스 탐색 |
| debugger | `/oh-my-claudecode:analyze` | 디버깅/원인 분석 |
| quality-reviewer | `/oh-my-claudecode:code-review` | 품질 검토 |
| security-reviewer | `/oh-my-claudecode:security-review` | 보안 검토 |
| qa-tester | (수동) | OMC 스킬 없음 |

## 워크플로우별 추천 모드
- **feature/bugfix/refactor**: `/oh-my-claudecode:autopilot` (전체 파이프라인 자동 실행)
- **release**: 수동 단계별 실행 권장 (보안 검토 + QA 필요)
- **security**: `/oh-my-claudecode:security-review` 후 수동 패치
