---
description: "프로젝트 온톨로지를 생성하거나 갱신합니다"
---

# 온톨로지 생성/갱신

## 구조/시맨틱 계층 생성 (자동)
아래 명령어로 Layer 1(구조)과 Layer 2(시맨틱)를 자동 생성합니다:

```bash
npx carpdm-harness ontology --generate
```

## 도메인 지식 계층 생성 (AI 분석)
Layer 1+2가 생성된 후, 아래 절차로 도메인 지식을 분석해주세요:

1. `.agent/ontology/ONTOLOGY-STRUCTURE.md`와 `.agent/ontology/ONTOLOGY-SEMANTICS.md`를 읽습니다
2. 프로젝트의 주요 소스 파일(진입점, 핵심 모듈)을 추가로 읽습니다
3. 아래 항목을 분석하여 `.agent/ontology/ONTOLOGY-DOMAIN.md`를 작성합니다:

### 분석 항목
- **Project Summary**: 프로젝트의 목적, 핵심 가치, 대상 사용자
- **Architecture**: 아키텍처 스타일, 계층 구조, 핵심 설계 결정, 진입점
- **Detected Patterns**: 반복되는 코드 패턴 (이름, 설명, 적용 파일, 예시)
- **Coding Conventions**: 네이밍, 구조, 에러 처리, 테스트 등 컨벤션 (카테고리, 규칙, 근거)
- **Glossary**: 프로젝트 특화 용어 (용어, 정의, 컨텍스트)

### 출력 형식
```markdown
# ONTOLOGY-DOMAIN

> Generated: {현재시간} | Analyzed by Claude Code

## Project Summary
[프로젝트 요약]

## Architecture
- **Style**: [아키텍처 스타일]
- **Layers**: [계층 설명]
- **Entry Points**: [진입점]
- **Key Decisions**: [핵심 결정]

## Detected Patterns
### 1. [패턴명]
- **Description**: [설명]
- **Files**: [파일:줄]
- **Example**: [코드 예시]

## Coding Conventions
| Category | Rule | Evidence |
|----------|------|----------|
| ... | ... | ... |

## Glossary
| Term | Definition | Context |
|------|-----------|---------|
| ... | ... | ... |
```

## 점진적 갱신
```bash
npx carpdm-harness ontology --refresh
```
