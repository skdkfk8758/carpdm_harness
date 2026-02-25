# TRUST 5 품질 검증

TRUST 5 기준으로 코드 품질을 검증합니다.

## Instructions

1. `harness_quality_check` 도구를 호출하여 TRUST 5 검증 실행
2. 결과 리포트의 각 기준별 점수 확인
3. error 심각도 항목이 있으면 반드시 수정
4. warning 항목은 가능한 한 해결

## TRUST 5 기준
- **T**ested: 테스트 존재 여부, 커버리지
- **R**eadable: 린트, 네이밍, 가독성
- **U**nified: 포맷팅, 임포트 순서, 프로젝트 구조
- **S**ecured: 시크릿, 입력 검증, SQL 인젝션
- **T**rackable: 커밋 컨벤션, 이슈 참조

## Argument: $ARGUMENTS
검증 범위 (예: "전체", "staged", 특정 파일 경로)
