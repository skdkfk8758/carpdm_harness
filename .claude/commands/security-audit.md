# Security Audit (보안 감사)

프로젝트의 보안 상태를 종합 점검한다.

## Instructions

### Step 1: 보안 대상 수집

git diff로 변경 파일 수집 후 보안 민감 파일을 필터링한다.

```bash
# 변경된 파일 목록 수집
git diff --name-only HEAD 2>/dev/null || git status --short | awk '{print $2}'

# 보안 민감 파일 패턴 매칭
git diff --name-only HEAD 2>/dev/null | grep -iE \
  'auth|session|token|\.env|api|crypto|encrypt|decrypt|hash|login|oauth|credential|permission|middleware|security|rls|policy|migration|route\.(ts|js)|jwt'
```

패턴 매칭된 파일을 보안 검토 우선순위 대상으로 지정한다.

### Step 2: 시크릿 스캔

환경변수 파일과 소스 코드에서 하드코딩된 시크릿을 탐색한다.

```bash
# 환경변수 파일 존재 확인
ls -la .env* 2>/dev/null

# 소스 코드에서 시크릿 패턴 탐색
grep -rn --include="*.ts" --include="*.js" --include="*.py" --include="*.go" \
  -E '(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xoxb-[0-9A-Za-z-]{40,}|-----BEGIN.*PRIVATE KEY-----)' \
  . 2>/dev/null | grep -v node_modules | grep -v .git

# .env 파일 내 하드코딩 시크릿 (실제 값이 있는 경우)
grep -rn -E '(PASSWORD|SECRET|TOKEN|API_KEY)\s*=\s*[^$\s"'"'"'{][^$\s"'"'"'{]{4,}' \
  .env* 2>/dev/null

# git history에서 시크릿 유출 이력 확인 (최근 20개 커밋)
git log --all --oneline -20 2>/dev/null
git log -p --all -20 2>/dev/null | grep -E '(sk-|AKIA|ghp_|xoxb-)' | head -20
```

### Step 3: 의존성 보안 점검

패키지 매니저별 보안 취약점을 점검한다.

```bash
# Node.js / npm
if [ -f "package.json" ]; then
  npm audit --json 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    vulns = data.get('vulnerabilities', {})
    critical = sum(1 for v in vulns.values() if v.get('severity') == 'critical')
    high = sum(1 for v in vulns.values() if v.get('severity') == 'high')
    print(f'npm audit: critical={critical}, high={high}, total={len(vulns)}')
except:
    print('npm audit: 파싱 실패')
" 2>/dev/null
fi

# Python / pip
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  pip-audit 2>/dev/null || pip audit 2>/dev/null || \
    echo "pip-audit 미설치 — pip install pip-audit 후 실행 권장"
fi

# Go
if [ -f "go.mod" ]; then
  go list -json -m all 2>/dev/null | python3 -c "
import sys
lines = sys.stdin.read()
print('Go 모듈 목록 수집 완료 — govulncheck 실행 권장')
" 2>/dev/null
fi
```

### Step 4: 코드 보안 검토

OWASP Top 10 관점에서 소스 코드를 검토한다.

```bash
# XSS 취약점 후보: innerHTML, dangerouslySetInnerHTML, document.write
grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  -E '(innerHTML\s*=|dangerouslySetInnerHTML|document\.write\()' \
  . 2>/dev/null | grep -v node_modules | grep -v .git

# SQL Injection 후보: 문자열 직접 삽입 쿼리
grep -rn --include="*.ts" --include="*.js" --include="*.py" \
  -E '(query|execute)\s*\(\s*['"'"'"`].*\$\{' \
  . 2>/dev/null | grep -v node_modules | grep -v .git

# 인증 없는 라우트 후보
grep -rn --include="*.ts" --include="*.js" \
  -E '(router\.(get|post|put|delete|patch)|app\.(get|post|put|delete|patch))\s*\(' \
  . 2>/dev/null | grep -v node_modules | grep -v .git | grep -v 'auth\|middleware\|verify' | head -20

# 입력 검증 누락 후보: req.body, req.params 직접 사용
grep -rn --include="*.ts" --include="*.js" \
  -E 'req\.(body|params|query)\.[a-zA-Z]+' \
  . 2>/dev/null | grep -v 'validate\|schema\|zod\|joi\|yup' | grep -v node_modules | head -20

# 에러 정보 노출 후보
grep -rn --include="*.ts" --include="*.js" \
  -E 'res\.(json|send)\s*\(\s*(err|error)\s*\)' \
  . 2>/dev/null | grep -v node_modules | head -10
```

### Step 5: 설정 보안 점검

CORS, CSP, 쿠키, HTTPS 설정을 확인한다.

```bash
# CORS 설정 확인
grep -rn --include="*.ts" --include="*.js" \
  -E 'cors\s*\(|origin\s*:' \
  . 2>/dev/null | grep -v node_modules | head -10

# 쿠키 보안 속성 확인 (httpOnly, secure, sameSite)
grep -rn --include="*.ts" --include="*.js" \
  -E '(cookie|session)\s*\(' \
  . 2>/dev/null | grep -v node_modules | head -10

# HTTPS/HSTS 강제 여부
grep -rn --include="*.ts" --include="*.js" \
  -E '(hsts|strict-transport-security|https)' \
  . 2>/dev/null | grep -v node_modules | grep -iv 'comment\|#' | head -10

# CSP 헤더 설정 확인
grep -rn --include="*.ts" --include="*.js" \
  -E 'content-security-policy|helmet\s*\(' \
  . 2>/dev/null | grep -v node_modules | head -10
```

### Step 6: 보고서 생성

점검 결과를 `.omc/state/security-audit-result`에 저장한다.

```bash
mkdir -p .omc/state
AUDIT_FILE=".omc/state/security-audit-result"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

cat > "$AUDIT_FILE" << REPORT
# Security Audit Report
생성 시각: ${TIMESTAMP}

## 요약
| 카테고리 | 상태 | 발견 건수 |
|---------|------|----------|
| 시크릿 스캔 | - | - |
| 의존성 취약점 | - | - |
| 코드 보안 | - | - |
| 설정 보안 | - | - |

## 발견된 취약점

### CRITICAL
(없음)

### HIGH
(없음)

### MEDIUM
(없음)

### LOW
(없음)

## 권장 조치
1. 발견된 취약점 항목별 수정 방안 기술
2. 우선순위 순으로 조치 진행

REPORT

echo "보안 감사 보고서가 ${AUDIT_FILE}에 저장되었습니다."
```

각 Step의 실행 결과를 바탕으로 보고서를 실제 데이터로 채운다.

## Rules

- 실제 실행 결과를 기반으로 판단 (패턴 매칭만으로 불충분)
- 발견된 취약점에 심각도 부여 (CRITICAL / HIGH / MEDIUM / LOW)
- 각 취약점에 수정 방안 제시
- 오탐(false positive) 최소화
- node_modules, .git, dist, build 디렉토리는 스캔 제외
- `.env` 파일의 실제 값을 응답에 출력하지 않음 (보안 유의)
- 발견 사항은 보안 심각도 기준으로 정렬하여 보고

## Argument: $ARGUMENTS

점검 범위 (예: "전체", "변경 파일만", 특정 디렉토리 경로). 미지정 시 프로젝트 전체를 대상으로 한다.
