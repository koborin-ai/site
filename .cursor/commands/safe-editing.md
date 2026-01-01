# /safe-editing

## Overview

`/safe-editing` ensures all AI-driven changes happen in an isolated Git worktree instead of the main working directory. Use this command when:

- AI is about to make its **first code modification** in the current session
- User explicitly requests safe/isolated editing
- Starting a new feature implementation or bug fix

## Usage

```text
/safe-editing [branch-name]
```

- `branch-name` (optional): the Git branch to use for the worktree.
  - If omitted, generate a branch name from the task type + summary.

## Workflow

### 1. Check Current State

```bash
git rev-parse --show-toplevel
git worktree list
git status --porcelain
```

Verify:

- In a Git repository
- No uncommitted changes in main directory
- Not already in a worktree

If uncommitted changes exist, ask user how to proceed (stash, commit, or abort).

### 2. Determine Branch Name

Analyze the task and generate a branch name:

| Task Type | Branch Format | Example |
|-----------|---------------|---------|
| New feature | `feature/<scope>-<summary>` | `feature/auth-add-oauth` |
| Bug fix | `fix/<scope>-<summary>` | `fix/api-null-pointer` |
| Refactor | `refactor/<scope>-<summary>` | `refactor/utils-cleanup` |
| Docs | `docs/<summary>` | `docs/update-readme` |

- Use lowercase kebab-case
- Translate Japanese to English
- Keep concise but descriptive

### 3. Create Worktree

Use the `gwt` alias (defined in `.zshrc`):

```bash
gwt <branch-name>
```

This creates:

- New branch: `<branch-name>`
- Worktree at: `../git-worktrees/<repo-name>-<branch-name>`

### 4. Navigate to Worktree

```bash
cd ../git-worktrees/<repo-name>-<branch-name>
```

Confirm the switch:

```bash
pwd
git branch --show-current
```

### 5. Perform Changes

Execute the requested modifications in the worktree directory. All file edits, creations, and deletions happen here.

### 6. Commit, Push, and Create PR

Use the `/commit-push-pr` command to:

1. Stage and commit changes
2. Push to remote
3. Create pull request

### 7. Cleanup (After PR Merge)

Once the PR is merged, clean up the worktree:

```bash
cd <original-repo-path>
gwtr ../git-worktrees/<repo-name>-<branch-name>
```

## Quick Reference

| Alias | Command | Purpose |
|-------|---------|---------|
| `gwt <branch>` | `git worktree add ../git-worktrees/<repo>-<branch> -b <branch>` | Create worktree |
| `gwtl` | `git worktree list` | List worktrees |
| `gwtr <path>` | `git worktree remove <path>` | Remove worktree |

## Notes

- Always confirm with user before creating worktree
- If worktree already exists for the task, reuse it
- Keep main directory clean for other work
