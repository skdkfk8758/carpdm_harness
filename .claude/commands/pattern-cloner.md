# Pattern Cloner

기존 도메인의 패턴을 복제하여 새 도메인/기능을 일관된 스타일로 생성한다.

## Instructions

1. **대상 패턴 식별**: 인자에서 새로 만들 도메인/기능 파악

2. **참조 패턴 로드** (이 프로젝트의 표준 패턴):

   **Model 패턴** (`src/models/station.py` 참조):
   - Pydantic BaseModel 사용
   - Optional 필드에 기본값
   - Enum은 별도 정의

   **Store/Repository 패턴** (`src/pipeline/station_store.py` 참조):
   - Protocol 정의 (`src/pipeline/store.py`)
   - SQLite 구현체 (async, aiosqlite)
   - InMemory 구현체 (테스트용)
   - CRUD 메서드: create, get_by_id, list_all, update, delete

   **Route/API 패턴** (`src/api/dashboard_routes.py` 참조):
   - FastAPI APIRouter 사용
   - Pydantic 모델로 request/response 타입 지정
   - HTTPException으로 에러 처리
   - prefix + tags 설정

   **Test 패턴** (`tests/test_station_api.py` 참조):
   - FastAPI TestClient 사용
   - InMemory Store로 격리
   - 각 엔드포인트별 테스트 함수

3. **복제 실행**:
   - 참조 파일을 읽고
   - 새 도메인 용어로 치환
   - 동일한 구조로 파일 생성
   - 필요 시 bootstrap.py에 DI 등록

4. **결과 검증**:
   - 파일 구조가 기존 패턴과 동일한지
   - 명명 규칙이 Ubiquitous Language와 일치하는지
   - import 경로가 올바른지

## Argument: $ARGUMENTS
새로 만들 도메인/기능명 (예: "passenger 도메인", "schedule 기능")
