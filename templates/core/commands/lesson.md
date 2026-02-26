# Lesson — 교훈 기록

`.agent/lessons.md`에 교훈을 추가한다.

## Argument: $ARGUMENTS
교훈 내용 (예: "FSM 전이 테이블 변경 시 반드시 테스트도 갱신해야 함")

## Instructions

### Step 1: 입력 확인

$ARGUMENTS가 비어있으면 AskUserQuestion으로 교훈 내용을 물어본다.

### Step 2: lessons.md 확인

`.agent/lessons.md` 파일이 없으면 생성:

```markdown
# Lessons Learned

작업 중 배운 교훈을 기록합니다.
```

### Step 3: 중복 확인

기존 lessons.md에 유사한 내용이 있는지 확인한다.
유사 내용이 있으면 "이미 유사한 교훈이 있습니다: '<기존 내용>'. 그래도 추가할까요?" 확인.

### Step 4: 교훈 추가

파일 끝에 타임스탬프와 함께 추가:

```markdown
- [YYYY-MM-DD] <교훈 내용>
```

### Step 5: 결과 보고

```
📚 교훈 기록 완료
  "<교훈 내용>"
  → .agent/lessons.md에 저장됨
```

## Rules
- 한 줄로 간결하게 기록 (장문은 핵심만 추출)
- 중복 교훈은 추가하지 않는다
- 타임스탬프는 YYYY-MM-DD 형식
