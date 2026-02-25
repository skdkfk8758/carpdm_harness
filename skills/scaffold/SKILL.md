---
name: scaffold
description: PRD 또는 프로젝트 설명을 기반으로 AI 협업 환경을 한번에 세팅합니다. "프로젝트 세팅", "PRD로 초기화", "scaffold"를 요청할 때 사용합니다.
---

PRD(Product Requirements Document) 또는 프로젝트 설명을 받아서, harness 설치부터 CLAUDE.md/conventions.md 초안까지 한번에 생성합니다.

## 인자

사용자가 다음 중 하나를 제공합니다:
- PRD 파일 경로 (예: `docs/PRD.md`, `requirements.md`)
- 프로젝트 설명 텍스트 (인라인)
- GitHub Issue URL

## 워크플로우

### Phase 1: PRD 분석

사용자가 제공한 PRD/설명에서 다음을 추출합니다:
- **프로젝트명**: 리포지토리/디렉토리 이름
- **기술 스택**: 언어, 프레임워크, 주요 라이브러리
- **도메인 용어**: Ubiquitous Language 후보
- **주요 기능**: 모듈/서비스 단위로 분류
- **비기능 요구사항**: 테스트, 보안, 성능

분석 결과를 사용자에게 요약 보여주고 확인 받습니다.

### Phase 2: harness 설치

프로젝트에 맞는 프리셋을 선택하여 설치합니다.

```tool
harness_init({ projectRoot: "<프로젝트 루트>", preset: "<추천 프리셋>" })
```

프리셋 추천 기준:
- 테스트 중심 → `tdd`
- 보안 중요 → `secure`
- 전체 기능 → `full`
- 일반적 → `standard`

### Phase 3: CLAUDE.md 초안 생성

PRD에서 추출한 정보를 기반으로 프로젝트 CLAUDE.md를 생성합니다:
- 프로젝트 정체성 (이름, 설명, 기술 스택)
- 아키텍처 개요 (디렉토리 구조, 레이어 설명)
- 변경 시 체크리스트
- 테스트 명령어
- `<!-- harness:auto:start -->` / `<!-- harness:auto:end -->` 마커 영역

### Phase 4: conventions.md 초안 생성

`docs/conventions.md`에 코딩 컨벤션 초안을 작성합니다:
- Naming (기술 스택에 맞는 컨벤션)
- Structure (디렉토리 구조 규칙)
- Error Handling (프레임워크 패턴)
- 도메인 용어 사전 (Ubiquitous Language)

### Phase 5: 도메인 컨텍스트 작성

`.agent/context.md`에 도메인 컨텍스트를 작성합니다:
- 프로젝트 목표와 배경
- 핵심 도메인 개념
- 바운디드 컨텍스트 (서비스/모듈 경계)

### Phase 6: 결과 보고

생성된 파일 목록과 다음 단계를 안내합니다:
1. CLAUDE.md 검토 및 커스터마이즈
2. conventions.md 팀 리뷰
3. `/carpdm-harness:doctor`로 건강 진단
4. `/carpdm-harness:ontology-generate`로 온톨로지 생성 (선택)

## 주의사항
- 이미 CLAUDE.md가 있으면 덮어쓰지 않고 사용자에게 확인
- 이미 harness가 설치되어 있으면 Phase 2 스킵
- 생성된 초안은 반드시 사용자 검토 후 커밋
