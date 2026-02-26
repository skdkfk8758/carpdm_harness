# Review Prep — PR 제출 전 셀프 리뷰

PR 생성 전에 변경사항을 종합 점검하고 리뷰 준비 상태를 확인한다.

## Instructions

### Step 1: 변경 범위 확인

```bash
# main 대비 변경
git diff main...HEAD --stat
git diff main...HEAD --name-only
git log main..HEAD --oneline
```

### Step 2: 빌드/테스트 실행

```bash
# 타입체크
npx tsc --noEmit 2>&1

# 빌드
npm run build 2>&1

# 테스트
npm test 2>&1
```

### Step 3: 체크리스트 점검

각 항목을 실제 실행 결과로 확인한다:

**코드 품질**
- [ ] 빌드 성공
- [ ] 타입체크 통과
- [ ] 테스트 통과
- [ ] 새 기능에 대한 테스트 존재

**커밋 품질**
- [ ] Conventional Commits 형식 준수
- [ ] 논리적 단위로 분리 (불필요한 변경 혼합 없음)

**보안**
- [ ] 민감 정보 (API 키, 시크릿) 미포함
- [ ] .env, credentials 파일 staged 아님

**문서**
- [ ] README/CLAUDE.md 갱신 필요 여부 확인

### Step 4: TRUST 5 점수 (선택)

`harness_quality_check` 도구가 사용 가능하면 품질 점수 확인.

### Step 5: 결과 보고

```
Review Prep
━━━━━━━━━━━━━━━━━━━━━━━━
변경: N files, +X -Y lines
커밋: N commits

체크리스트: M/N 통과
  ✅ 빌드, 타입체크, 테스트
  ✅ 커밋 컨벤션
  ⚠️ 문서 갱신 필요

━━━━━━━━━━━━━━━━━━━━━━━━
준비 완료 → /ship-pr
(또는 미비 사항 수정 후 재실행)
```

## Rules
- 실제 빌드/테스트를 실행하여 확인 (자기 신고 금지)
- 실패 항목에 구체적 수정 가이드 제공
- 모든 항목 통과 시 `/ship-pr` 안내
- .env, credentials 등 민감 파일 staged 여부 반드시 확인
