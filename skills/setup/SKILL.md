---
name: harness-setup
description: OMC 기반 원스톱 프로젝트 셋업. "harness 셋업", "프로젝트 셋업", "setup"을 요청할 때 사용합니다.
---

# carpdm-harness Setup

프로젝트에 carpdm-harness AI 협업 워크플로우를 설치합니다.
OMC 환경을 검증하고, 프로젝트 특성에 맞는 프리셋을 추천하며, 일괄 설정을 수행합니다.

## 전제 조건

- oh-my-claudecode (OMC) 플러그인 설치 필수
- 미설치 시: `/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode` → `/plugin install oh-my-claudecode` 안내
- Node.js >= 20

## 실행 흐름

### Step 0: 프로젝트 루트 감지
- `git rev-parse --show-toplevel` 또는 현재 작업 디렉토리에서 `package.json`/`CLAUDE.md` 존재 확인
- 루트를 찾지 못하면 사용자에게 경로를 질문

### Step 1: 환경 진단
`harness_doctor` MCP 도구를 먼저 호출하여:
- OMC 설치 여부 및 버전 확인
- 외부 도구 감지 (Serena, Context7 등)
- 기존 harness 설치 여부 확인
- 문제 발견 시 사용자에게 보고하고 계속 진행 여부 확인

### Step 2: 프리셋 선택
사용자가 프리셋을 명시하지 않았으면:
- 프로젝트 특성 감지 (테스트 프레임워크 존재, 보안 관련 파일 등)
- 4개 프리셋 중 추천:
  - `standard` — 일반 프로젝트 (core + quality + ship + team-memory)
  - `full` — 전체 9개 모듈
  - `tdd` — TDD 중심 (core + tdd + quality + ship)
  - `secure` — 보안 중심 (core + quality + security + ship)
- 추천 이유를 설명하고 사용자 선택 대기

### Step 3: 셋업 실행
```tool
harness_setup({ projectRoot: "<감지된 프로젝트 루트>", preset: "<선택된 프리셋>" })
```

### Step 4: 결과 확인
셋업 결과를 사용자에게 표시:
- 설치된 모듈 목록
- 생성된 파일 목록 (.agent/, hooks.json, CLAUDE.md 변경 등)
- 활성화된 훅 목록
- 발견된 외부 도구

### Step 5: 후속 안내
셋업 완료 후 사용자에게 다음 단계를 안내:
1. `/carpdm-harness:harness-doctor` — 건강 진단으로 정상 설치 확인
2. `/carpdm-harness:harness-workflow` — 사용 가능한 워크플로우 확인
3. `/carpdm-harness:harness-ontology-generate` — 프로젝트 온톨로지 생성 (권장)
4. `/carpdm-harness:harness-dashboard` — 대시보드로 전체 상태 조회

## 인자 매핑

| 사용자 입력 | 매핑 |
|-------------|------|
| 프리셋 이름 (`full`, `standard`, `tdd`, `secure`) | `preset` 파라미터 |
| `"dry-run"`, `"시뮬레이션"` | `dryRun: true` |
| 프로젝트 경로 | `projectRoot` 파라미터 |
| 없음 | 자동 감지 + `preset: "standard"` |

## 기존 설치 감지

이미 harness가 설치된 프로젝트인 경우:
- `.harness/state.json` 또는 `.agent/` 디렉토리 존재 확인
- 기존 설정을 유지하면서 업데이트할지, 새로 설치할지 사용자에게 확인
- 업데이트 시 `/carpdm-harness:harness-update`로 안내

## 에러 처리

- OMC 미설치: 설치 가이드 출력 후 중단
- 권한 문제: 파일 쓰기 실패 시 원인과 해결 방법 안내
- 네트워크 오류: 오프라인 모드로 기본 템플릿 사용
