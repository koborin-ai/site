# /create-command

## Overview

`/create-command` is a meta command used to scaffold brand-new Cursor custom commands. The agent interviews the user about the command's purpose, scope, and workflow, checks for overlap with existing commands, and then writes a Markdown definition inside `.cursor/commands/` that follows the house style.

## Usage

```text
/create-command
[Describe the command goal, capabilities, and usage in free-form text]
```

**Example 1 (simple command):**

```text
/create-command
Command name: /run-tests
Goal: Run the application and infrastructure unit tests in one go and summarize the results.
Features:
- npm run lint --prefix app
- npm run test --prefix infrastructure
- Show detailed logs whenever a suite fails
- Print a single success message when everything passes
```

**Example 2 (complex workflow):**

```text
/create-command
Command name: /sync-content
Goal: Reflect Markdown/MDX schema changes in the local environment and regenerate derived artifacts.
Steps:
1. Detect modified files under content/ and scripts/content/.
2. Run npm run content:lint.
3. Run npm run content:build to regenerate the search index.
4. Run npm run typecheck --prefix app if the MDX types changed.
5. Summarize which MDX entries were touched.
Prerequisite: docker compose up content-db (local cache) is already running.
```

## Prerequisites

- The `.cursor/commands/` directory already exists.
- You understand the layout and tone of existing commands (for example `commit-push-pr.md`, `update-agents-md.md`).
- Command names must use kebab-case such as `run-tests` or `sync-content`.

## Execution Flow (steps)

### 1. Analyze the user input

Extract and organize the following information:

**Required:**

- Command name (must look like `/command-name`)
- Goal / overview
- Primary capabilities

**Optional:**

- Arguments / options
- Prerequisites
- Detailed procedure
- Cautions / caveats
- Usage examples or sample runs

**Missing information:**
Ask clarifying questions whenever required items are missing.

### 2. Check for consistency with existing commands

- **Duplicate check:** ensure no existing command shares the same name.
- **Similarity check:** ensure there is no command with the same workflow.
- **Naming rule:** verify the command name follows kebab-case.

If overlap exists, recommend merging or differentiating the scopes before moving on.

### 3. Generate the command definition

Follow the established format by using this skeleton:

```markdown
# /command-name

## Overview
[Explain the command goal and capabilities in one or two paragraphs.]

## Usage

```bash
/command-name [arguments] [options]
```

[Describe the arguments and options.]

## Prerequisites

- [Prerequisite 1]
- [Prerequisite 2]

## Execution Flow (steps)

### 1. [Step name]

- [Detailed explanation]
- [Optional sub-bullets]

### 2. [Step name]

- [Detailed explanation]

## AI considerations (optional)

[Guidance for how the agent should reason.]

## Notes

- [Note 1]
- [Note 2]

## Examples (optional)

[Concrete usage or code snippets]

```text

### 4. Apply the style guide
Follow these formatting rules:

**Headings:**
- `#` for the command name
- `##` for main sections
- `###` for subsections
- `####` only when additional nesting is unavoidable

**Lists:**
- Use `-` for bullets
- Indent nested bullets by two spaces

**Code blocks:**
- Shell commands: ` ```bash ` (or plain triple backticks if shell is obvious)
- TypeScript/JavaScript: ` ```typescript ` or ` ```javascript `
- YAML: ` ```yaml `
- Apply the most appropriate language tag for everything else

**Links and references:**
- Reference other commands as `/command-name`
- Wrap file paths in backticks (for example `` `path/to/file` ``)
- Use standard Markdown links for URLs

**Emphasis:**
- **Bold** for important words or warnings
- `Inline code` for commands, file names, flags, and variables
- Avoid strikethrough formatting

### 5. Share the proposal and request approval
Present the draft in the following format:

```markdown
## Generated command definition

### File path
`.cursor/commands/[command-name].md`

### Command name
`/command-name`

### Key capabilities
- [Capability 1]
- [Capability 2]

### Preview
[Show the opening portion of the generated Markdown]

### Validation
- Duplicate command: [none / found (details)]
- Similar command: [none / found (difference)]
- Naming rule: [valid / needs adjustment (suggestions)]

**Create this command? (yes/no)**
```

### 6. Wait for user approval

- **If approved:** create `.cursor/commands/[command-name].md`, confirm completion, and mention the command is available from the next session.
- **If revisions are requested:** apply the feedback, reshare the proposal, and wait again.
- **If rejected:** cancel creation and ask why (when helpful).

## AI analysis points

### Command classification

Determine which category the new command belongs to and apply the right tone:

1. **Workflow automation** — e.g., `/commit-push-pr`, `/deploy-preview`.
   - Focus on clear sequences, error handling, checkpoints.
2. **Documentation management** — e.g., `/update-agents-md`.
   - Focus on formatting rules and aligning with existing docs.
3. **Testing & verification** — e.g., `/run-tests`.
   - Focus on execution commands, result summaries, failure guidance.
4. **Environment setup** — e.g., `/setup-dev-env`.
   - Focus on prerequisites, idempotency, rollback strategy.
5. **Debug support** — e.g., `/debug-api-error`.
   - Focus on gathering data, narrowing causes, proposing fixes.
6. **Meta commands** — e.g., `/create-command`.
   - Focus on templates and consistency.

### Completing missing information

Fill gaps when the user input is vague:

**When the command name is unclear:**

- Propose names derived from the goal (for instance, "Run tests" → `/run-tests` or `/test-all`).

**When the procedure is abstract:**

- Infer concrete commands from the repository layout (for example "run migrations" → `cd app && npm run db:migrate`).

**When prerequisites are unspecified:**

- Infer likely requirements from the tech stack (for example, if Prisma is involved, PostgreSQL must be running via Docker Compose).

### Considering integration with existing commands

Assess whether the new workflow should be merged with an existing one:

**Recommend integration when:**

- The behavior could be a flag of an existing command.
- The workflow is an extension of an established process.

**Recommend a separate command when:**

- The goal is clearly different.
- Expected usage is frequent enough to deserve its own entry.
- Adding it to an existing command would create unnecessary complexity.

## Notes

- Command names must use kebab-case (e.g., `run-tests`, `sync-content`).
- Names must start with `/` when referenced.
- Match the tone and layout of existing commands at all times.
- Split extremely large workflows into multiple commands (one purpose per command).
- Consider security: never embed secrets or destructive defaults.
- Do not write to `.cursor/commands/` without explicit approval from the user.

## Implementation examples

### Example 1: Simple test runner command

**Input:**

```text
/create-command
Command name: /test-all
Goal: Run the application and infrastructure test suites and summarize the results.
```

**Generated definition (excerpt):**

```markdown
# /test-all

## Overview
Runs both the application (Astro) test suites and infrastructure (Terraform) validation in one go and prints an aggregated result. When any suite fails, the command surfaces the failing suite and error output for quick triage.

## Usage

```
/test-all
```

No arguments or options.

## Prerequisites
- Run from the repository root `./koborin-ai/`.
- Dependencies are installed (`npm install` already ran in `app/` and Terraform is initialized in `infra/`).

## Execution Flow (steps)

### 1. Run application tests
- Command: `npm run test --prefix app`
- Capture the exit code and console output.

### 2. Run infrastructure tests
- Command: `npm run test --prefix infrastructure`
- Capture the exit code and console output.

### 3. Aggregate and display results
- All green: print `✅ All tests passed.`
- Partial failure: print `❌` plus the failing suite and logs.
- Execution error: show the stack trace with guidance.
...
```

### Example 2: Complex workflow command

**Input:**

```text
/create-command
Command name: /deploy-preview
Goal: Deploy the current branch to the preview environment.
Steps:
1. Ensure the branch is not main.
2. Run lint + build + tests.
3. Trigger the dev GitHub Actions workflow.
4. Wait for completion and print the preview URL.
5. Provide cleanup guidance.
```

**Generated definition (excerpt):**

```markdown
# /deploy-preview

## Overview
Deploys the current branch to the preview (dev) environment. Runs lint/build/tests locally, triggers the `deploy-dev.yml` GitHub Actions workflow, and prints the resulting Cloud Run URL once ready.

## Usage

```text
/deploy-preview [--wait]
```

- `--wait` (optional): poll GitHub Actions and only exit after the workflow finishes.

## Prerequisites

- Execute on a non-`main` branch (feature/fix branch expected).
- GitHub Actions workflow `deploy-dev.yml` exists and is manually triggerable.
- Caller has repository write access and Cloud Run deploy permissions.

## Execution Flow (steps)

### 1. Validate branch

- Command: `git rev-parse --abbrev-ref HEAD`
- Abort if the branch is `main` or `master`.

### 2. Lint, build, and test

- `npm run lint --prefix app`
- `npm run build --prefix app`
- `npm run test --prefix app`
- Stop immediately if any step fails.

### 3. Trigger GitHub Actions workflow

- `gh workflow run deploy-dev.yml --ref $(git branch --show-current)`
- Print the workflow URL.

### 4. Optional wait

- If `--wait` is supplied, poll until completion and then fetch the Cloud Run service URL.
...

```text

## Best practices

### Command design principles
1. **Single responsibility:** each command must pursue one clear goal.
2. **Idempotency:** design commands so repeated runs are safe whenever possible.
3. **Error handling:** describe how to respond to failures.
4. **User confirmation:** request approval before destructive steps.
5. **Readable output:** present results in a concise, scannable format.

### Documentation quality
- Include concrete examples rather than abstract prose.
- State prerequisites explicitly before execution steps.
- Document common failure modes and mitigations.
- Cross-link related commands when relevant.

### Maintainability
- Keep terminology and tone consistent with existing commands.
- Structure sections so future updates are easy.
- Add short explanations for non-obvious logic or choices.

