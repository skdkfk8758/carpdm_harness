# TODO: [작업 제목]

> 시작일: YYYY-MM-DD
> Plan 참조: plan.md
> 상태: NOT_STARTED | IN_PROGRESS | COMPLETED

## Progress: 0/N completed

> Goal-Driven Execution: 각 Step은 "작업 → verify: 검증방법" 형식으로 작성한다.
> 모호한 명령("~를 구현")을 검증 가능한 목표("~를 했을 때 ~가 되는지 확인")로 변환한다.

### Phase 1: Data Layer
- [ ] Step 1.1: (모델 정의/수정) → verify: (모델 필드 확인 방법)
- [ ] Step 1.2: (마이그레이션) → verify: (마이그레이션 성공 확인)

### Phase 2: Repository Layer
- [ ] Step 2.1: (Protocol 정의) → verify: (인터페이스 검증)
- [ ] Step 2.2: (구현체 작성) → verify: (구현체 테스트)

### Phase 3: Service Layer
- [ ] Step 3.1: (비즈니스 로직) → verify: (로직 검증 방법)

### Phase 4: API Layer
- [ ] Step 4.1: (Route 추가) → verify: (엔드포인트 테스트)
- [ ] Step 4.2: (Request/Response 모델) → verify: (스키마 검증)

### Phase 5: Test
- [ ] Step 5.1: (단위 테스트) → verify: pytest -q 통과
- [ ] Step 5.2: (API 통합 테스트) → verify: pytest -q 통과

### Phase 6: Frontend (해당 시)
- [ ] Step 6.1: (타입 정의) → verify: tsc --noEmit 통과
- [ ] Step 6.2: (API 클라이언트) → verify: (API 호출 테스트)
- [ ] Step 6.3: (컴포넌트) → verify: (렌더링 확인)

### Phase 7: Verification
- [ ] Step 7.1: pytest -q 전체 통과
- [ ] Step 7.2: Post-task 체크리스트 통과
- [ ] Step 7.3: Demand Elegance 자문 완료
- [ ] Step 7.4: lessons.md 교훈 기록
- [ ] Step 7.5: 문서 갱신

---
## Session Continuity (세션 연속성)

세션이 끊기거나 재시작될 때 아래 정보를 기반으로 이어서 진행한다:
- **← CURRENT** 마커가 있는 항목부터 재개
- 아래 Notes에 마지막 상태를 기록해둔다

## Notes
- 현재 진행: ← CURRENT 마크 참조
- 블로커: (있으면 기록)
- 마지막 세션 상태: (세션 종료 시 자동 기록)
  - 진행률: [x/N]
  - 마지막 완료 항목: [항목명]
  - 다음 할 일: [항목명]
  - 미해결 이슈: (있으면 기록)

## Plan 피드백 (Implement → Plan 루프)

> 구현 중 계획과 다른 상황을 발견하면 **todo를 멈추고 plan을 먼저 업데이트**한다.

**피드백 절차:**
1. 발견 사항을 아래에 기록
2. plan.md 해당 섹션 업데이트
3. 사용자 재승인 (변경 범위가 크면)
4. todo.md Step 수정 후 이어서 진행

**발견 사항 로그:**
- (예: Step 2 진행 중 기존 API 스키마가 plan과 다름 → plan §0 As-Is 업데이트 필요)
