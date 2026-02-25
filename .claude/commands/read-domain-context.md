# Read Domain Context

지정된 도메인의 컨텍스트를 로드하고 적용할 규칙을 요약한다.

## Instructions

1. 인자로 받은 도메인 키워드를 분석한다.

2. 도메인별 로드 우선순위:

   **Congestion (혼잡도):**
   - `src/models/congestion.py` → 도메인 모델
   - `src/ai/congestion_calculator.py` → 핵심 계산 로직
   - `src/services/congestion_service.py` → 비즈니스 로직
   - `src/pipeline/store.py` → Storage Protocol
   - `src/pipeline/sqlite_store.py` → 구현 참조
   - `src/api/routes.py` → API 계약

   **AI Detection (탐지):**
   - `src/ai/tiny_person_detector.py` → MobileNet-SSD
   - `src/ai/yolo_person_detector.py` → YOLOv11
   - `src/ai/zone_person_detector.py` → Zone detection
   - `src/models/api.py` → API 모델

   **Station (역):**
   - `src/models/station.py` → 도메인 모델
   - `src/pipeline/station_store.py` → Repository
   - `src/api/dashboard_routes.py` → API

   **Train (열차):**
   - `src/models/train.py` → 도메인 모델
   - `src/pipeline/train_store.py` → Repository
   - `src/api/dashboard_routes.py` → API

   **Alert (알림):**
   - `src/models/alert.py` → 도메인 모델
   - `src/pipeline/alert_store.py` → Repository
   - `src/api/dashboard_routes.py` → API

   **Camera (카메라):**
   - `src/models/camera.py` → 도메인 모델
   - `src/pipeline/camera_store.py` → Repository
   - `src/api/dashboard_routes.py` → API

   **Pipeline (파이프라인):**
   - `src/pipeline/kafka_pipeline.py` → Kafka
   - `src/runtime/kafka_runtime.py` → Runtime
   - `src/config/settings.py` → 설정

   **Dashboard (대시보드):**
   - `frontend-next/context/DashboardContext.tsx` → 상태관리
   - `frontend-next/hooks/*.ts` → 커스텀 훅
   - `frontend-next/lib/types.ts` → 타입 정의
   - `frontend-next/lib/api.ts` → API 클라이언트

3. 해당 파일들을 읽고 아래를 출력한다:
   - **로드한 문서 목록**
   - **발견한 패턴** (naming, structure, error handling)
   - **이번 작업에 적용할 규칙 요약**

4. `docs/conventions.md`도 항상 함께 참조한다.

## Argument: $ARGUMENTS
도메인 키워드 (예: congestion, station, train, alert, dashboard 등)
