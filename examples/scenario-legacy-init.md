# 시나리오: 레거시 프로젝트 초기화

> carpdm-harness v4.x 기준 MCP 도구 기반 워크플로우

## 전제 조건

- 6개월간 개발 중인 FastAPI + React 프로젝트 (코드 200파일, 테스트 50개)
- carpdm-harness 플러그인이 Claude Code에 설치됨
- 프로젝트에는 아직 harness 미적용

---

## Step 1: 셋업 (환경 분석)

```
harness_setup({ projectRoot: "/path/to/project" })
```

```
[carpdm-harness 셋업]
✓ OMC 설치 확인
감지된 도구: Serena, Context7

선택된 프리셋: secure (Serena 감지 → 코드 분석 + 보안 추천)

[다음 단계]
  harness_init({ projectRoot: "/path/to/project", preset: "secure" })
```

## Step 2: 초기화 (파일 생성)

```
harness_init({
  projectRoot: "/path/to/project",
  preset: "secure",
  enableOntology: true,
  ontologyLanguages: "fullstack"
})
```

```
[carpdm-harness 설치]
  프리셋: secure
  모듈: core, quality, security, ship, team-memory

✓ 모듈 설치: core (8개 파일)
✓ 모듈 설치: quality (3개 파일)
✓ 모듈 설치: security (2개 파일)
✓ 모듈 설치: ship (4개 파일)
✓ 모듈 설치: team-memory (2개 파일)
✓ 훅 11/11개 등록
✓ settings.local.json 부트스트랩 완료
✓ 온톨로지 생성 완료 (2340ms)
✓ ONTOLOGY-INDEX.md 생성 완료
✓ Knowledge Vault 초기화 완료 (.knowledge/)
✓ CLAUDE.md 기본 템플릿 생성
✓ CLAUDE.md 자동 섹션 갱신 완료

[설치 완료]
  설치됨 : 19개 파일
  건너뜀 : 0개 파일
  오류   : 0개
```

## Step 3: 동기화

```
harness_sync({ projectRoot: "/path/to/project" })
```

```
[상태 동기화]
  전체 동기화: 4개 항목
✓ CLAUDE.md 자동 섹션 갱신 완료
✓ 동기화 완료
```

## Step 4: 기존 테스트 확인

```bash
cd backend && pytest -q
# 50 passed, 0 failed ✓
# 기존 테스트가 깨지지 않음을 확인
```

---

## 생성된 파일 구조

```
existing-project/
├── CLAUDE.md                       ← 새로 생성 (프로젝트 지침)
├── carpdm-harness.config.json      ← 설정 파일
├── docs/templates/                 ← 문서 템플릿 (plan, todo, context 등)
├── skills/                         ← MCP 스킬 정의
├── agents/                         ← 에이전트 역할 정의
├── hooks/hooks.json                ← 훅 등록 매니페스트
├── .agent/                         ← 작업 상태 (gitignore)
│   ├── plan.md, todo.md, context.md
│   └── ontology/                   ← 3계층 온톨로지
├── .knowledge/                     ← 지식 베이스 (gitignore)
│   ├── workflows/                  ← 워크플로우 문서
│   └── ontology/                   ← 온톨로지 사본
├── .harness/                       ← 런타임 상태 (gitignore)
│
│ (기존 파일은 모두 그대로 유지)
├── frontend/                       ← 수정 안 함
├── backend/                        ← 수정 안 함
└── ...
```

## 핵심 포인트

1. **기존 소스 코드를 절대 수정하지 않음** — 워크플로우 파일만 추가
2. **harness_setup → harness_init** 2단계로 분리 (분석 → 설치)
3. **온톨로지가 기존 코드를 자동 분석** — 구조/시맨틱/도메인 3계층
4. **기존 테스트가 깨지지 않음을 검증** — 초기화 후 반드시 확인
