---
name: harness-repo-analyze
description: 외부 GitHub 레포지토리를 분석합니다. "레포 분석", "repo analyze", "github 분석", "통합 가능성", "코드 분석 github", "외부 레포"를 요청할 때 사용합니다.
---

외부 GitHub 레포지토리를 분석하고 현재 프로젝트와의 통합 가능성을 평가합니다.

## Argument: $ARGUMENTS

인자에서 레포지토리 URL 또는 owner/repo를 추출합니다:
- `facebook/react` → repoUrl: "facebook/react"
- `https://github.com/vercel/next.js` → repoUrl: "https://github.com/vercel/next.js"
- `facebook/react 자세히` → repoUrl: "facebook/react", depth: "deep"
- `facebook/react 빠르게` → repoUrl: "facebook/react", depth: "quick"
- 인자 없음 → 사용자에게 레포지토리 URL 질문

## 깊이 키워드 매핑

| 키워드 | depth |
|--------|-------|
| `빠르게`, `간단히`, `요약`, `quick` | quick |
| (기본) | standard |
| `자세히`, `깊이`, `deep`, `패턴`, `아키텍처` | deep |

---

## Step 1: 인자 파싱

`$ARGUMENTS`에서 레포지토리 식별자와 깊이 키워드를 분리합니다.

인자가 없으면 질문합니다:
"분석할 GitHub 레포지토리를 알려주세요. (예: facebook/react)"

---

## Step 2: 분석 실행

```tool
harness_repo_analyze({
  projectRoot: "<감지된 프로젝트 루트>",
  repoUrl: "<추출된 레포 URL>",
  depth: "<감지된 깊이>"
})
```

---

## Step 3: 결과 해석

분석 결과를 읽고 사용자에게 요약합니다:
- 기본 정보 (언어, Stars, 라이선스)
- 통합 가능성 점수와 등급
- 의존성 충돌 여부
- 통합/이식 제안

통합 등급에 따라 구체적 조언을 제공합니다:
- **easy**: "직접 의존성으로 추가하거나 코드를 이식할 수 있습니다."
- **moderate**: "부분 이식이 가능합니다. 다음 주의점을 확인하세요."
- **hard**: "직접 이식보다는 컨셉을 참고하는 것이 효율적입니다."
- **impractical**: "통합이 어렵습니다. 대안을 검토하세요."

---

## 후속 안내

- `deep` 분석이 아니었으면: "더 자세한 패턴 분석이 필요하면 `deep`으로 다시 분석할 수 있습니다."
- 통합 가능성이 높으면: "통합을 진행하시려면 `/plan-gate`로 계획을 수립하세요."
