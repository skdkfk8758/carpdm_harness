# 온톨로지 가이드

## 개요
carpdm-harness 온톨로지는 프로젝트의 지식을 3계층으로 구조화합니다:

1. **Structure Map** (ONTOLOGY-STRUCTURE.md): 파일/디렉토리/모듈 관계
2. **Code Semantics** (ONTOLOGY-SEMANTICS.md): 함수/클래스/타입 의존성 + @MX 어노테이션
3. **Domain Knowledge** (ONTOLOGY-DOMAIN.md): 비즈니스 용어/패턴/컨벤션

## 설정
`carpdm-harness.config.json`의 `ontology` 필드에서 설정합니다.

```json
{
  "ontology": {
    "enabled": true,
    "outputDir": ".agent/ontology",
    "layers": {
      "structure": { "enabled": true, "maxDepth": 10, "excludePatterns": [] },
      "semantics": { "enabled": true, "languages": ["typescript"] },
      "domain": { "enabled": true }
    },
    "ai": { "provider": "claude-code" }
  }
}
```

## MCP 도구

| 도구 | 설명 |
|------|------|
| `harness_ontology_generate` | 전체 재생성 |
| `harness_ontology_refresh` | 점진적 갱신 (캐시 기반, 변경 파일만) |
| `harness_ontology_status` | 상태 확인 |
| `harness_ontology_domain_write` | Domain 레이어 직접 작성 |
| `harness_ontology_annotations` | @MX 어노테이션 조회 |

### 스킬 (슬래시 명령)

```
/generate-ontology     → harness_ontology_generate 호출
/ontology              → 생성 또는 갱신 자동 선택
```

## 계층별 설명

### Layer 1: Structure Map
- 디렉토리 트리 및 파일 목록
- 모듈 간 import 관계 그래프
- 언어별/확장자별 파일 통계
- `.gitignore` 패턴 자동 적용

### Layer 2: Code Semantics
- 모든 exported 함수/클래스/인터페이스/타입
- 파일 간 의존성 그래프 (내부 + 외부 패키지)
- @MX 어노테이션 자동 분석 (핫스팟, 의존성 방향, 복잡도)
- TypeScript/JavaScript 플러그인 내장

### Layer 3: Domain Knowledge (AI 분석)
- 프로젝트 아키텍처 요약
- 도메인 패턴 및 컨벤션
- 용어집 (Glossary)
- `claude-code` provider: Claude Code가 직접 분석 (API 키 불필요)

## 점진적 갱신

`harness_ontology_refresh`는 캐시 기반으로 변경된 파일만 처리합니다:

- **Layer 1, 2**: 항상 점진적 갱신
- **Layer 3**: 변경 비율 20% 초과 시에만 AI 재호출, 이하면 캐시 유지
- 캐시 위치: `.agent/ontology/.cache/ontology-cache.json`

## Knowledge Vault 동기화

온톨로지 생성/갱신 후 `.knowledge/ontology/`에 자동 동기화됩니다:
- `.agent/ontology/ONTOLOGY-STRUCTURE.md` → `.knowledge/ontology/structure.md`
- `.agent/ontology/ONTOLOGY-SEMANTICS.md` → `.knowledge/ontology/semantics.md`
- `.agent/ontology/ONTOLOGY-DOMAIN.md` → `.knowledge/ontology/domain.md`
