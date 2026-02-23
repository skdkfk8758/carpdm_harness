# Quality Guard

코드 변경의 품질을 검증하는 체크리스트를 실행한다.

## Instructions

1. **에러 처리 규칙 확인:**
   - 모든 async 함수에 try/except 있는지
   - HTTP 에러 응답이 적절한 status code 사용하는지
   - Pydantic ValidationError가 처리되는지

2. **보안 체크리스트 (웹/SaaS 전체 15항목):**
   - CORS/Preflight: 허용 Origin이 화이트리스트 기반인지, `*` 남용 없는지
   - CSRF: 상태 변경 요청에 CSRF 토큰 적용 (SameSite 쿠키와 병행)
   - XSS+CSP: 사용자 입력 이스케이프/새니타이즈, Content-Security-Policy 헤더 설정
   - SSRF: 서버 측 URL 요청 시 내부 IP/localhost 차단, URL 화이트리스트
   - AuthN/AuthZ: 인증(JWT/세션) + 권한 검증이 모든 보호 엔드포인트에 적용
   - RBAC/ABAC+테넌트격리: 역할 기반 접근 제어, 멀티테넌트 시 데이터 격리 확인
   - 최소 권한: DB 계정·API 키·서비스 계정이 필요한 최소 권한만 보유
   - Validation+SQLi 방어: 모든 입력 검증 (타입/길이/범위), Parameterized Query 사용
   - RateLimit/Bruteforce: 로그인·API·비밀번호 재설정에 Rate Limit 적용
   - 쿠키(HttpOnly·Secure·SameSite)+세션보안: 세션 고정 공격 방어, 세션 타임아웃
   - Secret 관리+Rotation: 환경변수/Vault 사용, 코드 내 하드코딩 없음, 키 순환 정책
   - HTTPS/HSTS+보안헤더: HSTS, X-Frame-Options, X-Content-Type-Options 등 설정
   - AuditLog: 인증·권한변경·데이터수정 등 주요 이벤트 로깅
   - 에러노출 차단: 프로덕션에서 스택트레이스/내부경로/DB정보 미노출
   - 의존성 취약점 점검: `npm audit` / `pip-audit` / `safety check` 실행

3. **DDD 패턴 준수:**
   - Model → Store(Protocol) → Service → Route 계층 구조 준수
   - 도메인 로직이 Service 레이어에 위치
   - Store는 Protocol을 구현
   - Route는 Service만 호출 (Store 직접 접근 금지)

4. **Ubiquitous Language 검증:**
   - 변수/함수/클래스명이 비즈니스 용어와 일치하는지
   - 핵심 용어: congestion, zone, station, train, car, platform, density, person_count, congestion_rate

5. **테스트 표준:**
   - 새 기능에 대응하는 테스트 파일 존재하는지
   - 테스트가 InMemory Store 사용하는지
   - API 테스트가 TestClient 사용하는지
   - **TDD 준수 확인** (`.omc/project-memory.json`에서 `tdd.enabled` 확인):
     - TDD 사이클(Red-Green-Refactor)이 실행되었는가? (`.omc/state/tdd-result` 존재)
     - 테스트가 소스 코드보다 먼저 작성되었는가? (`.omc/state/tdd-edit-order` 순서 확인)
     - Edge Case 테스트가 2개 이상 포함되었는가?
     - 리팩토링 후 전체 테스트가 통과하는가?

6. **실행 검증:**
   ```bash
   pytest -q
   python -m py_compile src/main.py
   ```

7. **완료 조건 (Merge-ready Definition):**
   - [ ] 모든 테스트 통과
   - [ ] DDD 패턴 준수
   - [ ] 에러 핸들링 완비
   - [ ] 보안 취약점 없음
   - [ ] Ubiquitous Language 준수
   - [ ] 변경 파일 diff 요약 작성

## Argument: $ARGUMENTS
검증 대상 범위 (예: "station store 변경", "전체", 특정 파일 경로)
