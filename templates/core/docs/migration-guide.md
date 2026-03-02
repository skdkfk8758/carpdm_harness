# 파일/폴더 마이그레이션 가이드

> carpdm-harness v4.11.x 기준 `.agent/`, `.knowledge/`, `.obsidian/` 정리 가이드

---

## 1. 현재 상태 분석

### 디렉토리 역할 및 Git 추적 여부

| 디렉토리 | 역할 | Git 추적 | .gitignore |
|----------|------|----------|------------|
| `.agent/` | 에이전트 작업 상태 (계획, TODO, 온톨로지 캐시) | **X** | **O** (명시됨) |
| `.knowledge/` | 로컬 지식 저장소 (Obsidian vault) | **X** | **X** (미명시 → untracked 노이즈) |
| `.obsidian/` | Obsidian IDE 설정 | **X** | **X** (미명시 → untracked 노이즈) |

> **현재 3개 디렉토리 모두 git에 추적되지 않습니다.**
> 다만 `.knowledge/`와 `.obsidian/`는 `.gitignore`에 미등록이라 `git status`에 untracked로 표시됩니다.

### 온톨로지 파일 이중 존재 문제

```
.agent/ontology/                          .knowledge/ontology/
├── ONTOLOGY-STRUCTURE.md  ──────────→    ├── structure.md    (+ frontmatter)
├── ONTOLOGY-SEMANTICS.md  ──────────→    ├── semantics.md    (+ frontmatter)
├── ONTOLOGY-DOMAIN.md     ──────────→    ├── domain.md       (+ frontmatter)
├── ONTOLOGY-INDEX.md                     └── (없음)
└── .cache/
    ├── ontology-cache.json (1.1MB)
    └── domain-cache.json   (8.4K)
```

**동기화 흐름:** `.agent/ontology/` (원본) → `syncOntologyToVault()` → `.knowledge/ontology/` (사본+frontmatter)

**호출 시점:** `harness_init`, `harness_update` 실행 시

**문제점:**
- `.agent/`는 gitignore되어 있으므로 온톨로지 원본은 로컬에만 존재
- `.knowledge/ontology/`는 git에 추적되므로 팀원과 공유 가능
- 타임스탬프 불일치: `.agent`(2026-02-24) vs `.knowledge`(2026-03-01) → 동기화 시점이 달라 내용 불일치
- ONTOLOGY-INDEX.md는 `.knowledge/`에 동기화되지 않음

---

## 2. 디렉토리별 상세 내역

### `.agent/` (로컬 작업 상태 — gitignore됨)

| 파일 | 용도 | 자동/수동 | 비고 |
|------|------|----------|------|
| `plan.md` | 작업 계획 (SDD 기반) | 수동 | /plan-gate 스킬이 생성 |
| `todo.md` | 체크리스트 | 수동 | ← CURRENT 마커 추적 |
| `context.md` | 결정/트레이드오프 기록 | 수동 | |
| `lessons.md` | 교훈 기록 | 수동 | Self-Improvement Loop |
| `memory.md` | 팀 메모리 동기화 사본 | 자동 | `syncMemoryMd()` |
| `handoff.md` | 에이전트 핸드오프 | 자동 | session-end에서 생성 |
| `session-log.md` | 세션 이력 | 자동 | |
| `ontology/*.md` | 3계층 온톨로지 | 자동 | `harness_ontology_generate` |
| `ontology/.cache/` | 온톨로지 캐시 (1.1MB) | 자동 | 점진적 갱신용 |

### `.knowledge/` (공유 지식 저장소 — git 추적)

| 경로 | 용도 | 내용 상태 |
|------|------|----------|
| `_index.md` | Vault 인덱스 (Obsidian 호환) | 자동 생성 |
| `_templates/` | Knowledge 문서 템플릿 | **비어있음** — 삭제 가능 |
| `ontology/structure.md` | 구조 레이어 사본 | `.agent/` 사본 (stale 가능) |
| `ontology/semantics.md` | 시맨틱 레이어 사본 | `.agent/` 사본 (stale 가능) |
| `ontology/domain.md` | 도메인 레이어 사본 | `.agent/` 사본 (stale 가능) |
| `branches/` | 브랜치별 설계 문서 | **비어있음** |
| `branches/_archive/` | 머지된 브랜치 아카이브 | **비어있음** |
| `domains/` | 도메인별 지식 문서 | **비어있음** |
| `workflows/*.md` | 하니스 워크플로우 문서 (11개) | **핵심 문서** |

### `.obsidian/` (IDE 설정)

| 파일 | 용도 |
|------|------|
| `app.json` | Obsidian 앱 설정 |
| `appearance.json` | 테마/외관 설정 |
| `core-plugins.json` | 코어 플러그인 목록 |
| `workspace.json` | 마지막 작업 공간 상태 |
| `themes/Minimal/` | Minimal 테마 |

---

## 3. 마이그레이션 권장사항

### 3-A: `.knowledge/`, `.obsidian/` → `.gitignore` 추가

**이유:** 현재 git에 추적되지 않지만 `.gitignore`에도 없어서 `git status`에 untracked 노이즈로 표시됨.

```bash
# .gitignore에 추가
echo '.knowledge/' >> .gitignore
echo '.obsidian/' >> .gitignore
```

> `.knowledge/`를 팀 공유용으로 git에 추적하려면 이 단계를 건너뛰고 `git add .knowledge/`을 대신 수행하세요.
> 단, `.obsidian/`은 개인 IDE 설정이므로 항상 gitignore 권장.

### 3-B: `.knowledge/_templates/` 빈 디렉토리 정리

**이유:** 현재 비어있고, 템플릿은 `templates/knowledge/`에 있음 (플러그인 패키지 내).

```bash
rm -rf .knowledge/_templates/
```

### 3-C: `.knowledge/branches/`, `.knowledge/domains/` 정리 판단

**현재:** 비어있는 디렉토리 (미사용)

**선택지:**
1. **유지** — 향후 브랜치/도메인 문서를 여기에 저장할 계획이면 유지
2. **삭제** — 사용 시점에 `harness_init`이 자동 생성하므로 삭제해도 무방

```bash
# 삭제할 경우
rm -rf .knowledge/branches/ .knowledge/domains/
```

### 3-D: 온톨로지 이중 저장 판단 (핵심)

현재 온톨로지가 2곳에 존재합니다:
- `.agent/ontology/` — 원본 (gitignore, 로컬)
- `.knowledge/ontology/` — 사본 (로컬, untracked)

두 곳 모두 **로컬 전용**이므로 이중 저장의 "공유" 가치가 현재는 없습니다.

**선택지:**
1. **현재 유지** — Obsidian vault로 `.knowledge/`를 열면 온톨로지도 탐색 가능
2. **`.knowledge/ontology/` 제거** — `.agent/ontology/`만 유지, 불필요한 사본 제거
3. **`.knowledge/`를 git 추적** — 팀 공유를 원하면 git add하여 사본을 공유용으로 활용

**권장: 선택지 1 (현재 유지) 또는 3 (git 추적 시작)**

`.knowledge/`를 git에 추적하지 않을 거라면 사본을 유지할 이유가 약해집니다.
git에 추적할 거라면 현재 구조(원본+사본)가 합리적입니다.

### 3-E: `.knowledge/workflows/` — 핵심 문서 유지

11개 워크플로우 문서는 프로젝트 아키텍처 이해에 필수적입니다. 최적화 후 변경된 내용을 반영해야 합니다.

**갱신이 필요한 파일:**
| 파일 | 갱신 사유 |
|------|----------|
| `core-modules.md` | behavioral guard 3→1 통합, plugin-registry 삭제 반영 |
| `hooks.md` | hooks.json 중복 매처 제거, 타임아웃 추가 반영 |

---

## 4. 정리 체크리스트

```
[ ] .obsidian/ → .gitignore 추가 + git rm --cached
[ ] .knowledge/_templates/ 삭제 (비어있음)
[ ] .knowledge/branches/, domains/ 삭제 여부 결정
[ ] .knowledge/workflows/core-modules.md 업데이트
[ ] .knowledge/workflows/hooks.md 업데이트
[ ] harness_ontology_generate 후 자동 syncOntologyToVault() 호출 추가 검토
```

---

## 5. 최종 목표 구조

```
프로젝트 루트/
├── .agent/                    ← gitignore (로컬 작업 상태)
│   ├── plan.md, todo.md, ...
│   └── ontology/              ← 온톨로지 원본 + 캐시
│       ├── ONTOLOGY-*.md
│       └── .cache/
│
├── .knowledge/                ← git 추적 (팀 공유 지식)
│   ├── _index.md              ← vault 인덱스
│   ├── ontology/              ← 온톨로지 공유 사본
│   │   ├── structure.md
│   │   ├── semantics.md
│   │   └── domain.md
│   └── workflows/             ← 워크플로우 문서 (11개)
│       ├── README.md
│       ├── core-modules.md
│       └── ...
│
├── .obsidian/                 ← gitignore (개인 IDE 설정)
│
└── carpdm-harness.config.json
```

---

## 6. 참고: 코드 내 경로 관리

모든 `.knowledge/` 경로는 `src/core/omc-compat.ts`에서 중앙화되어 관리됩니다:

```typescript
knowledgeDir(projectRoot)         // .knowledge/
knowledgeBranchesDir(projectRoot) // .knowledge/branches/
knowledgeBranchDir(projectRoot, branch) // .knowledge/branches/{branch}/
knowledgeDomainsDir(projectRoot)  // .knowledge/domains/
knowledgeOntologyDir(projectRoot) // .knowledge/ontology/
knowledgeTemplatesDir(projectRoot)// .knowledge/_templates/
knowledgeIndexPath(projectRoot)   // .knowledge/_index.md
```

경로를 변경해야 할 경우 `omc-compat.ts`만 수정하면 됩니다.
