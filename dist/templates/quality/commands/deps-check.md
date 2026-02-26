# Deps Check — 의존성 상태 확인

프로젝트 의존성의 보안 취약점, 업데이트 가능 여부를 확인한다.

## Instructions

### Step 1: 의존성 감사

```bash
npm audit 2>&1
```

### Step 2: 업데이트 가능 패키지

```bash
npm outdated 2>&1
```

### Step 3: lock 파일 상태

```bash
# package-lock.json 존재 여부
[ -f "package-lock.json" ] && echo "lock: OK" || echo "lock: MISSING"

# node_modules와 lock 파일 동기화 상태
npm ls --depth=0 2>&1 | tail -5
```

### Step 4: 결과 요약

```
Deps Check
━━━━━━━━━━━━━━━━━━━━

🔒 보안 감사
  ✅ 취약점 없음 (또는 N개 발견)
  (critical/high가 있으면 상세 표시)

📦 업데이트 가능 (N개)
  Package        Current  Latest  Type
  typescript     5.8.0    5.9.0   devDep
  vitest         3.1.0    3.2.0   devDep

⚠️ Major 업그레이드 주의
  zod            3.25     4.0     Breaking changes 가능

🔗 Lock 파일: OK

━━━━━━━━━━━━━━━━━━━━
```

## Rules
- npm audit에서 critical/high 취약점 발견 시 즉시 경고
- major 버전 업그레이드는 breaking changes 가능성 경고
- 실행만 하고 자동 업데이트하지 않는다
- package-lock.json이 없으면 "lock 파일 없음 — npm install 필요" 경고
