# Logical Unit Commit

Analyze all uncommitted changes in the working directory and commit them in logical units. Each commit should represent a coherent, self-contained change.

## Instructions

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
