# carpdm-harness

AI 협업 워크플로우 모듈화 CLI — Plan-First + DDD + SPARC + External Memory

기존 `agent_harness`의 bash 기반 설치 방식을 TypeScript npm CLI 패키지로 전환하여, **모듈화**, **버전 관리**, **diff 기반 업데이트**를 지원합니다.

## 설치

```bash
# npx로 직접 실행
npx github:skdkfk8758/carpdm_harness init

# 글로벌 설치
npm i -g github:skdkfk8758/carpdm_harness
```

## 빠른 시작

```bash
# 대화형 설치 (추천)
carpdm-harness init

# 비대화형 설치 (standard 프리셋)
carpdm-harness init --preset standard --yes

# TDD 포함 설치
carpdm-harness init --preset tdd --yes --global
```

## 커맨드

| 커맨드 | 설명 |
|--------|------|
| `init` | 프로젝트에 워크플로우 설치 |
| `update` | 설치된 템플릿 diff 기반 업데이트 |
| `migrate` | 기존 agent_harness → carpdm-harness 전환 |
| `list` | 모듈/프리셋 목록 표시 |
| `info` | 현재 설치 상태 표시 |
| `doctor` | 설치 건강 진단 |
| `ontology` | 프로젝트 온톨로지 생성/관리 |

### init 옵션

```
--preset <name>    프리셋 선택 (full|standard|minimal|tdd)
--modules <list>   모듈 직접 지정 (쉼표 구분)
--global           글로벌 커맨드도 설치 (~/.claude/commands/)
--skip-hooks       훅 등록 건너뛰기
--dry-run          미리보기만
--yes              비대화형 모드
--ontology         온톨로지 강제 활성화
--skip-ontology    온톨로지 설정 건너뛰기
```

### update 옵션

```
--all              전체 모듈 업데이트
--module <name>    특정 모듈만
--global           글로벌 커맨드도 업데이트
--dry-run          diff만 표시
--accept-all       모든 변경 수락
--refresh-ontology 온톨로지 갱신
--skip-ontology    온톨로지 갱신 건너뛰기
```

## 모듈 시스템

7개 모듈로 구성되며, 각 모듈은 커맨드(`.claude/commands/`), 훅(`.claude/hooks/`), 문서 템플릿을 포함합니다.

| 모듈 | 설명 | 의존성 | 커맨드 | 훅 | 문서 |
|------|------|--------|--------|-----|------|
| **core** | Plan-First + SPARC + External Memory | 없음 | 3 | 3 | 4 |
| **tdd** | Red-Green-Refactor + 자동 차단 | core | 1 | 1 | 0 |
| **quality** | 품질 게이트 + 교차 검증 + 변경 추적 | core | 3 | 1 | 0 |
| **ship** | 논리 커밋 + PR 생성 | core | 2 | 0 | 0 |
| **maintenance** | 환경 업데이트 | 없음 | 1 | 0 | 0 |
| **patterns** | 패턴 클로닝 | core | 1 | 0 | 0 |
| **ontology** | 3계층 통합 온톨로지 (구조맵 + 시맨틱 + 도메인) | core | 2 | 1 | 1 |

## 프리셋

| 프리셋 | 모듈 | 설명 |
|--------|------|------|
| `standard` (추천) | core, quality, ship | 일반 프로젝트 |
| `full` | 전체 7개 | 완전한 워크플로우 (온톨로지 포함) |
| `tdd` | core, tdd, quality, ship | TDD 중심 |
| `minimal` | core | 최소 구성 |

## Update 흐름

`carpdm-harness update`는 파일별 SHA-256 해시를 비교하여 3가지 상태를 판별합니다:

- **UPSTREAM_CHANGED**: 사용자 미수정 + 템플릿 변경 → 자동 업데이트 후보
- **USER_MODIFIED**: 사용자 수정 + 템플릿 미변경 → 건너뛰기
- **CONFLICT**: 양쪽 모두 변경 → 사용자에게 선택 요청

```
carpdm-harness update              # 대화형
carpdm-harness update --accept-all # 모든 변경 수락
carpdm-harness update --dry-run    # diff만 미리보기
```

## 마이그레이션 (기존 agent_harness 사용자)

```bash
# 기존 파일 자동 감지 → 모듈 매핑 → 설치
carpdm-harness migrate

# 미리보기
carpdm-harness migrate --dry-run
```

## 설정 파일

`carpdm-harness.config.json`이 프로젝트 루트에 생성되며, 설치 상태를 추적합니다:

```json
{
  "version": "1.0.0",
  "preset": "standard",
  "modules": ["core", "quality", "ship"],
  "files": {
    ".claude/commands/plan-gate.md": {
      "module": "core",
      "version": "1.0.0",
      "hash": "sha256:abc123..."
    }
  }
}
```

## 보호 파일

다음 파일/디렉토리는 절대 수정하거나 삭제하지 않습니다:

- `CLAUDE.md`
- `.agent/` 디렉토리 전체
- `.omc/` 디렉토리 전체
- `.mcp.json`

## 개발

```bash
git clone https://github.com/skdkfk8758/carpdm_harness.git
cd carpdm_harness
npm install
npm run build
node dist/index.js list
```

## 라이센스

MIT
