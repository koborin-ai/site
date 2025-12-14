# /commit-push-pr

## Overview

`/commit-push-pr` automates the end-to-end workflow from creating a branch to opening a GitHub pull request. Starting from `main` (or another base branch), the agent creates a feature branch, stages and commits the changes, pushes to `origin`, generates a high-quality PR description that matches `.github/pull_request_template.md`, and assigns the PR to `@nozomi-koborinai`.

## Usage

```text
/commit-push-pr -m "feat(scope): short summary" [-b <base=main>] [--draft]
```

- `-m, --message` (required): commit message (use Conventional Commits when possible).
- `-b, --base` (optional): base branch for the PR (default: `main`).
- `--draft` (optional): create the PR as a draft instead of ready-for-review.

## Prerequisites

- Local quality checks already ran manually (app: `npm run lint`, `npm run test`, `npm run typecheck`; infra: `terraform fmt -check && terraform validate` in each stack under `infra/`). This command will not block on failures.
- GitHub CLI (`gh`) is installed and authenticated (`gh auth status`).
- Run the command from the base branch (usually `main`) with your worktree containing uncommitted changes, or from an existing feature branch if you want to reuse it.

## Execution Flow (steps)

### 1. Generate a branch name

- Derive the branch prefix from the commit type:
  - `feat(scope): ...` → `feature/scope-<english-summary>`
  - `fix(scope): ...` → `fix/scope-<english-summary>`
  - `refactor(scope): ...` → `refactor/scope-<english-summary>`
  - `docs`: `docs/<english-summary>`
  - When the commit lacks a scope: `<type>/<english-summary>`
- Translate Japanese summaries into concise English.
- Replace spaces or symbols (`:`, `(`, `)`) with hyphens; keep lowercase kebab-case only.

### 2. Create (or reuse) the branch

- Capture the current branch via `git rev-parse --abbrev-ref HEAD`.
- If currently on the base branch, create the generated branch with `git checkout -b <branch>`.
- If already on a feature branch, reuse it after confirming with the user.
- Abort if the new branch already exists and the user prefers a different name.

### 3. Stage and commit changes

- Run `git status --porcelain` to ensure there are modifications.
- Stage everything with `git add -A` (or ask the user if changes should be split).
- Create a commit using the provided message: `git commit -m "<message>"`.
- If there are no staged changes, inform the user and stop.

### 4. Push and confirm PR creation

- Push the branch: `git push -u origin <branch>`.
- Prompt the user: "Ready to create a PR now?" and continue only after confirmation.

### 5. Generate the PR body with AI assistance

Gather context before drafting the PR:

- `git log origin/<base>..HEAD --oneline` — recent commits.
- `git diff origin/<base>...HEAD --stat` — file summary.
- `git diff origin/<base>...HEAD` — detailed diff (inspect key files only when large).
- `.github/pull_request_template.md` — required sections.

Populate each template section:

1. **Purpose / Background** — why the change exists, the problem being solved.
2. **Summary of changes** — major modifications grouped by layer (UI, server, infra, docs, tests).
3. **Verification steps** — commands and manual checks to reproduce the validation.
4. **Impact / Compatibility** — note API/db schema changes, breaking behavior, migrations.
5. **Linked issues / docs** — reference relevant tickets or markdown pages.
6. **Checklist** — mark only the items actually satisfied.

### 6. Create the PR

- Title: last commit subject (`git log -1 --pretty=%s`).
- Body: AI-generated content saved to a temporary file.
- Base branch: `-b` argument or `main`.
- Command:

```bash
cat <<'EOF' >/tmp/pr-body.md
$AI_GENERATED_BODY
EOF

gh pr create   --base <base>   --title "$(git log -1 --pretty=%s)"   --body-file /tmp/pr-body.md   --assignee "nozomi-koborinai"   $( [ "$IS_DRAFT" = "true" ] && echo "--draft" )

rm /tmp/pr-body.md
```

### 7. Output the PR URL

Display the link returned by `gh pr create` so the user can review or share it immediately.

## AI analysis points

### Classify the change set

- **Frontend:** files under `app/` or `app/src`.
- **Backend / server:** route handlers, API logic.
- **Infrastructure:** `infra/**`.
- **Documentation:** `docs/`, `AGENTS.md`, `README.md`.
- **Tests:** `*.test.ts`, `tests/`, Playwright specs.

### Interpret commit types

- `feat`: new capability.
- `fix`: bug fix.
- `refactor`: internal restructuring.
- `test`: new or updated tests.
- `docs`: documentation-only.
- `chore`: tooling, configs, or dependencies.

### Detect high-risk changes

- Database schema changes (e.g., Prisma, SQL files).
- API contract changes under `app/api`.
- Infrastructure modifications (Terraform HCL files).
- Security-sensitive updates (auth, IAM, secrets).

## Notes

- Assume `origin` points to GitHub.
- Run the command on `main` (or the chosen base) unless you already have a feature branch.
- If branch creation fails because it already exists, ask the user to supply a new name.
- PR descriptions must reflect reality; users can tweak wording later, but the initial content should be high quality.

## Examples

### Case 1: Running from `main`

```bash
git checkout main
# ... implement changes ...

/commit-push-pr -m "feat(production): enforce edit constraints"
```

Actions performed:

1. Generated branch `feature/production-enforce-edit-constraints`.
2. `git checkout -b feature/production-enforce-edit-constraints`.
3. `git add -A && git commit -m "feat(production): enforce edit constraints"`.
4. `git push -u origin feature/production-enforce-edit-constraints`.
5. Created a PR with an AI-generated description.

### Case 2: Reusing an existing branch

```bash
git checkout feature/my-custom-branch
# ... implement changes ...

/commit-push-pr -m "docs: refresh README"
```

Actions performed:

1. Detected current branch `feature/my-custom-branch` and reused it.
2. Skipped branch creation.
3. Staged, committed, and pushed changes.
4. Generated the PR body and ran `gh pr create` targeting `main`.

## Example PR body

```markdown
# Purpose / Background
- Prevent editing critical production order fields when downstream shipping records exist.
- Maintains data integrity between planning and fulfillment phases.

## Summary of Changes
- **UI**: `ProductionInstructionUpsertForm.tsx` — added read-only enforcement when child shipments are present.
- **Application layer**: `update-production-instruction.test.ts` — new coverage for read-only scenarios.
- **Docs**: Updated `phase-editability.md` with the new editing rule.

## Verification Steps
1. Create a production instruction and add a shipment.
2. Open the edit screen and confirm quantity/exchange fields are disabled while metadata remains editable.
3. Run `npm run test --prefix app`.

## Impact / Compatibility
- Affects only the production instruction edit screen.
- No API or schema changes.
- No breaking changes.

## Related Issue / Docs
- See `docs/external/phase-editability.md` for the governing rules.

## Checklist
- [x] Conventional Commit in the latest commit title.
- [x] Base branch: main.
- [x] Self-assigned (`@nozomi-koborinai`).
- [x] Local checks executed before running the command.
  - [x] npm run lint --prefix app
  - [x] npm run test --prefix app
  - [x] npm run build --prefix app
  - [ ] npm run test --prefix infrastructure (not needed here)
```

Refer to the Cursor custom command docs for details on how `.cursor/commands/*.md` definitions are consumed.
