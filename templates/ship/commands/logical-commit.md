# Logical Unit Commit

Analyze all uncommitted changes in the working directory and commit them in logical units. Each commit should represent a coherent, self-contained change.

## Instructions

### Phase 0: 검증 게이트

커밋 전에 검증이 완료되었는지 확인한다.

#### 0-1. 기존 검증 결과 확인

```bash
# verify-loop 결과 확인
if [ -f ".omc/state/verify-loop-result" ]; then
    grep -q "Final Status: PASS" .omc/state/verify-loop-result
fi
# 또는 verify 결과 확인
if [ -f ".omc/state/verify-result" ]; then
    grep -c "| FAIL |" .omc/state/verify-result
fi
```

| 상태 | 행동 |
|------|------|
| verify-loop-result PASS 존재 | 계속 진행 |
| verify-result PASS만 존재 (FAIL 없음) | 계속 진행 |
| verify 결과 FAIL 존재 | 차단: "검증 실패 항목이 있습니다. 수정 후 다시 시도하세요" |
| verify 결과 없음 | **→ 0-2 인라인 검증 실행** |

#### 0-2. 인라인 검증 (verify 결과 없을 때 자동 실행)

기존 검증 결과가 없으면 커밋 전 경량 검증을 직접 실행한다.
프로젝트의 `package.json` scripts 또는 빌드 도구를 감지하여 가용한 검증만 수행한다.

**감지 및 실행 순서:**

```bash
# 1. 빌드 검증 (package.json에 build 스크립트가 있으면)
npm run build 2>&1

# 2. 타입 검증 (package.json에 typecheck 스크립트가 있으면)
npm run typecheck 2>&1
# 또는 tsconfig.json이 있으면
npx tsc --noEmit 2>&1

# 3. 테스트 실행 (package.json에 test 스크립트가 있으면)
npm test 2>&1
```

**언어별 감지 테이블:**

| 감지 파일 | 빌드 | 타입 체크 | 테스트 |
|----------|------|----------|-------|
| `package.json` | `npm run build` (scripts.build 존재 시) | `npm run typecheck` 또는 `npx tsc --noEmit` (tsconfig.json 존재 시) | `npm test` (scripts.test 존재 시) |
| `pyproject.toml` / `setup.py` | — | `mypy .` (설정 존재 시) | `pytest -q` |
| `go.mod` | `go build ./...` | `go vet ./...` | `go test ./...` |
| `Cargo.toml` | `cargo build` | — | `cargo test` |

> 감지된 도구가 하나도 없으면 경고만 출력하고 계속 진행한다.

**판정:**

| 결과 | 행동 |
|------|------|
| 모든 검증 통과 (exit 0) | `[인라인 검증 PASS]` 출력 → 계속 진행 |
| 하나라도 실패 (exit ≠ 0) | 차단: 실패 출력을 표시하고 "수정 후 다시 시도하세요" |
| 검증 도구 없음 | 경고: "검증 도구를 감지하지 못했습니다" → 계속 진행 |

> 검증 없이 커밋하는 것은 "확인했습니다" 수준의 자기 신고입니다. 실행 증거가 있어야 합니다.

1. Run `git status -s` to see all uncommitted changes (staged and unstaged).
2. Run `git diff --stat HEAD` to understand the scope of changes.
3. Run `git log --oneline -5` to see the recent commit style.

4. **Analyze and group** the changes into logical units based on:
   - **Layer**: DB schema/migrations, domain models, backend stores/services, API routes, tests, frontend config/infra, frontend components
   - **Feature**: Group files that implement the same feature together
   - **Concern**: Separate config/docs from implementation, tests from source code
   - Common groupings:
     - `chore:` config, docs, build setup, .gitignore
     - `feat:` schema + models (data layer)
     - `feat:` stores/services (business logic)
     - `feat:` API routes + controllers (API layer)
     - `test:` test files
     - `feat:` frontend infra (deps, config, utils, hooks)
     - `feat:` frontend components (UI)
     - `fix:` bug fixes
     - `refactor:` restructuring without behavior change

5. **Exclude large binaries** (*.pt, *.bin, *.onnx, etc.) - add to .gitignore if needed.

6. **For each logical group**, in order from lowest to highest layer:
   - Stage only the files belonging to that group using `git add <specific files>`
   - Write a clear commit message following Conventional Commits format
   - First line: `type: concise description` (under 72 chars)
   - Body: 2-3 lines explaining what and why
   - End with: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
   - Use a HEREDOC for the message: `git commit -m "$(cat <<'EOF' ... EOF)"`

7. After all commits, run `git log --oneline` to show the result.

## Commit Message Types
- `feat:` new feature
- `fix:` bug fix
- `test:` adding/updating tests
- `chore:` maintenance, config, deps
- `refactor:` code restructuring
- `docs:` documentation only
- `style:` formatting, no logic change
- `perf:` performance improvement
- `ci:` CI/CD changes

## Rules
- Never use `git add .` or `git add -A` - always add specific files
- Never commit secrets (.env, credentials, API keys)
- Never commit large binary files
- Each commit should ideally be independently buildable/testable
- Prefer more granular commits over fewer large ones
- Backend and frontend changes should be in separate commits
- Test commits should reference what they test

## Argument: $ARGUMENTS
If arguments are provided, use them as additional context for grouping (e.g., "focus on backend only", "split frontend by tab").
