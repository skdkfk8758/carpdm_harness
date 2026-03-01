---
name: harness-doctor
description: 설치된 워크플로우의 건강 상태를 진단합니다. "harness 진단", "건강 진단", "doctor", "harness 상태", "설치 정보", "모듈 목록", "프리셋 목록"을 요청할 때 사용합니다.
---

현재 프로젝트 루트를 감지하고 진단을 실행하세요.

## 인자 매핑
- `"info"`, `"상태"`, `"설치 정보"` → 설치 상태만 조회 (Phase 1만 실행)
- `"list"`, `"모듈"`, `"프리셋"` → 모듈/프리셋 목록만 조회 (Phase 2만 실행)
- 인자 없으면 전체 진단 (Phase 1 + 2 + 3)

## Phase 1: 설치 상태 조회
```tool
harness_info({ projectRoot: "<감지된 프로젝트 루트>" })
```

## Phase 2: 모듈/프리셋 목록
```tool
harness_list({})
```

## Phase 3: 건강 진단
```tool
harness_doctor({ projectRoot: "<감지된 프로젝트 루트>" })
```

## 후속 안내
문제가 발견되면 `/carpdm-harness:sync`로 수정을 권장하세요.
