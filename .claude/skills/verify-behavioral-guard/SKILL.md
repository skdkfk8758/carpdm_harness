---
name: verify-behavioral-guard
description: behavioral guard (합리화 방지 + 적신호 탐지) 통합 검증을 실행합니다.
type: verify
covers:
  - "src/core/red-flag-detector.ts"
  - "src/core/rationalization-guard.ts"
  - "src/types/behavioral-guard.ts"
  - "src/hooks/prompt-enricher.ts"
  - "src/hooks/quality-gate.ts"
---

## 검사 항목

### 1. 모듈 로드 정합성 (severity: error)
- 탐지: `node -e "import('./dist/core/red-flag-detector.js').then(m => { m.detectRedFlags('test'); process.exit(0) }).catch(() => process.exit(1))"`
- PASS: red-flag-detector 모듈 로드 및 함수 호출 성공
- FAIL: 정규식 컴파일 에러 또는 모듈 의존성 깨짐

### 2. 합리화 테이블 4 phase 완전성 (severity: error)
- 탐지: `node -e "import('./dist/core/rationalization-guard.js').then(m => { for(const p of ['planning','implementing','testing','completing']){if(!m.buildRationalizationContext(p))process.exit(1)} }).catch(() => process.exit(1))"`
- PASS: 4개 phase 모두 컨텍스트 생성
- FAIL: 누락된 phase 존재

### 3. prompt-enricher 적신호 통합 (severity: error)
- 탐지: `echo '{"prompt":"커밋해줘 should work","cwd":"/tmp"}' | node dist/hooks/prompt-enricher.js 2>/dev/null | grep -q 'behavioral-guard'`
- PASS: behavioral-guard 컨텍스트가 additionalContext에 포함됨
- FAIL: 적신호+완료의도 프롬프트에서 behavioral-guard 미주입

### 4. prompt-enricher 합리화 주입 (severity: error)
- 탐지: 활성 워크플로우(executor agent) 상태에서 prompt-enricher 실행 시 "구현 단계" 포함 확인
- PASS: 워크플로우 활성 시 합리화 테이블 주입
- FAIL: 워크플로우 활성인데 합리화 컨텍스트 누락

### 5. config off 비활성화 (severity: error)
- 탐지: `behavioralGuard.redFlagDetection: "off"` config에서 적신호 프롬프트 실행 시 additionalContext 없음 확인
- PASS: off 설정 시 주입 안 됨
- FAIL: off인데 주입됨

## 예외
1. OMC team/swarm 모드 활성 시 quality-gate는 조기 반환하므로 적신호 스캔 미실행 (정상)
2. 워크플로우 없는 상태에서는 합리화 테이블 미주입 (정상, Stage 2.5만 동작)
