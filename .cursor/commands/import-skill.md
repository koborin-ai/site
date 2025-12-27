# /import-skill

## Overview

`/import-skill` converts Claude Code skills (`.claude/skills/*/SKILL.md`) to Cursor custom commands (`.cursor/commands/*.md`). Use this when you want to use a Claude Code skill in Cursor, or when sharing skills across different AI coding assistants.

## Usage

```text
/import-skill <skill-name>
```

- `<skill-name>` (required): The name of the skill directory under `.claude/skills/`

**Examples:**

```text
/import-skill check-secrets
/import-skill commit-push-pr
```

## Prerequisites

- The skill exists under `.claude/skills/<skill-name>/SKILL.md`
- `.cursor/commands/` directory exists

## Execution Flow (steps)

### 1. Read the source skill

Read the skill file from `.claude/skills/<skill-name>/SKILL.md`

### 2. Parse the skill structure

Extract from the skill:

| Skill Element | Maps To |
|---------------|---------|
| `name` (frontmatter) | Command name (`/name`) |
| `description` (frontmatter) | Overview section |
| Trigger Examples | Usage section |
| Prerequisites | Prerequisites section |
| Execution Flow | Execution Flow (steps) section |
| Notes | Notes section |

### 3. Generate command structure

Create the command file with this format:

```markdown
# /command-name

## Overview

[Expanded description from skill frontmatter]

## Usage

```text
/command-name [arguments]
```

[Converted from trigger examples]

## Prerequisites

- [From skill prerequisites]

## Execution Flow (steps)

### 1. [Step name]

- [Details expanded from skill]

## AI considerations

[Guidance for the AI, if applicable]

## Notes

- [From skill notes]

## Examples

[Add concrete examples if helpful]
```

### 4. Expand concise skill content

Skills are intentionally concise. When converting to commands:

- Expand brief descriptions into full paragraphs
- Add more context to execution steps
- Include concrete examples where helpful
- Add AI considerations section if the skill has complex decision points

### 5. Present for approval

Show the generated command and ask for approval before writing.

### 6. Write the command file

Create `.cursor/commands/<command-name>.md`

## AI considerations

### Handling skill-specific features

Some skill features don't have direct command equivalents:

- **scripts/**: Reference these as "run the script at `path`" in execution steps
- **references/**: Include key information inline or reference the file path
- **assets/**: Reference the asset paths in the command

### Expanding trigger examples to usage

Skills use natural language triggers. Convert them to command-style usage:

| Skill Trigger | Command Usage |
|---------------|---------------|
| "Check for secrets" | `/check-secrets` |
| "Check with strict mode" | `/check-secrets --strict` |
| "Scan specific directory" | `/check-secrets [path]` |

### Maintaining consistency

- Match the style of existing commands in `.cursor/commands/`
- Use the same heading structure and formatting
- Include proper code block language tags

## Notes

- Commands are typically more verbose than skills
- Add examples to make the command more discoverable
- Include AI considerations for complex workflows
- Reference the original skill for additional context if needed

## Examples

### Converting check-secrets skill

**Input:**

```text
/import-skill check-secrets
```

**Output preview:**

```markdown
# /check-secrets

## Overview

`/check-secrets` scans the entire codebase for potential secret leaks...

## Usage

```text
/check-secrets [--include-docs] [--strict]
```

...
```
