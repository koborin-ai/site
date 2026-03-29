---
name: agent-team-fullstack
description: Orchestrate full-stack development with Agent Teams for parallel implementation. Use when the user says "build with a team", "develop in parallel", "spin up an Agent Team", or "investigate this bug".
---

# agent-team-fullstack

Orchestrate full-stack development in parallel using Agent Teams.
Works across all phases: greenfield development, bug fixes, and maintenance.

**Important**: This skill handles team setup only. Generating spawn prompts for each member is the core value.

## Prerequisites

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set
- The following MCP servers are configured:

| MCP Server | Purpose | Required |
|---|---|---|
| Context7 | Latest framework documentation | Yes |
| Terraform MCP | Google Cloud IaC | Yes |
| Flutter/Dart MCP | Flutter app development | When using Mobile member |

## When to Use

- "Build this feature with an Agent Team"
- "Develop this in parallel with a team"
- "Investigate and fix this bug" (for larger-scope issues)
- "Handle security updates for dependencies"
- "Set up CI/CD"

## Team Composition

Choose from 5 roles based on project needs.

| Member | Role | Required | Tech Stack | MCP |
|---|---|---|---|---|
| **Frontend** | Web UI implementation | Optional | Next.js / Astro / trending | Context7 |
| **Mobile** | Mobile app implementation | Optional | Flutter / Dart | Flutter/Dart MCP |
| **Backend** | API & server-side implementation | Yes | Go or TypeScript on Cloud Run | Context7 |
| **Infra** | Infrastructure provisioning & management | Yes | Terraform + Google Cloud Provider | Terraform MCP |
| **SRE** | CI/CD, security, quality guardrails, retrospectives | Yes | GitHub Actions / security tooling | Context7 |

### Member Selection Logic

```
Web app            → Frontend + Backend + Infra + SRE
Mobile app         → Mobile + Backend + Infra + SRE
Web + Mobile       → Frontend + Mobile + Backend + Infra + SRE
API / backend only → Backend + Infra + SRE
```

Frontend and Mobile are not mutually exclusive — spin up both when needed.

## Workflow

```
Phase 1: Scope Definition
    ↓
Phase 2: Team Design
    ↓
Phase 3: Agent Team Launch
```

## Phase 1: Scope Definition

Clarify the following through conversation. Skip if already clear.

| Aspect | Question |
|--------|----------|
| Mode | Greenfield? Bug fix? Maintenance? |
| Platform | Web? Mobile? Both? |
| Backend language | Go? TypeScript? (suggest based on frontend choice) |
| Target repository | Which repo are we working in? |
| Scope | What's the goal for this session? |

### Mode-Specific Questions

**Greenfield development:**
- MVP scope
- Key endpoints / screens
- Authentication requirements

**Bug fix:**
- Reproduction steps / error messages
- Hypothesis on blast radius
- Related files / modules

**Maintenance:**
- Target (dependency updates / security / performance)
- Urgency level

## Phase 2: Team Design

Propose a team composition based on Phase 1 findings.

### Proposal Format

```markdown
## Agent Team Composition

**Mode**: Greenfield
**Members**: Frontend, Backend, Infra, SRE (4 members)
**Model**: Opus for all members

| Member | Scope | Dependencies |
|---|---|---|
| SRE | .github/workflows/ + static analysis config | None (**starts first**) |
| Backend | src/api/ — REST API (Go / Cloud Run) | After SRE Phase 0 |
| Frontend | src/web/ — UI (Next.js) | After SRE Phase 0 + Backend API spec |
| Infra | infra/ — Terraform for Cloud Run + Cloud SQL etc. | After SRE Phase 0 |

**Plan approval**: Enabled for all members (lead reviews approach before implementation)
```

Wait for user confirmation before proceeding to Phase 3.

## Phase 3: Agent Team Launch

Launch the Agent Team with the confirmed composition.

### Spawn Prompt Rules

Each member's spawn prompt must include:

1. **Role and scope** — which directories / files they own
2. **Tech stack** — language, framework, and version
3. **MCP usage instructions** — how to use Context7 / Terraform MCP / Flutter MCP
4. **Boundaries** — areas they must NOT touch
5. **Definition of done** — what "complete" looks like
6. **Design guidelines** — reference CLAUDE.md / software-dna-template if present

### Spawn Prompt Templates by Member

#### Frontend

```
You are the Frontend member.

[Scope]
- Web UI implementation under {frontend_directory}

[Tech Stack]
- Framework: {framework} (use Context7 MCP to reference the latest docs)
- Use the latest stable version

[MCP Usage]
- Context7 MCP: Always consult API references and best practices
- Never guess an API — verify with Context7 first

[Boundaries]
- Do NOT modify Backend API implementation (read-only access to API type definitions / interfaces)
- Do NOT touch infrastructure config

[Deliverables]
- {deliverables}

[Design Guidelines]
- Follow the project's CLAUDE.md if it defines architecture, design patterns, or conventions

Plan approval is enabled. Submit your approach before starting implementation.
```

#### Mobile

```
You are the Mobile member.

[Scope]
- Flutter app implementation under {mobile_directory}

[Tech Stack]
- Flutter / Dart (use Flutter/Dart MCP to reference the latest docs)
- Use the latest stable version

[MCP Usage]
- Flutter/Dart MCP: Always consult the widget catalog and package documentation
- When selecting pub.dev packages, verify with MCP for the latest information

[Boundaries]
- Do NOT modify Backend API implementation (read-only access to API type definitions / interfaces)
- Do NOT touch infrastructure config

[Deliverables]
- {deliverables}

[Design Guidelines]
- Follow the project's CLAUDE.md if it defines architecture, design patterns, or conventions

Plan approval is enabled. Submit your approach before starting implementation.
```

#### Backend

```
You are the Backend member.

[Scope]
- API implementation under {backend_directory}

[Tech Stack]
- Language: {language} (Go or TypeScript)
- Deploy target: Cloud Run
- Use Context7 MCP to reference the latest framework docs

[MCP Usage]
- Context7 MCP: Always consult framework and library references

[Boundaries]
- Do NOT modify frontend / mobile UI code
- Do NOT touch infrastructure config (writing Dockerfiles is OK)

[Coordination]
- Finalize API endpoint definitions and type specs early — Frontend / Mobile members depend on them
- Create a Dockerfile for the Infra member to use in Cloud Run deployment config

[Deliverables]
- {deliverables}

[Design Guidelines]
- Follow the project's CLAUDE.md if it defines architecture, design patterns, or conventions

Plan approval is enabled. Submit your approach before starting implementation.
```

#### Infra

```
You are the Infra member.

[Scope]
- Terraform code under {infra_directory}

[Tech Stack]
- Terraform + Google Cloud Provider
- Use Terraform MCP to reference the latest provider docs and resource definitions

[MCP Usage]
- Terraform MCP: Always verify resource definitions, data sources, and provider config
- Never guess resource attributes — confirm exact attribute names and types via MCP

[Managed Resources (select per project)]
- Cloud Run services
- Cloud SQL instances
- VPC / subnets
- IAM / service accounts
- Secret Manager
- Cloud Storage
- Other Google Cloud resources as needed

[Boundaries]
- Do NOT touch application code
- CI/CD pipelines are owned by the SRE member

[Deliverables]
- {deliverables}

[Design Guidelines]
- Follow the project's CLAUDE.md if it defines architecture, design patterns, or conventions

Plan approval is enabled. Submit your approach before starting implementation.
```

#### SRE

```
You are the SRE member. You provide platform engineering support for the entire team.

[Scope]
- CI/CD pipelines (GitHub Actions)
- Security audits and dependency vulnerability checks
- Development environment standardization

[Tech Stack]
- GitHub Actions
- Use Context7 MCP to reference the latest docs for tools and actions

[MCP Usage]
- Context7 MCP: Consult docs for GitHub Actions, security tools, and related references

[Task Priority]
SRE builds guardrails BEFORE other members start coding.
Complete Phase 0 before anyone else begins implementation.

Phase 0 (highest priority — complete before other members start):
1. Linter / formatter setup (select based on language and framework)
2. Type checking setup
3. CODEOWNERS definition (map directories to team members)
4. CI pipeline scaffold (ensure the above checks run automatically)
5. Terraform validate / plan integrated into CI

Phase 1 (in parallel with other members):
6. Security: audit frameworks and libraries adopted by each member
7. Dependency management: configure Dependabot / Renovate
8. Deployment pipeline setup

Phase 2 (after implementation):
9. Retrospective: analyze failures and rework, then codify learnings into Skills (see below)

[Boundaries]
- Do NOT touch application business logic
- Do NOT touch Terraform code (referencing it from CI/CD is OK)

[Coordination]
- Proactively audit the tech stacks chosen by other members and flag security concerns via message
- Backend's Dockerfile and Infra's Terraform are needed for the deployment pipeline

[Deliverables]
- {deliverables}

[Design Guidelines]
- Follow the project's CLAUDE.md if it defines architecture, design patterns, or conventions

Plan approval is enabled. Submit your approach before starting implementation.
```

## Bug Fix Mode — Team Design

Not every bug requires the full team.
Identify the blast radius in Phase 1, then propose only the members needed.

### Decision Criteria

| Bug Type | Members to Spawn |
|---|---|
| UI rendering / interaction issues | Frontend or Mobile |
| API errors / performance degradation | Backend |
| Infrastructure-related (deploy failures, resource limits) | Infra + SRE |
| Security vulnerabilities | SRE + affected layer's member |
| Unknown cause / spans multiple layers | Backend + related members + SRE |

Plan approval may be skipped for bug fixes depending on urgency.

## Maintenance Mode — Team Design

| Task | Members to Spawn |
|---|---|
| Dependency updates | SRE + affected layer's member |
| Framework major upgrades | Affected member + SRE |
| Terraform provider updates | Infra |
| CI/CD improvements | SRE |
| Performance tuning | Backend + Infra |

## Retrospectives (SRE-Led)

When failures or rework occur, SRE leads a retrospective and codifies learnings into Skills.
The goal is not to log incidents — it's to **bake learnings into behavioral specs**.

### Triggers

- Deploy failure / rollback
- Design decision that required rework
- Recurring bug of the same type
- User feels "we've been through this before"

### Process

```
1. What happened (facts)
    ↓
2. Why it happened (root cause + user's decision patterns)
    ↓
3. Where to codify the learning (decision)
    ├── Existing SKILL.md has a relevant section → propose update
    └── No matching skill exists → propose new skill
    ↓
4. User reviews and approves
```

### Where to Codify Learnings

| Learning Type | Target |
|---|---|
| Team composition / task ordering | Update agent-team-fullstack/SKILL.md |
| Tech-specific pitfalls (e.g., Cloud Run IAM) | Create new skill |
| Framework selection criteria | Create new skill |
| Cross-project design patterns | Create new skill |
| Project-specific caveats | Append to that project's CLAUDE.md |

### SRE Retrospective Proposal Format

When filing a retrospective, SRE uses this format:

```markdown
## Retrospective

**Incident**: {what happened}
**Root cause**: {why it happened}
**Decision pattern**: {which user decision contributed}

### Proposed Change

**Target**: {existing skill name or new skill name}
**Changes**:
- {specific sections / rules / prompts to add or modify}

→ Will apply after user approval
```

**Important**: SRE only proposes — skill updates are applied only after user approval.

## Guidelines

### Inter-Member Communication (Mailbox)

Agent Teams have a mailbox messaging system. Members can communicate directly without going through the lead.

- **message**: Send to a specific member (1:1)
- **broadcast**: Send to all members (higher token cost — use sparingly)

When to use:
- SRE Phase 0 complete → broadcast "ready to start" to all members
- Backend API spec finalized → message Frontend / Mobile
- Security concern found → SRE messages the affected member

### Shared Task List for Dependency Management

Agent Teams have a task list feature with dependency tracking.
When a dependency task completes, blocked tasks are **automatically unblocked** and members can self-claim them.

Set up dependency chains in the lead's spawn prompt:

```
Task: SRE Phase 0 (lint/CI setup)        → No dependencies
Task: Backend API implementation          → Depends on SRE Phase 0
Task: Frontend UI implementation          → Depends on SRE Phase 0 + Backend API spec
Task: Infra Terraform provisioning        → Depends on SRE Phase 0
```

### Preventing File Conflicts

- Clearly separate each member's owned directories
- Shared files (README, config files, etc.) are consolidated by the lead at the end
- Never have multiple members editing the same file

### Cost Management

- Use Opus for all members (prioritize quality)
- Only spawn the members you need (full team is NOT the default)
- Shut down members promptly when their work is done
- Broadcast consumes tokens proportional to team size — use only when necessary

### MCP Discipline

- **Never write code based on guesses.** Verify with MCP before implementing.
- Terraform resource attributes and framework APIs change frequently — always confirm via MCP.

### Known Limitations and Workarounds

| Limitation | Impact | Workaround |
|---|---|---|
| No session restore | `/resume` does not restore team members. Lead may try to message non-existent members. | Have the lead spawn new members. |
| Missed task completion | A member forgets to mark a task done, blocking dependent tasks. | Lead periodically checks status and nudges stalled members. |
| One team per session | Lead can only manage one team at a time. | Clean up the current team before creating a new one. |
| No nesting | Members cannot spawn their own teams. | Keep team management at the lead level only. |
| Shutdown delay | Members shut down after completing their current request. | Wait for graceful shutdown — never force-kill. |

## Principles

- The user is the architect — maintain their sense of control through plan approval
- Keep team proposals concise — prefer tables over long prose
- Never propose the full team for a bug fix — default to the smallest effective composition
- Make spawn prompts specific — vague instructions degrade output quality
