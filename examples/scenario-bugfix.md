# 시나리오: 긴급 버그 수정 — "결제 500 에러"

> carpdm-harness v4.x 기준 MCP 도구 기반 워크플로우

## 전제 조건

- carpdm-harness 설치 완료
- 프로덕션에서 결제 시 500 에러 발생

---

## Step 1: 긴급 요청

```
사용자: "긴급! 결제할 때 500 에러가 나. 어떤 사용자는 되고 어떤 사용자는 안 되는 것 같아."
```

## Step 2: /work-start

```
/work-start
→ 워크플로우 타입: bugfix
→ 브랜치 생성: fix/payment-500-error
→ .agent/plan.md 간소화 모드 (원인+수정만)
```

## Step 3: 원인 분석 + 간소화 plan.md

Claude가 에러를 추적합니다:

```
분석:
1. src/routes/payment_routes.py → POST /api/payments/checkout
2. src/services/payment_service.py → process_payment()
3. line 42: user.billing_address.zip_code
   → billing_address가 None인 사용자에서 AttributeError!
```

```markdown
# Fix: 결제 500 에러
## 상태: APPROVED

## 원인
payment_service.py L42에서 billing_address None 시 AttributeError

## 수정
- payment_service.py: billing_address null 체크 추가
- tests/test_payment.py: billing_address 없는 사용자 결제 테스트 추가

## 영향 범위
- payment_service.py (1줄 수정)
- tests/test_payment.py (1 테스트 추가)
```

## Step 4: 코드 수정

```python
# 수정 전
zip_code = user.billing_address.zip_code

# 수정 후
if not user.billing_address:
    raise PaymentError("청구지 주소가 설정되지 않았습니다")
zip_code = user.billing_address.zip_code
```

## Step 5: 검증 + 완료

```
/verify-all
→ TRUST 5: 전체 통과

/work-finish
→ /logical-commit "fix: 청구지 미설정 사용자 결제 시 500 에러"
→ /ship-pr → PR 생성
```

---

## 버그 수정 워크플로우 특징

| 항목 | bugfix 워크플로우 | feature 워크플로우 |
|------|-----------------|------------------|
| plan.md | 간소화 (원인+수정) | 전체 SPARC |
| Interview | 생략 가능 | 진행 |
| 테스트 | 필수 | 필수 |
| TRUST 5 검증 | 필수 | 필수 |

핵심: 수정 범위를 최소화하여 사이드 이펙트를 방지합니다.
