# 시나리오: 레거시 프로젝트 초기화

이미 개발 중인 프로젝트에 Agent Harness를 적용하는 시나리오입니다.

## 전제 조건

- 6개월간 개발 중인 FastAPI + React 프로젝트
- 코드 약 200파일, 테스트 50개
- CI/CD: GitHub Actions
- Agent Harness는 설치했지만 프로젝트에 아직 적용 안 함

---

## Step 1: 초기화 실행

```
cd /path/to/existing-project
claude

사용자 입력:
> /project-init "이 프로젝트에 워크플로우 적용"
```

## Step 2: Auto-Discovery (자동 분석)

Claude가 코드베이스를 자동으로 분석합니다:

```
[Phase 1: 자동 분석 중...]

의존성 파일 스캔:
  ✓ package.json → React 18, Next.js 14, Tailwind CSS
  ✓ requirements.txt → FastAPI, SQLAlchemy, Pydantic, Redis
  ✓ docker-compose.yml → PostgreSQL, Redis

디렉토리 구조 분석:
  ✓ frontend/src/components/ → React 컴포넌트 구조
  ✓ backend/app/models/ → SQLAlchemy 모델
  ✓ backend/app/api/ → FastAPI 라우터
  ✓ backend/app/services/ → 서비스 레이어

도메인 용어 추출:
  ✓ 모델: User, Product, Order, Payment, Cart, Review
  ✓ API: /api/v1/users, /api/v1/products, /api/v1/orders

기존 규약 분석:
  ✓ 테스트: pytest (backend/tests/, 50개 파일)
  ✓ CI: GitHub Actions (.github/workflows/ci.yml)
  ✓ Lint: ruff (pyproject.toml), ESLint (.eslintrc.js)
  ✓ 포맷: black (Python), prettier (JS/TS)
```

## Step 3: 분석 결과 확인 인터뷰 (간소화)

```
Claude:
  [자동 감지 결과]
  - 기술 스택: Next.js 14 + FastAPI + PostgreSQL + Redis
  - 아키텍처: 레이어드 (models → services → api)
  - 테스트: pytest 기반 (50개 파일)
  - CI/CD: GitHub Actions
  - 패키지 매니저: npm (프론트), pip (백엔드)
  - 도메인 용어: User, Product, Order, Payment, Cart, Review

Q1: "위 분석 결과가 맞나요? 수정할 부분이 있으면 알려주세요."
   사용자: "맞아. Store 레이어는 없고 Repository 패턴을 쓰고 있어."

Q2: "추가로 AI가 알아야 할 핵심 도메인 규칙이 있나요?"
   사용자: "주문은 반드시 결제 완료 후에만 확정돼.
            환불은 7일 이내만 가능."

Q3: "프로젝트의 현재 주요 과제는?"
   사용자: "성능 최적화랑 검색 기능 고도화"
```

## Step 4: 워크플로우 파일 생성

기존 코드를 **절대 수정하지 않고** 워크플로우 파일만 추가합니다:

```
생성되는 파일들:

existing-project/
├── CLAUDE.md                      ← 새로 생성 (기존 코드 반영)
├── docs/
│   ├── conventions.md             ← 새로 생성 (기존 패턴 기반)
│   └── templates/
│       ├── plan-template.md       ← 새로 생성
│       ├── todo-template.md       ← 새로 생성
│       └── context-template.md    ← 새로 생성
├── .claude/
│   ├── commands/                  ← 새로 생성 (7개)
│   ├── hooks/                     ← 새로 생성 (4개)
│   └── settings.local.json       ← 새로 생성
├── .omc/
│   └── project-memory.json       ← 새로 생성 (분석 결과)
├── .mcp.json                     ← 새로 생성
│
│ (기존 파일은 모두 그대로 유지)
├── .gitignore                    ← 항목 추가만 (기존 내용 보존)
├── README.md                     ← 수정 안 함
├── frontend/                     ← 수정 안 함
├── backend/                      ← 수정 안 함
└── ...
```

### 생성된 CLAUDE.md (일부)

```markdown
# E-Commerce Platform

## 개요
Next.js 14 + FastAPI 기반 이커머스 플랫폼.
주문-결제-배송 도메인으로 구성.

## 기술 스택
- 프론트엔드: Next.js 14, React 18, Tailwind CSS
- 백엔드: FastAPI, SQLAlchemy, Pydantic
- 데이터베이스: PostgreSQL, Redis (캐시)
- 테스트: pytest
- CI/CD: GitHub Actions

## 개발 명령어
- 프론트 실행: `cd frontend && npm run dev`
- 백엔드 실행: `cd backend && uvicorn app.main:app --reload`
- 테스트: `cd backend && pytest`
- 린트: `ruff check .` (Python), `npm run lint` (JS/TS)

## 아키텍처 — Repository 패턴
Model → Repository → Service → API Route
- 도메인 로직은 Service에 위치
- Repository는 데이터 접근만 담당
- Route는 Service만 호출

## 도메인 용어 (Ubiquitous Language)
| 용어 | 의미 |
|------|------|
| User | 사용자 (구매자/판매자) |
| Product | 상품 |
| Order | 주문 (결제 완료 후 확정) |
| Payment | 결제 |
| Cart | 장바구니 |
| Review | 상품 리뷰 |

## 핵심 도메인 규칙
1. 주문 확정: 결제 완료 후에만 가능
2. 환불: 주문 후 7일 이내만 가능
...
```

## Step 5: 기존 테스트 실행 확인

```bash
cd backend && pytest -q
# 50 passed, 0 failed ✓

# 기존 테스트가 깨지지 않음을 확인
```

## Step 6: 완료 보고

```
========================================
  /project-init 완료
========================================

자동 감지:
  ✓ 기술 스택: Next.js 14 + FastAPI + PostgreSQL + Redis
  ✓ 아키텍처: Repository 패턴
  ✓ 도메인: User, Product, Order, Payment, Cart, Review

생성된 파일:
  ✓ CLAUDE.md (기존 코드 분석 반영)
  ✓ docs/conventions.md (기존 패턴 기반)
  ✓ .claude/commands/ (7개 커맨드)
  ✓ .claude/hooks/ (4개 훅)
  ✓ docs/templates/ (3개 템플릿)
  ✓ .omc/project-memory.json
  ✓ .mcp.json

기존 코드 영향: 없음
  ✓ 소스 코드 미변경
  ✓ 기존 테스트 50개 전부 통과
  ✓ README.md 미변경

다음 단계:
  이제 작업을 시작하면 자동으로 Plan-First 워크플로우가 적용됩니다.
  기존 코드의 패턴이 CLAUDE.md와 conventions.md에 반영되어 있으니,
  AI가 기존 스타일을 따릅니다.
```

---

## 핵심 포인트

1. **기존 소스 코드를 절대 수정하지 않는다** — 워크플로우 파일만 추가
2. **Auto-Discovery**로 수동 입력을 최소화 — 대부분 자동 감지
3. **기존 패턴을 존중** — Repository 패턴으로 감지되면 DDD의 Store 대신 Repository 용어 사용
4. **기존 테스트가 깨지지 않음을 검증** — 초기화 후 반드시 확인
