# 온톨로지 가이드

## 개요
carpdm-harness 온톨로지는 프로젝트의 지식을 3계층으로 구조화합니다:

1. **Structure Map** (ONTOLOGY-STRUCTURE.md): 파일/디렉토리/모듈 관계
2. **Code Semantics** (ONTOLOGY-SEMANTICS.md): 함수/클래스/타입 의존성
3. **Domain Knowledge** (ONTOLOGY-DOMAIN.md): 비즈니스 용어/패턴/컨벤션

## 설정
`carpdm-harness.config.json`의 `ontology` 필드에서 설정합니다.

```json
{
  "ontology": {
    "enabled": true,
    "outputDir": ".agent/ontology",
    "layers": {
      "structure": { "enabled": true, "maxDepth": 10 },
      "semantics": { "enabled": true, "languages": ["typescript"] },
      "domain": { "enabled": false }
    },
    "autoUpdate": {
      "enabled": false,
      "gitHook": "post-commit"
    },
    "plugins": ["typescript"],
    "ai": null
  }
}
```

## CLI 명령어
- `carpdm-harness ontology --generate`: 전체 재생성
- `carpdm-harness ontology --refresh`: 점진적 갱신
- `carpdm-harness ontology --status`: 상태 확인
- `carpdm-harness ontology --generate --layer structure`: 특정 계층만
- `carpdm-harness ontology --generate --dry-run`: 미리보기

## 자동 갱신
`autoUpdate.enabled: true` 설정 시, git hook으로 자동 갱신됩니다.

지원 hook 종류:
- `post-commit`: 커밋 후 자동 갱신 (권장)
- `pre-push`: 푸시 전 갱신
- `manual`: 수동 실행만

## 계층별 설명

### Layer 1: Structure Map
- 디렉토리 트리 및 파일 목록
- 모듈 간 import 관계 그래프
- 언어별/확장자별 파일 통계

### Layer 2: Code Semantics
- 모든 exported 함수/클래스/인터페이스/타입
- 파일 간 의존성 그래프
- JSDoc 주석 및 시그니처

### Layer 3: Domain Knowledge (AI 필요)
- 프로젝트 아키텍처 요약
- 도메인 패턴 및 컨벤션
- 용어집 (Glossary)

## 플러그인
현재 지원 플러그인: `typescript`

향후 추가 예정: `python`, `go`, `rust`
