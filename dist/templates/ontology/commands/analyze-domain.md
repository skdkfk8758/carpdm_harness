---
description: "온톨로지 도메인 지식을 AI로 분석합니다 (Claude Code 전용)"
---

# 도메인 지식 분석

Layer 1(구조)과 Layer 2(시맨틱) 온톨로지를 기반으로 프로젝트의 도메인 지식을 분석합니다.

## 절차

1. **온톨로지 기반 데이터 읽기**
   - `.agent/ontology/ONTOLOGY-STRUCTURE.md` 읽기
   - `.agent/ontology/ONTOLOGY-SEMANTICS.md` 읽기

2. **핵심 소스 분석**
   - 진입점 파일 (src/index.ts 등) 읽기
   - 주요 타입 정의 파일 읽기
   - 핵심 비즈니스 로직 파일 읽기

3. **도메인 지식 추출 및 작성**
   아래 형식으로 `.agent/ontology/ONTOLOGY-DOMAIN.md`를 작성합니다:

   - **Project Summary**: 프로젝트 목적과 핵심 가치
   - **Architecture**: 아키텍처 스타일, 계층, 핵심 결정
   - **Detected Patterns**: 코드에서 반복되는 설계 패턴
   - **Coding Conventions**: 네이밍, 구조, 에러 처리 등 컨벤션
   - **Glossary**: 프로젝트 특화 용어 정의

4. **검증**
   - 작성된 내용이 실제 코드와 일치하는지 확인
   - 주요 패턴/컨벤션에 대한 코드 근거(파일:줄) 포함

## 주의사항
- 모든 분석은 한국어로 작성
- 추측이 아닌 코드 근거 기반으로 작성
- 패턴/컨벤션은 최소 2개 이상의 파일에서 확인된 것만 기록
