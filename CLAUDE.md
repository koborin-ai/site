# CLAUDE.md

Refer to [AGENTS.md](./AGENTS.md) for AI agent behavior guidelines.

## Claude Code Configuration

### Custom Skills

Skills are located in `.claude/skills/`:

- **astro-content**: Create Astro/Starlight MDX content
- **change-type**: Classify changes as behavior vs structure and recommend labels/tests/CI expectations
- **check-secrets**: Scan codebase for secret leaks
- **commit-push-pr**: Commit changes and create pull requests
- **evaluate-article**: Comprehensive blog article evaluation across 7 dimensions (defensibility, logical organization, practical applicability, structure, communication, controversy risk, human authenticity)
- **import-command**: Convert Cursor commands to Claude Code skills
- **import-pulumi**: Import existing GCP resources into Pulumi state
- **safe-editing**: Ensure AI agents work in an isolated Git worktree to prevent changes to the main working directory
- **skill-creator**: Create new Claude Code skills
- **translate-article**: Translate MDX articles between languages while preserving frontmatter and structure
- **update-agents-md**: Update AGENTS.md with new rules

### Plugin Marketplace

This repository hosts a Claude Code plugin marketplace at `.claude-plugin/marketplace.json`.
Published plugins live in `plugins/` with the standard plugin structure (`plugin.json` + `skills/`).

Currently published plugins:
- **agent-team-fullstack**: Orchestrate full-stack development with Agent Teams
- **mermaid-diagram**: Mermaid diagram workflow with PNG generation script

### Project-Specific Notes

1. **Infrastructure**: Never run `pulumi up` or `pulumi preview` locally. All infra changes go through GitHub Actions.
2. **Content Creation**: Create MDX files under `app/src/content/docs/` and update `app/src/sidebar.ts`.
3. **Testing**: Run `npm run lint && npm run typecheck && npm run test` in `app/` before committing.
4. **Plugins**: Plugin structure and marketplace.json are validated by `plugin-ci.yml` on PRs touching `plugins/` or `.claude-plugin/`.

### Common Commands

```bash
# App build and test
cd app && npm run build && npm run lint && npm run typecheck && npm run test

# Infra build and lint (Go)
cd infra && go build ./... && go vet ./...
```
