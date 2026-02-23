# 시나리오: 긴급 버그 수정 — "결제 500 에러"

Speed Mode가 자동으로 활성화되는 버그 수정 시나리오입니다.

## 전제 조건

- Agent Harness 적용 완료
- 프로덕션에서 결제 시 500 에러 발생

---

## Step 1: 긴급 요청

```
사용자 입력:
> 긴급! 결제할 때 500 에러가 나.
> 어떤 사용자는 되고 어떤 사용자는 안 되는 것 같아.
```

## Step 2: pre-task.sh — Speed Mode 자동 감지

```
[TASK MODE] Speed ⚡
  감지 키워드: "긴급"
  → 인터뷰 생략
  → 최소 plan 작성 후 바로 수정
  → 테스트 필수
```

## Step 3: 원인 분석 + 간소화 plan.md

Claude가 에러를 추적합니다:

```
분석 과정:
1. src/routes/payment_routes.py → POST /api/payments/checkout
2. src/services/payment_service.py → process_payment()
3. line 42: user.billing_address.zip_code
   → billing_address가 None인 사용자에서 에러!
```

```markdown
# Fix: 결제 500 에러

## 상태: APPROVED (Speed — 자동 승인)

## 원인
payment_service.py line 42에서 billing_address가
None인 경우 AttributeError 발생

## 수정
- payment_service.py: billing_address null 체크 추가
- 테스트: billing_address 없는 사용자 결제 테스트 추가

## 영향 범위
- payment_service.py (1줄 수정)
- tests/test_payment.py (1 테스트 추가)
```

## Step 4: 코드 수정

### 수정 전

```python
# src/services/payment_service.py, line 42
zip_code = user.billing_address.zip_code
```

### 수정 후

```python
# src/services/payment_service.py, line 42
if not user.billing_address:
    raise PaymentError("청구지 주소가 설정되지 않았습니다")
zip_code = user.billing_address.zip_code
```

### code-change.sh 자동 기록

```
.omc/change-log.md:
| 15:22:10 | MODIFY | `src/services/payment_service.py` | 결제 500 에러 수정 |
| 15:23:05 | MODIFY | `tests/test_payment.py` | 결제 500 에러 수정 |
```

## Step 5: 테스트 실행

```bash
pytest tests/test_payment.py -v
# ✓ test_checkout_success
# ✓ test_checkout_no_billing_address  ← 새로 추가
# ✓ test_checkout_insufficient_balance
# 3 passed
```

## Step 6: 검증 + 커밋

```
[POST TASK] 교차 검증
  → 2개 파일 변경 감지
  → 검증 결과: PASS (수정 범위 최소, 방어적 코드 추가)

/logical-commit "fix: 청구지 미설정 사용자 결제 시 500 에러"
```

---

## Speed Mode에서 생략되는 것과 유지되는 것

| 항목 | Speed Mode | Standard Mode |
|------|-----------|---------------|
| Discovery Interview | 생략 | 진행 |
| plan.md | 간소화 (원인+수정만) | 전체 SPARC |
| 사용자 승인 | 자동 승인 | 수동 승인 필요 |
| DDD 패턴 체크 | 유지 | 유지 |
| 변경 기록 | 유지 | 유지 |
| 테스트 실행 | 필수 | 필수 |
| 교차 검증 | 기본만 | 전체 |

## 핵심 포인트

- **"긴급", "빨리", "핫픽스"** 키워드가 Speed Mode를 트리거
- 인터뷰와 상세 계획을 생략하지만 **테스트와 변경 기록은 유지**
- 수정 범위를 최소화하여 사이드 이펙트를 방지
