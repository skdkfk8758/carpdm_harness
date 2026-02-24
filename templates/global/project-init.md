# Project Init — 레거시 프로젝트에 AI 협업 환경 적용

이미 개발 중인 프로젝트에 Plan-First + DDD + SPARC + External Memory + Vibe Coder 전략 워크플로우를 적용한다.
기존 코드를 자동 분석하여 인터뷰를 간소화하고, 프로젝트 특성에 맞는 워크플로우를 생성한다.

## Argument: $ARGUMENTS
프로젝트 설명 또는 경로 (예: "기존 FastAPI 서버", "이 프로젝트 초기화")

## Instructions

### Phase 0: 환경 확인
1. Node.js, npm 설치 여부 확인: `node --version && npm --version`
2. Claude Code CLI 확인: `claude --version`
3. Git 상태 확인: `git status` (레거시이므로 반드시 git 이력이 있어야 함)
4. Git worktree 지원 확인: `git worktree list`
5. 커밋되지 않은 변경사항이 있으면 경고: "초기화 전에 현재 작업을 커밋하세요"

### Phase 1: 코드베이스 자동 분석 (Auto-Discovery)

기존 코드를 분석하여 프로젝트 특성을 자동으로 파악한다. **사용자에게 묻지 않고 직접 탐색한다.**

#### 1-1. 기술 스택 자동 감지

**의존성 파일 스캔 (존재하는 파일만):**
```bash
# JavaScript/TypeScript 프로젝트
cat package.json 2>/dev/null          # dependencies, devDependencies
cat tsconfig.json 2>/dev/null         # TypeScript 사용 여부
cat next.config.* 2>/dev/null         # Next.js
cat nuxt.config.* 2>/dev/null         # Nuxt
cat vite.config.* 2>/dev/null         # Vite
cat angular.json 2>/dev/null          # Angular
cat svelte.config.* 2>/dev/null       # Svelte

# Python 프로젝트
cat requirements.txt 2>/dev/null      # pip 의존성
cat pyproject.toml 2>/dev/null        # poetry / modern Python
cat Pipfile 2>/dev/null               # pipenv
cat setup.py 2>/dev/null              # legacy Python

# 기타
cat go.mod 2>/dev/null                # Go
cat Cargo.toml 2>/dev/null            # Rust
cat build.gradle* 2>/dev/null         # Java/Kotlin
cat Gemfile 2>/dev/null               # Ruby
cat docker-compose.yml 2>/dev/null    # Docker 구성
cat Dockerfile 2>/dev/null            # Docker
```

**감지 매핑:**
| 파일/의존성 | 감지 결과 |
|------------|----------|
| `next` in package.json | Next.js |
| `react` in package.json | React |
| `vue` in package.json | Vue.js |
| `fastapi` in requirements.txt | FastAPI |
| `django` in requirements.txt | Django |
| `express` in package.json | Express |
| `nestjs` in package.json | NestJS |
| `tailwindcss` in package.json | Tailwind CSS |
| `prisma` in package.json | Prisma ORM |
| `sqlalchemy` in requirements.txt | SQLAlchemy |
| `supabase` in 의존성 | Supabase |
| `redis` in 의존성 | Redis |

#### 1-2. 프로젝트 구조 분석

```bash
# 디렉토리 구조 파악 (2단계 깊이)
find . -type d -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/__pycache__/*' -not -path '*/venv/*' -not -path '*/.venv/*' | head -50

# 소스 코드 파일 통계
find . -type f \( -name '*.py' -o -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.go' -o -name '*.rs' -o -name '*.java' \) -not -path '*/node_modules/*' -not -path '*/.git/*' | wc -l
```

**아키텍처 패턴 추론:**
| 디렉토리 패턴 | 추론 |
|--------------|------|
| `src/models/`, `src/stores/`, `src/services/`, `src/api/` | DDD / 레이어드 아키텍처 |
| `src/modules/`, 각 모듈에 controller+service+dto | NestJS 모듈러 |
| `app/`, `pages/`, `components/` | Next.js / 프론트엔드 |
| `cmd/`, `internal/`, `pkg/` | Go 표준 레이아웃 |
| `src/main/java/`, `src/test/java/` | Java/Spring 표준 |
| `services/`, 각 서비스에 독립 Dockerfile | 마이크로서비스 |

#### 1-3. 기존 규약 분석

```bash
# 네이밍 컨벤션 샘플 (파일명 패턴)
ls src/**/*.py src/**/*.ts 2>/dev/null | head -20

# 테스트 파일 확인 + 수/커버리지 감지
find . -type f \( -name 'test_*' -o -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.go' -o -name '*Test.java' \) -not -path '*/node_modules/*' | head -20
TEST_FILE_COUNT=$(find . -type f \( -name 'test_*' -o -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.go' -o -name '*Test.java' \) -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')
SOURCE_FILE_COUNT=$(find . -type f \( -name '*.py' -o -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.go' -o -name '*.rs' -o -name '*.java' \) -not -path '*/node_modules/*' -not -path '*/.git/*' -not -name 'test_*' -not -name '*.test.*' -not -name '*.spec.*' 2>/dev/null | wc -l | tr -d ' ')
echo "테스트 파일: ${TEST_FILE_COUNT}개 / 소스 파일: ${SOURCE_FILE_COUNT}개"

# CI/CD 확인
ls .github/workflows/ 2>/dev/null
ls .gitlab-ci.yml 2>/dev/null
ls Jenkinsfile 2>/dev/null

# 기존 문서 확인
ls README.md CONTRIBUTING.md docs/ 2>/dev/null

# Lint/포맷터 설정
ls .eslintrc* .prettierrc* .flake8 .ruff.toml pyproject.toml 2>/dev/null | head -10
```

#### 1-4. 도메인 용어 추출

```bash
# 모델/타입 파일에서 클래스/인터페이스명 추출
grep -rh 'class \|interface \|type \|enum ' src/models/ src/types/ src/entities/ app/models/ 2>/dev/null | head -20

# API 엔드포인트 추출
grep -rh '@app\.\|@router\.\|@Get\|@Post\|@Controller\|router\.' src/ app/ 2>/dev/null | head -20
```

### Phase 2: 분석 결과 확인 인터뷰 (간소화)

자동 분석 결과를 사용자에게 보여주고 **확인 및 보완**만 받는다.

#### 2-1. 분석 결과 보고
자동 감지된 내용을 정리하여 사용자에게 제시한다:
```
[자동 감지 결과]
- 기술 스택: React (Next.js) + FastAPI + PostgreSQL + Redis
- 아키텍처: 레이어드 (models → stores → services → routes)
- 테스트: pytest 기반 (tests/ 디렉토리, 42개 파일)
- CI/CD: GitHub Actions (.github/workflows/ci.yml)
- 패키지 매니저: pnpm (프론트), poetry (백엔드)
- 도메인 용어: User, Product, Order, Payment, Cart
```

#### 2-2. 확인 질문
AskUserQuestion으로 확인한다:
- "위 분석 결과가 맞나요? 수정할 부분이 있으면 알려주세요."
- "추가로 AI가 알아야 할 핵심 도메인 규칙이 있나요?" (자유 입력)
- "프로젝트의 현재 주요 과제/방향은?" (자유 입력)

#### 2-3. 보완 질문 (분석에서 감지 못한 항목만)
자동 감지되지 않은 항목만 추가 질문:
- 배포 환경 (감지 안 된 경우)
- 인증 방식 (감지 안 된 경우)
- 실시간 기능 (감지 안 된 경우)
- AI 응답 언어 (한국어/English/日本語/中文, 기본값: 한국어)
- **TDD 강제 수준**: 테스트 파일 비율(`TEST_FILE_COUNT / SOURCE_FILE_COUNT`)에 따라 추천
  - 비율 50% 이상 → "이미 테스트가 잘 갖춰져 있습니다. TDD Block을 권장합니다." (기본: Block)
  - 비율 10~50% → "테스트가 부분적으로 존재합니다. TDD Warn으로 시작을 권장합니다." (기본: Warn)
  - 비율 10% 미만 → "테스트가 거의 없습니다. TDD를 도입하시겠습니까?" (기본: Off)
  - 선택지: Block / Warn / Off

### Phase 3: 플러그인 + MCP + CLI 설치

`/project-setup`의 Phase 1~2와 동일하게 진행한다:

**플러그인 설치:**
```bash
claude plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
claude plugin install oh-my-claudecode
```
이미 설치된 경우 스킵.

**MCP 설치:**
```bash
claude mcp add -s project sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
claude mcp add -s project memory -- npx -y @modelcontextprotocol/server-memory --dir .omc/memory
```
이미 설치된 경우 스킵.

**carpdm-harness (워크플로우 엔진):**
```bash
claude mcp add -s user carpdm-harness -- node /Users/carpdm/Workspace/Github/carpdm_harness/dist/server.js
```
이미 설치된 경우 스킵. (참고용 — 플러그인을 통해 자동 설정된 경우 불필요)

**교차 검증 CLI 확인:**
```bash
codex --version 2>/dev/null || echo "Codex CLI 미설치 — 교차 검증 시 서브에이전트 fallback"
gemini --version 2>/dev/null || echo "Gemini CLI 미설치 (선택)"
```

**조건부 MCP (분석 결과 기반):**
- 프론트엔드 감지 + 테스트 파일 존재 → Playwright MCP
- Supabase 감지 → Supabase MCP
- Sentry 감지 → Sentry MCP

### Phase 4: 스킬 설치 (자동 감지 스택 기반)

`/project-setup`의 Phase 4와 동일한 스택→스킬 매핑을 적용한다.
단, 자동 감지된 스택을 기반으로 사용자 확인 없이 진행한다.

### Phase 5: 워크플로우 파일 생성 (기존 코드 반영)

#### 5-1. CLAUDE.md (기존 코드 분석 결과 반영)
- 프로젝트 개요: 자동 분석 + 사용자 보완 내용
- 개발 명령어: 기존 package.json scripts / Makefile 등에서 추출
- 아키텍처 개요: 자동 분석된 디렉토리 구조 기반
- 도메인 용어: 자동 추출된 클래스/인터페이스명 기반
- 기존 규약: lint/포맷터 설정에서 추출
- AI Collaboration Standard: 표준 섹션 전체 포함

**주의:** 기존 README.md나 CONTRIBUTING.md가 있으면 참조하여 CLAUDE.md에 반영

#### 5-2. docs/conventions.md (기존 패턴 기반)
- 기존 코드에서 발견된 네이밍 패턴 정리
- 기존 파일 구조 패턴 문서화
- 기존 에러 핸들링 패턴 정리
- 기존 테스트 패턴 정리

#### 5-3. carpdm-harness 워크플로우 설치

커맨드, 훅, 문서 템플릿을 한 번에 설치한다:

```
harness_init(
  projectRoot: PROJECT_ROOT,
  preset: "full",
  installGlobal: true,
  enableOntology: false
)
```

이 도구가 커맨드, 훅, 문서 템플릿을 자동 생성한다.
이미 설치되어 있으면 `harness_update`로 자동 전환된다.

#### 5-4~5-9: `/project-setup` Phase 5와 동일
- .agent/ (External Memory — plan.md, todo.md, context.md, lessons.md를 docs/templates/ 기반으로 생성)
- .claude/settings.local.json (훅 등록)
- .omc/hud-config.json (Statusline HUD 설정)
- .omc/project-memory.json (자동 분석 결과 저장)
- .gitignore 업데이트 (.agent/ 포함)
- Git Tracking 설정

### Phase 6: 검증
1. 훅 테스트: 각 .sh 파일 `bash -n` 문법 검증
2. MCP 확인: `.mcp.json` 검증
3. 스킬 확인: 설치된 스킬 목록 출력
4. CLAUDE.md 확인: 기존 코드 정보가 정확히 반영되었는지
5. 기존 테스트 실행: 기존 테스트가 깨지지 않았는지 확인
6. Git Tracking 확인: `.claude/commands/`와 `.claude/hooks/`가 tracked 상태인지

### Phase 7: 완료 보고
- 자동 감지된 기술 스택
- 설치된 플러그인/MCP/CLI 목록
- 설치된 스킬 목록
- 생성된 파일 목록
- 교차 검증 준비 상태
- 기존 테스트 실행 결과
- **기존 코드에 영향 없음 확인** (워크플로우 파일만 추가, 소스 코드 미변경)
- 다음 단계 안내: "이제 작업을 시작하면 자동으로 Plan-First 워크플로우가 적용됩니다. 기존 코드의 패턴이 CLAUDE.md와 conventions.md에 반영되어 있으니, AI가 기존 스타일을 따릅니다."

## Rules
- **기존 소스 코드를 절대 수정하지 않는다** (워크플로우 파일만 추가)
- 기존 .gitignore가 있으면 항목을 추가만 한다 (삭제/수정 금지)
- 기존 README.md를 수정하지 않는다 (CLAUDE.md를 별도 생성)
- 기존 테스트가 있으면 실행하여 깨지지 않았는지 확인
- 이미 설치된 플러그인/MCP/스킬은 스킵
- 자동 감지 결과가 불확실하면 사용자에게 확인
- 기존 CI/CD 설정과 충돌하지 않도록 주의
