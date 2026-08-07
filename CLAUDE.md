# CLAUDE.md

Refer to [AGENTS.md](./AGENTS.md) for AI agent behavior guidelines.

## Claude Code Configuration

### Custom Skills

Skills are located in `.claude/skills/`:

- **astro-content**: Create Astro/Starlight MDX content
- **change-type**: Classify changes as behavior vs structure and recommend labels/tests/CI expectations
- **commit-push-pr**: Commit changes and create pull requests
- **safe-editing**: Ensure AI agents work in an isolated Git worktree to prevent changes to the main working directory

### Project-Specific Notes

1. **Infrastructure**: Never run `terraform apply` locally. All infra changes go through GitHub Actions.
2. **Content Creation**: Create MDX files under `app/src/content/docs/` and update `app/src/sidebar.ts`.
3. **Beats showcase**: Instrumentals at `/beats/` (catalog in `app/src/data/beats.ts`). For add-track steps and components, see **Beats showcase** in [AGENTS.md](./AGENTS.md). Beats is not in the site sidebar.
4. **Testing**: Run `npm run lint && npm run typecheck && npm run test` in `app/` before committing.

### Common Commands

```bash
# App build and test
cd app && npm run build && npm run lint && npm run typecheck && npm run test

# Infra analyze (TerraDart)
cd infra && dart analyze
```
