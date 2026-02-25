# Security Setup (보안 권한 설정)

프로젝트에 보안 permissions deny 리스트를 설정하여 위험한 도구 호출을 사전 차단한다.

> 원칙: 훅은 런타임 방어선, permissions deny는 정적 방어선. 양쪽 모두 필요하다.

## Instructions

### Step 1: 현재 설정 확인

`.claude/settings.local.json` 파일이 존재하는지 확인하고, 기존 permissions 설정을 읽는다.

### Step 2: deny 리스트 생성

다음 카테고리별 deny 규칙을 `.claude/settings.local.json`의 `permissions.deny` 배열에 추가한다.
기존 deny 규칙이 있으면 **병합**한다 (중복 제거).

#### 카테고리 1: 파괴적 파일 작업
```json
"Bash(rm -rf /)*",
"Bash(rm -rf ~)*",
"Bash(rm -rf .)*",
"Bash(rm -rf *)*",
"Bash(sudo:*)",
"Bash(chmod 777:*)",
"Bash(>/dev/*)"
```

#### 카테고리 2: 외부 코드 실행 차단
```json
"Bash(curl*|*sh)*",
"Bash(wget*|*sh)*",
"Bash(eval *)*",
"Bash(bash -c *)*",
"Bash(sh -c *)*",
"Bash(node -e *)*",
"Bash(perl -e *)*",
"Bash(python3 -c *import os*)*"
```

#### 카테고리 3: 환경/프로필 보호
```json
"Bash(*>~/.ssh/*)",
"Bash(*>~/.zshrc)*",
"Bash(*>~/.bashrc)*",
"Bash(*>~/.profile)*",
"Bash(*>~/.zprofile)*"
```

#### 카테고리 4: Git 위험 명령
```json
"Bash(git push --force*main)*",
"Bash(git push -f*main)*",
"Bash(git push --force*master)*",
"Bash(git push -f*master)*",
"Bash(git reset --hard origin/*)*",
"Bash(git clean -f*)*",
"Bash(git checkout -- .)*",
"Bash(git restore .)*"
```

#### 카테고리 5: 패키지 배포 보호
```json
"Bash(npm publish)*",
"Bash(pnpm publish)*",
"Bash(yarn publish)*"
```

#### 카테고리 6: 시스템 명령 차단
```json
"Bash(osascript*)*",
"Bash(crontab*)*",
"Bash(launchctl*)*",
"Bash(docker system prune)*",
"Bash(mkfs*)*",
"Bash(dd if=*)*"
```

### Step 3: 설정 파일 저장

병합된 설정을 `.claude/settings.local.json`에 저장한다.

### Step 4: 적용 확인

설정된 deny 규칙 개수와 카테고리별 요약을 보고한다.

```
========================================
  Security Permissions 설정 완료
========================================
총 deny 규칙: N개
- 파괴적 파일 작업: 7개
- 외부 코드 실행: 8개
- 환경/프로필 보호: 5개
- Git 위험 명령: 8개
- 패키지 배포: 3개
- 시스템 명령: 6개

설정 파일: .claude/settings.local.json
```

## Rules
- 기존 deny 규칙은 절대 제거하지 않는다 — 추가만 한다
- settings.local.json이 없으면 새로 생성한다
- 기존 allow/deny 외 설정은 유지한다
- JSON 구문이 유효한지 검증한다
- 적용 후 설정 파일을 다시 읽어 검증한다

## Argument: $ARGUMENTS
`--minimal` — 카테고리 1, 3만 적용 (최소 보안)
`--full` — 전체 6개 카테고리 (기본값)
`--category N` — 특정 카테고리만 적용
