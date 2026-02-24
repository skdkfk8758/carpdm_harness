# Project Setup — AI 협업 환경 원스톱 구축

새 프로젝트에 Plan-First + DDD + SPARC + External Memory + Vibe Coder 전략 워크플로우를 한번에 세팅한다.

## Argument: $ARGUMENTS
프로젝트 설명 (예: "FastAPI + React 쇼핑몰", "Next.js SaaS 대시보드")

## Instructions

### Phase 0: 환경 확인
1. Node.js, npm 설치 여부 확인: `node --version && npm --version`
2. Claude Code CLI 확인: `claude --version`
3. Git 초기화 여부 확인: `git status`
4. 미초기화 시: `git init && git add -A && git commit -m "chore: initial commit"`
5. Git worktree 지원 확인: `git worktree list` (병렬 작업 준비)

### Phase 1: 플러그인 설치
아래 명령을 **순서대로** 실행한다:

**oh-my-claudecode (멀티 에이전트 오케스트레이션):**
```bash
claude plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
claude plugin install oh-my-claudecode
```
설치 후: `/omc-setup` 실행

**OMC 글로벌 설정 (보수적 팀 모드 + 작업 노티):**
`~/.claude/.omc-config.json`에 아래 설정이 없으면 추가/병합한다:
```json
{
  "defaultExecutionMode": "team",
  "team": {
    "maxAgents": 3,
    "defaultAgentType": "executor",
    "defaultModel": "sonnet",
    "monitorIntervalMs": 30000,
    "shutdownTimeoutMs": 15000
  },
  "notifications": {
    "verbosity": "agent",
    "console": true
  }
}
```
- `defaultExecutionMode: "team"`: 순차 파이프라인(plan→prd→exec→verify) 기반 보수적 실행. ultrawork 대비 비용 예측 가능.
- `maxAgents: 3`: 팀 규모 제한 (2인: executor+verifier, 3인: planner+executor+verifier)
- `notifications.verbosity: "agent"`: 에이전트 스폰/완료 + 세션 이벤트를 콘솔에 알림
- 외부 플랫폼(Telegram/Discord/Slack) 연동이 필요하면: `/oh-my-claudecode:configure-notifications` 실행

**Statusline (HUD) 설정:**
`~/.claude/settings.json`에 statusLine 설정이 없으면 추가한다:
```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/hud/omc-hud.mjs"
  }
}
```
- OMC HUD가 모델명, 컨텍스트 사용률, 토큰/비용, 캐시 히트율, 활성 모드(ralph/autopilot/team) 상태를 실시간 표시
- HUD 로더(`~/.claude/hud/omc-hud.mjs`)는 `/omc-setup` 실행 시 자동 생성됨
- 로더 미존재 시: `/oh-my-claudecode:hud` 스킬로 수동 설정

**claude-octopus (멀티 AI 합의 시스템):**
```bash
claude plugin marketplace add https://github.com/nyldn/claude-octopus.git
claude plugin install claude-octopus@nyldn-plugins
```
설치 후: `/octo:setup` 실행

**carpdm-harness (워크플로우 엔진):**
```bash
claude mcp add -s user carpdm-harness -- node /Users/carpdm/Workspace/Github/carpdm_harness/dist/server.js
```
이미 설치된 경우 스킵. (참고용 — 플러그인을 통해 자동 설정된 경우 불필요)

### Phase 2: MCP 서버 + 교차 검증 CLI 설치

#### 2-1. 공통 MCP (항상 설치)
```bash
claude mcp add -s project sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
claude mcp add -s project memory -- npx -y @modelcontextprotocol/server-memory --dir .omc/memory
```
이미 설치된 MCP (보통 기본 제공): github, filesystem, context7

#### 2-2. 교차 검증 CLI 확인 및 설치

교차 검증(Cross-Verification)에 사용되는 외부 AI CLI를 확인한다. OMC 플러그인이 자동으로 연동한다.

**Codex CLI (교차 검증 핵심 — 권장):**
```bash
# 설치 확인
codex --version 2>/dev/null || npm install -g @openai/codex
```
- 역할: 코드 작성 후 다른 AI 모델(GPT)이 리뷰 → 편향 보완
- 필요: OpenAI API 키 (`~/.codex/config.toml` 또는 `OPENAI_API_KEY` 환경변수)
- 미설치 시: Claude 서브에이전트(code-reviewer)로 자동 fallback

**Gemini CLI (디자인/대용량 리뷰 — 선택):**
```bash
# 설치 확인
gemini --version 2>/dev/null || npm install -g @google/gemini-cli
```
- 역할: UI/UX 리뷰, 1M 토큰 컨텍스트로 대규모 코드 분석
- 필요: Google API 키 (`GEMINI_API_KEY` 환경변수)

**API 키 미설정 시:** 사용자에게 안내 메시지를 출력하고, 나중에 설정할 수 있도록 건너뛴다. 교차 검증은 Claude 서브에이전트로 fallback 된다.

#### 2-3. 조건부 MCP (인터뷰 후 Phase 4에서 설치)

인터뷰 결과에 따라 Phase 4에서 아래 MCP를 추가로 설치한다:

| 인터뷰 답변 | 추가 MCP | 설치 명령 |
|------------|----------|----------|
| 프론트엔드 선택 + E2E 테스트 | Playwright | `claude mcp add -s project playwright -- npx -y @playwright/mcp@latest` |
| DB: Supabase | Supabase | `claude mcp add -s project supabase -- npx -y @supabase/mcp-server-supabase@latest --access-token $TOKEN` |
| 모니터링: Sentry | Sentry | `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp` |

### Phase 3: 인터뷰 (Full Discovery)

**사용자에게 아래 6개 영역을 순차적으로 질문한다.** AskUserQuestion 도구를 활용한다.

#### 3-1. 기술 스택 (Technical Stack)
질문 항목:
- 프론트엔드 프레임워크? (React/Next.js, Vue/Nuxt, Angular, Svelte, None)
- 백엔드 프레임워크? (FastAPI, NestJS, Express, Spring Boot, Django, Rails, Go, None)
- 데이터베이스? (PostgreSQL, MySQL, MongoDB, SQLite, Supabase, None)
- 캐시/큐? (Redis, Kafka, RabbitMQ, None)
- 모바일? (React Native, Flutter, SwiftUI, Kotlin, None)
- CSS 프레임워크? (Tailwind, styled-components, CSS Modules, None)
- 패키지 매니저? (npm, pnpm, yarn, bun, pip, poetry)

**최신 기술스택 가이드 (2026.02 기준):**
사용자가 특별히 버전을 지정하지 않으면 아래 최신 안정 버전을 기본으로 안내한다:

| 기술 | 최신 안정 버전 | 비고 |
|------|-------------|------|
| Node.js | v24 LTS | v25는 Current |
| Python | 3.13+ | 3.14는 beta |
| Next.js | 15.x | App Router 기본 |
| React | 19.x | Server Components |
| Vue | 3.5+ | Composition API |
| Nuxt | 3.x | Nitro 서버 엔진 |
| FastAPI | 0.115+ | Pydantic v2 |
| NestJS | 11.x | ESM 지원 |
| Tailwind CSS | 4.x | CSS-first 설정 |
| TypeScript | 5.7+ | 최신 타입 기능 |
| pnpm | 10.x | 권장 패키지 매니저 |
| Bun | 1.2+ | 올인원 런타임 |

사용자에게 "최신 안정 버전을 권장합니다. 특정 버전이 필요하면 말씀해주세요."라고 안내한다.

#### 3-2. AI 페르소나 & 역할 설정 (Persona & MOE)
질문 항목:
- 프로젝트 유형? (웹 개발, 모바일 앱, 데이터 파이프라인, 인프라/DevOps, 기타)
- AI에게 기대하는 전문 역할? (풀스택 개발자, 프론트엔드 전문가, 백엔드 전문가, 데이터 엔지니어, 기타)

**답변 기반 자동 MOE(Mixture of Experts) 페르소나 생성:**

| 프로젝트 유형 + 역할 | 생성 페르소나 |
|-------------------|------------|
| 웹 + 풀스택 | "10년차 풀스택 시니어 개발자. React/Next.js + Node.js/Python 백엔드 전문. 성능 최적화, 보안, DX에 강점" |
| 웹 + 프론트엔드 | "10년차 프론트엔드 시니어 개발자. React/Vue 생태계 전문. 접근성(a11y), 반응형 디자인, 번들 최적화에 강점" |
| 웹 + 백엔드 | "10년차 백엔드 시니어 개발자. API 설계, DB 최적화, 시스템 아키텍처 전문. 확장성과 안정성에 강점" |
| 모바일 | "10년차 모바일 시니어 개발자. 크로스플랫폼(RN/Flutter) 또는 네이티브(Swift/Kotlin) 전문. UX 성능 최적화에 강점" |
| 데이터 | "10년차 데이터 엔지니어. ETL 파이프라인, 데이터 모델링, 분석 시스템 전문. 대규모 데이터 처리에 강점" |
| DevOps | "10년차 DevOps/SRE 엔지니어. CI/CD, IaC, 컨테이너 오케스트레이션 전문. 자동화와 안정성에 강점" |

페르소나는 CLAUDE.md의 `## AI 페르소나` 섹션에 기록한다. 사용자가 커스텀 페르소나를 원하면 자유 입력을 받는다.

#### 3-3. 아키텍처 & 도메인 (Architecture & Domain)
질문 항목:
- 아키텍처 패턴? (모놀리스, 마이크로서비스, 모듈러 모놀리스, 서버리스)
- DDD 적용 여부? (예/아니오/부분)
- 핵심 도메인(Bounded Context) 목록? (자유 입력)
- API 스타일? (REST, GraphQL, gRPC, tRPC)
- 인증 방식? (JWT, Session, OAuth, Clerk, Supabase Auth)
- 실시간 기능? (WebSocket, SSE, Polling, None)

#### 3-4. 비즈니스 컨텍스트 (Business Context)
질문 항목:
- 프로젝트의 한줄 설명? (자유 입력)
- 핵심 사용자(페르소나)? (자유 입력)
- 주요 유스케이스 3-5개? (자유 입력)
- 도메인 핵심 용어 5-10개? (Ubiquitous Language로 사용됨)

#### 3-5. 배포 & 운영 (Deployment & Operations)
질문 항목:
- 배포 환경? (Vercel, AWS, GCP, Azure, Docker, On-premise)
- CI/CD? (GitHub Actions, GitLab CI, CircleCI, None)
- 모니터링? (Prometheus+Grafana, DataDog, Sentry, None)
- 테스트 전략? (Unit + Integration, E2E 포함, TDD)
- **TDD 강제 수준?** (Block — 테스트 없으면 코드 수정 차단, Warn — 경고만 표시, Off — TDD 미적용)
  - Block 선택 시: Speed Mode에서 자동으로 Warn으로 완화됨을 안내
  - 기본값: Block (권장)

#### 3-6. 응답 언어 (Response Language)
질문 항목:
- AI 응답 언어? (한국어, English, 日本語, 中文, 기타)
- 코드 주석 언어? (응답 언어와 동일, English, 기타)

**기본값**: 한국어 (사용자가 건너뛰면 한국어로 설정)

**언어 정책 자동 생성 규칙:**

| 선택 언어 | CLAUDE.md 언어 정책 |
|----------|-------------------|
| 한국어 | "모든 응답, 코드 주석, 문서는 한국어로 작성한다. 커밋 메시지와 변수/함수명만 영문." |
| English | "All responses, code comments, and documentation must be written in English." |
| 日本語 | "すべての応答、コードコメント、ドキュメントは日本語で作成する。コミットメッセージと変数/関数名のみ英語。" |
| 中文 | "所有回复、代码注释和文档使用中文编写。提交信息和变量/函数名使用英文。" |
| 기타 | 사용자 지정 언어로 정책 생성 |

### Phase 4: 스킬 + 조건부 MCP 설치 (스택 기반 자동 선별)

인터뷰 결과를 기반으로 **해당 스택에 맞는 스킬과 MCP만** 설치한다.

#### 4-1. 조건부 MCP 설치 (Phase 2-3 매핑 기반)

인터뷰 3-1~3-5 결과를 확인하여 해당하는 MCP를 설치한다:

**프론트엔드(React/Vue/Svelte 등) + 테스트 전략(E2E 포함/TDD) 선택 시:**
```bash
claude mcp add -s project playwright -- npx -y @playwright/mcp@latest
```

**DB: Supabase 선택 시:**
```bash
claude mcp add -s project supabase -- npx -y @supabase/mcp-server-supabase@latest --access-token $SUPABASE_ACCESS_TOKEN
```
- 사용자에게 `SUPABASE_ACCESS_TOKEN`을 AskUserQuestion으로 요청한다.

**모니터링: Sentry 선택 시:**
```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```
- OAuth 인증 진행을 안내한다.

#### 4-2. 스택→스킬 매핑

**React/Next.js 선택 시:**
```bash
npx skilladd nicepkg/vercel-react-best-practices
npx skilladd nicepkg/frontend-design
npx skilladd nicepkg/web-design-guidelines
npx skilladd nicepkg/shadcn-ui
npx skilladd nicepkg/tailwind-design-system
npx skilladd nicepkg/nextjs-best-practices
```

**Vue/Nuxt 선택 시:**
```bash
npx skilladd nicepkg/vue-best-practices
npx skilladd nicepkg/frontend-design
npx skilladd nicepkg/web-design-guidelines
npx skilladd nicepkg/tailwind-design-system
```

**FastAPI 선택 시:**
```bash
npx skilladd nicepkg/fastapi-templates
npx skilladd nicepkg/api-design-principles
npx skilladd nicepkg/postgresql-table-design
```

**NestJS 선택 시:**
```bash
npx skilladd nicepkg/nestjs-best-practices
npx skilladd nicepkg/nodejs-backend-patterns
npx skilladd nicepkg/api-design-principles
```

**Express/Node 선택 시:**
```bash
npx skilladd nicepkg/nodejs-backend-patterns
npx skilladd nicepkg/api-design-principles
```

**PostgreSQL/Supabase 선택 시:**
```bash
npx skilladd nicepkg/supabase-postgres-best-practices
npx skilladd nicepkg/postgresql-table-design
```

**React Native/모바일 선택 시:**
```bash
npx skilladd nicepkg/react-native-best-practices
npx skilladd nicepkg/swiftui-expert-skill
```

**공통 (항상 설치):**
```bash
npx skilladd nicepkg/systematic-debugging
npx skilladd nicepkg/test-driven-development
npx skilladd nicepkg/code-review-excellence
npx skilladd nicepkg/git-advanced-workflows
npx skilladd nicepkg/e2e-testing-patterns
npx skilladd nicepkg/error-handling-patterns
```

추가 스킬이 필요하면 https://skills.sh 에서 검색하여 설치한다.

### Phase 5: 워크플로우 파일 생성

인터뷰 결과를 기반으로 아래 파일들을 자동 생성한다:

#### 5-1. CLAUDE.md (프로젝트 지침)
포함할 섹션:
- **언어 정책**: 인터뷰 3-6 결과 기반 (예: "모든 응답, 코드 주석, 문서는 한국어로 작성한다. 커밋 메시지와 변수/함수명만 영문.")
- **AI 페르소나**: 인터뷰 3-2 결과 기반 MOE 페르소나 (예: "10년차 풀스택 시니어 개발자...")
- 프로젝트 개요 (인터뷰 3-4 기반)
- 개발 명령어 (스택 기반, 최신 안정 버전 명시)
- 아키텍처 개요 (인터뷰 3-3 기반)
- AI Collaboration Standard:
  - **Persona & Communication** (MOE 페르소나 역할 수행, Edge Case First, No Guessing)
  - **Task Mode Control** (Speed/Safety/Standard 모드 자동 전환)
  - **SPARC Process** (Spec→Pseudocode→Architecture→Refinement→Completion)
  - **Self-Evolution** (지침서 자동 진화 - Living Document)
  - **Cross-Verification** (Codex/서브에이전트 자동 교차 검증 + 사용자 실환경 테스트)
  - **Self-Improvement Loop** (lessons.md 교훈 기록 + 세션 시작 시 자동 로드)
  - **Demand Elegance** (비자명 코드 제출 전 "더 우아한 방법?" 자문)
  - **Autonomous Bug Fixing** (버그는 질문 없이 직접 추적/수정)
  - **Think Before Coding** (가정 명시, 대안 제시, 혼란 시 멈춤 — Karpathy)
  - **Surgical Changes** (요청 범위만 수정, 인접 코드 개선 금지 — Karpathy)
  - **Goal-Driven Execution** (모호한 명령을 검증 가능 목표로 변환 — Karpathy)
  - **RPI Workflow** (Research→Plan→Implement: 계획 전 As-Is 조사 필수, 추측 금지, 실데이터 기반)
  - **Spec-First Modification** (수정 요청 → plan.md를 먼저 업데이트 → 재구현. Spec이 진실의 원천)
  - **Dumb Zone 방지** (컨텍스트 포화 신호 감지 시 세션 리셋: 같은 실수 반복, 품질 하락, 지시 흐림 → 요약 후 새 세션)
  - **SaaS Security Checklist** (웹/SaaS 프로젝트 감지 시 자동 삽입):
    CORS/Preflight, CSRF, XSS+CSP, SSRF, AuthN/AuthZ, RBAC/ABAC+테넌트격리,
    최소권한, Validation+SQLi 방어, RateLimit/Bruteforce,
    쿠키(HttpOnly·Secure·SameSite)+세션보안, Secret 관리+Rotation,
    HTTPS/HSTS+보안헤더, AuditLog, 에러노출 차단, 의존성 취약점 점검
    → "위 15항목을 전부 반영하고 테스트까지 통과한 결과만 제출"
  - Core Principles (Simplicity First, No Laziness, Minimal Impact, Think Before Coding, Surgical Changes, Plan-First, Domain Isolation, Ubiquitous Language, Pattern Copy, No Hallucination)
  - External Memory (.agent/plan.md, .agent/todo.md, .agent/context.md, .agent/lessons.md)
  - Pipeline Workflow (Pre-task → Plan Gate(SPARC) → Execution → Post-task)
  - Domain Map (인터뷰 3-3 도메인 목록 기반)
  - **Git Worktree 병렬 작업 가이드** (worktree별 독립 메모리, 훅 경로 해석, Team 모드 결합)
  - **보수적 팀 운영 가이드**:
    - 기본 실행 모드: `team` (순차 파이프라인: plan→prd→exec→verify→fix loop)
    - 최대 에이전트: 3명 (planner+executor+verifier 또는 executor+verifier)
    - 팀 스폰 전 interview-gate 통과 필수 (비사소한 작업)
    - 검증 증거 없이 완료 선언 금지 (RULE 5)
  - **작업 노티 설정 가이드**:
    - 콘솔 알림 (agent 레벨): 에이전트 스폰/완료, 세션 시작/종료/유휴
    - 외부 알림 필요 시: `/oh-my-claudecode:configure-notifications`로 Telegram/Discord/Slack 연동
  - Interview Workflow (설계 필요 시 자동 인터뷰)
  - Operational Checklist

#### 5-2. docs/conventions.md (프로젝트 규약)
포함할 내용:
- 아키텍처 패턴 (인터뷰 기반)
- 네이밍 컨벤션 (스택별)
- Ubiquitous Language 매핑 (인터뷰 3-4 용어)
- 파일 구조 패턴
- 에러 핸들링 규칙
- 테스트 표준

#### 5-3. .agent/ (작업 문서 폴더 — External Memory)
프로젝트 세팅 시 `.agent/` 폴더를 생성하고 아래 템플릿을 복사한다:
- `.agent/plan.md`: 계획서 (docs/templates/plan-template.md 기반)
- `.agent/todo.md`: TODO 트래커 (docs/templates/todo-template.md 기반)
- `.agent/context.md`: 의사결정 로그 (docs/templates/context-template.md 기반)
- `.agent/lessons.md`: 교훈 기록 (docs/templates/lessons-template.md 기반)

`.gitignore`에 `.agent/` 추가 (에이전트 작업 문서는 로컬 전용).
docs/templates/는 원본 템플릿으로 git-tracked 유지.

#### 5-4. carpdm-harness 워크플로우 설치

커맨드, 훅, 문서 템플릿을 한 번에 설치한다:

```
harness_init(
  projectRoot: PROJECT_ROOT,
  preset: "full",
  installGlobal: true,
  enableOntology: false
)
```

이 도구가 아래 항목을 자동 생성한다:
- `.claude/commands/` — 프로젝트 커맨드 (plan-gate, quality-guard, memory-manager 등)
- `.claude/hooks/` — 자동 훅 (pre-task, plan-guard, tdd-guard, code-change, post-task)
- `docs/templates/` — External Memory 템플릿 (plan, todo, context, lessons)
- `~/.claude/commands/` — 글로벌 커맨드 (project-setup, project-init, harness-init, harness-update 등)

**주의:** CLAUDE.md, docs/conventions.md, .agent/, .omc/project-memory.json, .claude/settings.local.json, .gitignore는 프로젝트별 커스터마이즈가 필요하므로 harness_init이 아닌 별도 단계에서 생성한다 (5-1 ~ 5-3, 5-5 ~ 5-9 유지).

#### 5-5. .claude/settings.local.json (훅 등록)
hooks 섹션에 5개 훅 등록 (`.gitignore`에 추가 — 로컬 전용).
TDD 활성 시 PreToolUse에 `tdd-guard.sh` 추가:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "bash .claude/hooks/plan-guard.sh" },
          { "type": "command", "command": "bash .claude/hooks/tdd-guard.sh" }
        ]
      }
    ]
  }
}
```

#### 5-6. .omc/hud-config.json (Statusline HUD 설정)
프로젝트별 HUD 표시 항목을 설정한다:
```json
{
  "elements": {
    "showModel": true,
    "showContext": true,
    "showCost": true,
    "showTokens": true,
    "showCache": true,
    "showCostPerHour": false,
    "showCwd": false,
    "maxOutputLines": 20
  },
  "staleTaskThresholdMinutes": 30
}
```
- 기본 표시: 모델명, 컨텍스트 사용률, 비용, 토큰, 캐시 히트율
- `showCostPerHour`: 장시간 작업 시 활성화 권장
- `staleTaskThresholdMinutes`: 이 시간 초과 시 작업을 stale로 표시

#### 5-7. .omc/project-memory.json (프로젝트 메모리)
인터뷰 결과 기반으로 techStack, conventions, build, userDirectives 설정.
인터뷰 3-5의 TDD 강제 수준 답변을 반영하여 tdd 설정 추가:
```json
{
  "tdd": {
    "enabled": true,
    "mode": "block",
    "speedModeWarn": true,
    "framework": "auto"
  }
}
```
- `enabled`: TDD 강제 수준이 Off가 아니면 `true`
- `mode`: Block 선택 시 `"block"`, Warn 선택 시 `"warn"`
- `speedModeWarn`: Block 모드에서 Speed Mode일 때 Warn으로 완화 (기본 `true`)
- `framework`: `"auto"` (자동 감지) 또는 인터뷰에서 지정한 프레임워크

#### 5-8. .gitignore 업데이트
- `.claude/settings.local.json` 추가 (머신별 권한 설정이므로 공유 불가)
- `.agent/` 추가 (에이전트 작업 문서는 로컬 전용 — plan, todo, context, lessons)
- `.claude/commands/`와 `.claude/hooks/`는 git-tracked (worktree에서 사용 가능하도록)

#### 5-9. Git Tracking 설정
```bash
# commands와 hooks는 git-tracked → 모든 worktree에서 사용 가능
git add .claude/commands/ .claude/hooks/ .gitignore
# settings.local.json은 .gitignore에 의해 자동 제외
```

### Phase 6: 검증
1. 훅 테스트: 각 .sh 파일 `bash -n`으로 문법 검증 + 실행하여 출력 확인
2. MCP 확인: `.mcp.json` 내용 검증
3. 스킬 확인: 설치된 스킬 목록 출력
4. CLAUDE.md 확인: 핵심 섹션 존재 여부
5. Git Tracking 확인: `.claude/commands/`와 `.claude/hooks/`가 tracked 상태인지 `git ls-files .claude/`로 검증
6. Worktree 호환성 확인: 훅 스크립트 내 `git rev-parse --show-toplevel` 패턴 존재 여부 검증
7. Statusline 확인: `~/.claude/settings.json`에 `statusLine` 설정 존재 + `~/.claude/hud/omc-hud.mjs` 파일 존재 여부

### Phase 7: 완료 보고
- 설치된 플러그인 목록
- 설치된 MCP 서버 목록 (공통 + 조건부)
- 교차 검증 CLI 상태: Codex CLI (설치/미설치), Gemini CLI (설치/미설치)
- 설치된 스킬 목록
- 생성된 파일 목록
- Git Tracking 상태: commands/hooks tracked, settings.local.json ignored
- Worktree 준비 상태: 훅 worktree-aware, External Memory 독립 운영 가능
- 교차 검증 준비 상태:
  - Codex CLI 설치 → "post-task.sh가 자동으로 Codex 교차 검증을 실행합니다"
  - Codex CLI 미설치 → "post-task.sh가 Claude 서브에이전트로 교차 검증합니다"
- OMC 설정 상태:
  - 실행 모드: `team` (보수적 순차 파이프라인)
  - 팀 규모: 최대 3명 (planner+executor+verifier)
  - 작업 노티: 콘솔 알림 (agent 레벨)
  - 외부 노티: 미설정 (필요 시 `/oh-my-claudecode:configure-notifications`)
  - Statusline: OMC HUD 활성 (모델, 컨텍스트, 비용, 토큰, 캐시율 표시)
- 다음 단계 안내: "이제 작업을 시작하면 자동으로 Plan-First 워크플로우가 적용됩니다. 코드 완성 시 교차 검증이 자동 실행됩니다. 병렬 작업 시 `EnterWorktree`로 독립 브랜치를 생성하세요. 팀 모드는 보수적(순차 파이프라인)으로 설정되어 있습니다."

## Vibe Coder 전략 (자동 적용)
이 세팅으로 구축되는 시스템에는 상위 1% 바이브코더 전략이 통합되어 있다:
1. **Living Document**: AI가 패턴 발견 시 지침서 업데이트 자동 제안 (Self-Evolution)
2. **Context Context**: "프로토타입"→Speed, "배포"→Safety 모드 자동 전환 (Task Mode Control)
3. **Multi-File 구조**: CLAUDE.md(헌법) + .agent/plan.md(계획) + .agent/todo.md(트래커) + .agent/context.md(기억) + .agent/lessons.md(교훈)
4. **SPARC 프로세스**: Spec→Pseudocode→Architecture→Refinement→Completion (Plan Gate 통합)
5. **Cross-Verification**: AI 코드→Codex/서브에이전트 자동 리뷰→사용자 실환경 테스트
6. **RPI + SDD**: Research(As-Is 조사)→Plan(Spec=기준점)→Implement(작게 실행) + 수정 시 Spec 먼저 갱신
7. **Dumb Zone 방지**: 컨텍스트 포화 신호 감지 → 확정 내용 요약 → context.md 기록 → 새 세션 리셋

## Simple → Full 전환 시 주의사항
- 기존 CLAUDE.md가 있으면 `CLAUDE.md.bak`으로 백업 후 새로 생성
- 기존 `.claude/hooks/plan-guard.sh`만 있는 경우 4개 훅으로 교체
- 기존 `.gitignore` 항목은 유지하고 새 항목만 추가
- 백업 명령: `cp CLAUDE.md CLAUDE.md.bak` (Phase 5 시작 전 자동 실행)

## Rules
- 각 Phase는 이전 Phase 완료 후 진행
- **응답 언어는 인터뷰 3-6에서 선택한 언어를 따른다** (기본값: 한국어. 커밋 메시지, 변수/함수명은 항상 영문)
- 인터뷰 질문은 AskUserQuestion 도구 사용
- **페르소나(MOE)는 인터뷰 3-2 결과를 기반으로 CLAUDE.md에 반드시 포함**
- **기술스택은 최신 안정 버전을 기본 권장** (사용자가 명시적으로 지정하지 않는 한)
- 스킬 설치 시 에러가 발생하면 건너뛰고 로그에 기록
- 이미 설치된 항목은 스킵
- 모든 생성 파일은 인터뷰 결과를 반영하여 커스터마이즈
- **작업 문서(plan, todo, context, lessons)는 .agent/ 폴더에 생성**
- SPARC 프로세스는 Plan Gate에 자동 통합 (Speed Mode: 간소화, Safety Mode: 전체)
