# Verify (실행 기반 검증)

변경사항에 대해 **실행 기반 검증**을 수행한다. 패턴 매칭이나 자기 신고가 아닌, **실제 실행 결과**로 동작을 증명한다.

> 원칙: "확인했습니다"는 증거가 아니다. 실행 결과가 증거다.

## Instructions

### Step 1: 검증 대상 수집

```bash
# 변경된 파일 수집
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
git status -s
```

`$ARGUMENTS`가 있으면 해당 파일/디렉토리만 대상으로 한다.
없으면 모든 미커밋 변경사항이 대상이다.

### Step 1.5: 적신호 감지 (검증 전 자기 점검)

검증을 시작하기 전에, 다음 적신호가 자신에게 해당하는지 점검한다.
**하나라도 해당하면 즉시 멈추고 실제 검증을 수행해야 한다.**

**완곡한 표현 적신호:**
- "should work" / "아마 될 것이다" / "probably fixed"
- "~한 것 같다" / "문제없을 것이다"
- "확인했습니다" (실행 결과 없이)
- "테스트는 통과할 것이다" (실행 안 하고)

**상황 적신호:**
- 검증 전에 이미 만족감이나 완료감을 느끼고 있다
- 테스트 없이 커밋이나 PR 생성 직전이다
- 서브에이전트의 성공 보고를 독립적으로 확인하지 않았다
- "이 부분은 안 바뀌었으니 괜찮다"고 가정하고 있다
- 부분적인 검사 결과에 의존하고 있다 (전체를 돌리지 않음)

**적신호 발견 시 → 반드시 Step 2부터 실제 실행으로 검증한다.**

### Step 2: 유형별 검증 전략 결정 (IDENTIFY-EXECUTE-READ-CONFIRM-DECLARE)

> **"신선한 검증 증거 없이 완료 주장 금지"**

모든 검증은 아래 5단계를 따른다:
1. **IDENTIFY**: 주장을 증명할 명령어/방법을 식별
2. **EXECUTE**: 완전하고 신선하게 실행 (캐시된 결과 사용 금지)
3. **READ**: 모든 출력과 종료 코드를 빠짐없이 검토
4. **CONFIRM**: 출력이 실제로 주장을 지원하는지 대조 확인
5. **DECLARE**: 증거를 첨부하여 주장 선언

변경 파일을 아래 유형으로 분류하고, 각 유형에 맞는 검증을 실행한다:

| 유형 | 파일 패턴 | 검증 방법 |
|------|----------|----------|
| **Shell 훅/스크립트** | `*.sh` | 시뮬레이션 환경에서 실제 실행 |
| **MD 템플릿/커맨드** | `*.md` (commands/, templates/) | 필수 섹션·키워드 구조 검증 |
| **소스 코드** | `*.py, *.ts, *.js, *.go` 등 | 테스트 실행 + 빌드 + lint |
| **설정 파일** | `*.json, *.yaml, *.toml` | 구문 유효성 검증 |
| **문서** | `README.md, *.md` (루트) | 수치/키워드 교차 확인 |

### Step 3: Shell 스크립트 검증 (*.sh)

**시뮬레이션 환경 구축 후 실제 실행한다.** 패턴 매칭만으로는 불충분하다.

```bash
# 1. 임시 프로젝트 환경 생성
SIMDIR=$(mktemp -d)
cd "$SIMDIR"
git init

# 2. 테스트 대상 파일 복사
cp -r <원본_hooks_경로>/* "$SIMDIR/.claude/hooks/"
# 필요한 템플릿/설정도 복사

# 3. 시나리오별 상태 설정 후 실행
```

**시나리오 매트릭스 (훅별):**

| 훅 | 시나리오 | 기대 결과 |
|----|---------|----------|
| `plan-guard.sh` | plan.md 없음 | Plan-First 경고 출력 |
| `plan-guard.sh` | plan.md DRAFT | 미승인 경고 출력 |
| `plan-guard.sh` | plan.md APPROVED | SPEC-FIRST 리마인더 출력 |
| `pre-task.sh` | "빠르게 프로토타입" 키워드 | Speed Mode 감지 |
| `pre-task.sh` | "배포 준비" 키워드 | Safety Mode 감지 |
| `post-task.sh` | todo.md 잔여 항목 있음 | 잔여 TODO 경고 |
| `post-task.sh` | 반복 수정 3회 이상 | Dumb Zone 경고 |
| `code-change.sh` | plan.md IN_PROGRESS | 일반 변경 로그 리마인더 |

**실행 방법:**
```bash
# 각 시나리오를 bash -c 로 격리 실행
bash -c 'export CLAUDE_CWD="'"$SIMDIR"'"; bash "$SIMDIR/.claude/hooks/<hook>.sh"'
# 출력을 캡처하여 기대 키워드 포함 여부 확인
```

**판단 기준:**
- 훅이 exit 0으로 종료하는가?
- 기대 키워드가 출력에 포함되는가?
- 에러 메시지 없이 실행되는가?

검증 완료 후 `rm -rf "$SIMDIR"` 로 정리한다.

### Step 4: MD 템플릿/커맨드 검증 (templates/, commands/)

**필수 구조 검증:**

```
템플릿 (.md in docs/templates/):
  - 필수 섹션 헤딩 존재 확인 (##, ###)
  - 빈 섹션 없음 (헤딩 직후 내용 존재)
  - 상태 마커가 올바른 형식 (DRAFT/APPROVED/IN_PROGRESS/COMPLETED)

커맨드 (.md in commands/):
  - ## Instructions 섹션 존재
  - ## Rules 섹션 존재 (있는 경우)
  - Step 번호 순서 일관성 (Step 1, 2, 3... 건너뛰기 없음)
  - $ARGUMENTS 참조 시 ## Argument 섹션 존재
```

**교차 참조 검증:**
- 커맨드에서 참조하는 파일이 실제 존재하는지 확인
- 훅에서 참조하는 템플릿 경로가 유효한지 확인

### Step 5: 소스 코드 검증 (*.py, *.ts, *.js 등)

프로젝트에 존재하는 검증 도구를 우선 사용한다:

```bash
# 테스트
pytest -q 2>&1                          # Python
npm test 2>&1                           # Node.js
go test ./... 2>&1                      # Go

# 빌드 검증
python -m py_compile <파일> 2>&1        # Python 구문
npx tsc --noEmit 2>&1                   # TypeScript 타입
go build ./... 2>&1                     # Go 빌드

# Lint (설정이 있을 때만)
[ -f ".flake8" ] && flake8 <파일>
[ -f ".eslintrc*" ] && npx eslint <파일>
```

테스트 프레임워크가 없으면 구문 검증 + import 검증만 수행한다.

### Step 6: 설정 파일 검증 (*.json, *.yaml, *.toml)

```bash
# JSON
python3 -c "import json; json.load(open('<파일>'))" 2>&1

# YAML
python3 -c "import yaml; yaml.safe_load(open('<파일>'))" 2>&1

# TOML
python3 -c "import tomllib; tomllib.load(open('<파일>', 'rb'))" 2>&1
```

### Step 7: 문서 검증 (README.md 등)

코드 변경이 문서에 반영되었는지 교차 확인:

```
확인 항목:
  - README의 수치 (개수, 버전)가 실제 코드와 일치하는가?
  - 새 기능/파일이 추가되었으면 문서에 반영되었는가?
  - 삭제된 기능이 문서에서도 제거되었는가?
```

### Step 8: TDD 증거 확인

TDD가 활성화된 프로젝트에서 추가 검증을 수행한다.

**TDD 활성 여부 확인:**
```bash
python3 -c "
import json
try:
    data = json.load(open('.omc/project-memory.json'))
    print('ENABLED' if data.get('tdd', {}).get('enabled', False) else 'DISABLED')
except:
    print('DISABLED')
" 2>/dev/null
```

**TDD ENABLED인 경우 아래를 확인한다:**

1. **tdd-result 존재 확인**: `.omc/state/tdd-result` 파일이 있는가?
2. **사이클 완료 확인**: RED → GREEN → REFACTOR 모두 DONE인가?
3. **테스트 매핑 확인**: 변경된 소스 파일 각각에 대응하는 테스트 파일이 존재하는가?
4. **테스트 실행**: 대응 테스트를 실행하여 PASS 확인

```
확인 항목:
  - .omc/state/tdd-result 존재 + REFACTOR DONE
  - 변경된 *.py → tests/test_*.py 존재 + PASS
  - 변경된 *.ts → *.test.ts 또는 *.spec.ts 존재 + PASS
  - .omc/state/tdd-edit-order에서 TEST→SOURCE 순서 확인
```

**판단 기준:**
- tdd-result 없음 → FAIL (TDD 사이클 미실행)
- 테스트 파일 미존재 → FAIL (테스트 커버리지 부족)
- 테스트 실패 → FAIL (구현 오류)
- 모두 통과 → PASS

### Step 9: 증거 파일 저장

모든 검증 결과를 `.omc/state/verify-result` 에 저장한다:

```bash
mkdir -p .omc/state
```

**저장 형식:**
```
## Verify Result
- Date: YYYY-MM-DD HH:MM
- Target: [검증 대상 파일 수]개 파일
- Duration: [소요 시간]

### Results
| # | 유형 | 대상 | 결과 | 상세 |
|---|------|------|------|------|
| 1 | shell | plan-guard.sh | PASS | 3/3 시나리오 통과 |
| 2 | shell | post-task.sh | PASS | 5/5 시나리오 통과 |
| 3 | template | plan-template.md | PASS | 필수 섹션 8/8 |
| 4 | code | main.py | FAIL | pytest 2건 실패 |

### Summary
- Total: N개 대상
- Pass: N개
- Fail: N개
- Skip: N개

### Failed Details
(실패 항목의 에러 메시지/출력)
```

### Step 9.5: 검증 완전성 확인

보고서 작성 전에 아래 검증 실수를 저지르지 않았는지 확인한다:

| 주장 | 실제 필요한 증거 |
|------|-----------------|
| "테스트 통과" | 테스트 스위트 실행 + 0개 실패 출력 첨부 |
| "빌드 성공" | 빌드 명령어 실행 + exit code 0 확인 |
| "버그 해결" | 원래 실패하던 테스트/시나리오 실행 + 이제 통과 확인 |
| "요구사항 충족" | 각 요구사항을 개별적으로 체계적 검증 |
| "기존 기능 안 깨짐" | 전체 테스트 스위트 실행 + 회귀 없음 확인 |
| "성능 문제 없음" | 벤치마크 또는 측정 결과 첨부 |

### Step 10: 최종 보고

```
========================================
  Verify 결과
========================================

✅ PASS: N개
❌ FAIL: N개
⏭️  SKIP: N개

[실패 항목 상세]
...

증거 파일: .omc/state/verify-result
```

**FAIL이 하나라도 있으면:**
- 실패 원인을 분석하여 수정 방안 제시
- 수정 후 `/verify`를 다시 실행하여 재검증

## Rules
- **실행 없는 검증은 검증이 아니다**: "확인했습니다"로 끝내지 말고 실행 결과를 붙인다
- **시뮬레이션 환경은 격리한다**: 원본 프로젝트에 영향 없도록 tmpdir 사용
- **증거를 남긴다**: `.omc/state/verify-result`에 항상 결과 저장
- **실패 시 즉시 보고**: FAIL 항목은 원인 분석 + 수정 방안 포함
- **시뮬레이션 후 정리**: 임시 디렉토리는 반드시 삭제
- **검증 범위 최소화**: 변경된 파일만 검증 (전체 프로젝트 스캔 금지)
- **프로젝트 적응**: 테스트/빌드 도구는 프로젝트에 존재하는 것 우선 사용
- **적신호 자기점검**: 완곡한 표현이나 가정이 떠오르면 실행 검증으로 전환
- **5단계 검증**: IDENTIFY→EXECUTE→READ→CONFIRM→DECLARE 순서 준수
- **주장-증거 대응**: 모든 주장에 실행 결과 증거를 반드시 첨부

## Argument: $ARGUMENTS
검증 대상 (빈 경우 전체 미커밋 변경사항). 파일 경로, 디렉토리, 또는 유형(shell/code/docs) 지정 가능.
