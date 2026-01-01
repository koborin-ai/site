# /change-type

## Overview

Classify the current change set as a **Behavior Change** or a **Structure Change**, then recommend:

- the correct PR label (`change:behavior` or `change:structure`)
- which local verification commands to run
- what CI is expected to run

## Usage

```text
/change-type
```

## Prerequisites

- A clear list of changed files (diff) is available.
- If intent is ambiguous, default to **Behavior Change**.

## Execution Flow (steps)

### 1. Inspect the change set

- Identify changed files/paths.
- Identify intent: externally observable vs refactor/internal.

### 2. Classify

- **Behavior Change**: Anything externally observable changes (site output, infra behavior, CI behavior).
- **Structure Change**: No intended behavior change; refactor/cleanup/formatting/internal docs.
- If uncertain → **Behavior Change**.

### 3. Apply repo-specific heuristics

Treat as **Behavior Change** if the diff touches any of:

- `app/src/content/docs/**` (published content)
- `app/src/**` (components/layouts/pages)
- `app/public/**` or `app/src/assets/**` (published assets)
- `app/astro.config.mjs`, `app/nginx/**`, `app/Dockerfile`
- `infra/src/**` (Pulumi stacks)
- `.github/workflows/**` (CI behavior)

Treat as **Structure Change** candidates if the diff touches only:

- `README.md`, `AGENTS.md`, `CLAUDE.md`
- `.github/release.yml`
- other non-deployed repository documentation files

### 4. Output decision + next actions

Return:

1. **Change type**: `behavior` or `structure`
2. **PR label**: `change:behavior` or `change:structure`
3. **Local checks**
4. **CI expectations**

## AI considerations

- Prefer safety: when uncertain, choose **Behavior Change**.
- Treat `.github/workflows/**` edits as **Behavior Change** (CI behavior changes).

## Notes

- App CI uses the PR label to decide whether to skip `npm audit` and `npm run build` (fast path for `change:structure`).
- Infra: never run `pulumi preview`/`pulumi up` locally (CI only).

## Examples

### Example 1: Content update

- Changed: `app/src/content/docs/tech/foo.mdx`
- Result: Behavior Change → label `change:behavior`

### Example 2: Refactor only

- Changed: `AGENTS.md` wording only
- Result: Structure Change → label `change:structure`


