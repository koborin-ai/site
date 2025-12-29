# CLAUDE.md

Refer to [AGENTS.md](./AGENTS.md) for AI agent behavior guidelines.

## Claude Code Configuration

### Custom Skills

Skills are located in `.claude/skills/`:

- **update-agents-md**: Update AGENTS.md with new rules
- **astro-content**: Create Astro/Starlight MDX content
- **check-secrets**: Scan codebase for secret leaks
- **commit-push-pr**: Commit changes and create pull requests
- **skill-creator**: Create new Claude Code skills
- **import-command**: Convert Cursor commands to Claude Code skills
- **import-pulumi**: Import existing GCP resources into Pulumi state
- **evaluate-article**: Comprehensive blog article evaluation across 7 dimensions (defensibility, logical organization, practical applicability, structure, communication, controversy risk, human authenticity)

### Project-Specific Notes

1. **Infrastructure**: Never run `pulumi up` or `pulumi preview` locally. All infra changes go through GitHub Actions.
2. **Content Creation**: Create MDX files under `app/src/content/docs/` and update `app/src/sidebar.ts`.
3. **Testing**: Run `npm run lint && npm run typecheck && npm run test` in `app/` before committing.

### Common Commands

```bash
# App build and test
cd app && npm run build && npm run lint && npm run typecheck && npm run test

# Infra build and lint
cd infra && npm run build && npm run lint && npm run typecheck
```
