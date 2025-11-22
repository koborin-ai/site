# Agents Guide

This document is a quick guide for any contributors or AI agents that touch the `koborin.ai` repository.

## Mission

- Personal site + technical garden for `koborin.ai`.
- Astro (Content Collections + MDX) with Markdown content under `content/`.
- Google Cloud Run (dev / prod) fronted by a single global HTTPS load balancer.
- Infrastructure managed via CDK for Terraform (CDKTF) 0.21.x with TypeScript.
- CI/CD and Terraform plan/apply executed only through GitHub Actions using Workload Identity Federation.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `app/` | Astro app (TypeScript, Tailwind, MDX helpers, Vitest). |
| `content/` | MDX pages/articles. Drafts live under `content/drafts/`. |
| `infrastructure/` | CDKTF stacks (`shared`, `dev`, `prod`). |
| `docs/` | Specifications, e.g. contact flow, o11y notes. |
| `.github/workflows/` | CI/CD definitions (to be added). |

## Infrastructure Rules

1. **Plan/Apply**: never run Terraform/CDKTF applies locally. All infra changes go through GitHub Actions with Workload Identity Federation.
2. **State buckets**: single GCS bucket with prefixes `shared`, `dev`, `prod`. Do not rename without migrating state.
3. **Providers**: `google` and `google-beta` pinned to `~> 6.50` (see `cdktf.json`). Run `npm run build && npm run test` inside `infrastructure/` before opening a PR.
4. **Environments**:
   - `shared`: APIs, Artifact Registry, static IP, Managed SSL cert, HTTPS LB (NEG, Backend Service, URL Map, Target Proxy, Forwarding Rule), IAP configuration for dev.
  - `dev`: Cloud Run service `koborin-ai-web-dev` (to be created).
  - `prod`: Cloud Run service `koborin-ai-web-prod` (to be created).
5. **Architecture Design**:
   - `shared` stack creates the entire HTTPS load balancer including Serverless NEGs and Backend Services for both dev/prod.
   - NEGs reference Cloud Run services by name (string), so Cloud Run services can be created later in dev/prod stacks without circular dependencies.
   - Dev Backend Service has IAP enabled with allowlist, prod has no IAP.
   - Dev Backend Service adds `X-Robots-Tag: noindex, nofollow` response header.
6. **Variable Management**:
   - All hardcoded values (region, domain names, service names, IP names, etc.) are defined as constants directly in `shared-stack.ts`.
   - Only truly variable values (project ID, OAuth credentials, IAP user email) are exposed as TerraformVariables.
   - Never add default values to TerraformVariables - all values must be explicitly passed from GitHub Actions.
   - Variable names in `stack-config.ts` must exactly match the `-var=` arguments in GitHub Actions workflows.
7. **IaC Philosophy - Code as Documentation**:
   - IaC differs fundamentally from application code: **the code itself is the design document**.
   - Prioritize readability and explicitness over abstraction. Hard-code all fixed values directly in stack files.
   - Avoid unnecessary variables, constants, or helper functions that obscure the actual infrastructure being created.
   - A reviewer should be able to understand the entire infrastructure by reading the stack file alone, without jumping between multiple abstraction layers.
   - Only extract to variables/functions when values genuinely vary across environments or need to be injected at runtime.

## Application Rules

1. **MDX workflow**:
   - Author pages under `content/`. Use YAML frontmatter with `title`, `summary`, `published`, `date`.
   - Drafts belong in `content/drafts/` and are excluded from navigation by default (Astro build filters items where `published !== false`, so drafts never appear in dev or prod).
2. **Testing**: run `npm run lint && npm run test && npm run typecheck` in `app/` before committing.
3. **Observability**: structured logging via `console.log(JSON.stringify(...))` for now; Cloud Run log analysis dashboards will be defined once telemetry stack lands.

## CI/CD Expectations

- Workflows:
  - `plan-infra.yml`: synth + plan for shared/dev/prod stacks (no apply).
  - `release-infra.yml`: authenticated apply for shared/dev/prod stacks (manual dispatch or tag based).
  - `app-ci.yml`: Astro app quality checks (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`) on PRs touching `app/` or `content/`.
  - `app-release.yml`: builds/pushes the Astro container with Cloud Build and feeds the resulting `image_uri` into CDKTF for dev/prod deploys.
- Workload Identity:
  - Pool ID: `github-actions`
  - Provider ID: `github`
  - Service account created in `shared` stack (`terraform-deployer@<project>.iam.gserviceaccount.com`).
  - Principal string: `principalSet://.../attribute.repository/<org>/<repo>` (see `shared-stack.ts`).

## Release Process

- Tag infra releases as `infra-v*` to force `release-infra.yml` to apply shared/dev/prod stacks ahead of app rollouts.
- Tag app releases as `app-v*` once `main` includes the desired content; this runs `app-release.yml`, builds a new Artifact Registry image, and updates the Cloud Run service.
- GitHub release notes respect `.github/release.yml`. Label every PR with `app`, `infra`, `terraform`, `feature`, `bug`, or `doc` so notes land in the right category; use the `ignore` label when a PR should be excluded entirely.

## Contact Flow & Analytics

- `/docs/contact-flow.md` captures the agreed design: Astro API route + Cloud Logging + SendGrid (notify). Use reCAPTCHA v3 + rate limiting.
- Analytics baseline uses GA4; `/api/track` endpoint will later forward custom events to Logging/BigQuery.

## Documentation Standards

1. **Markdown Formatting**:
   - Always add blank lines before and after headings.
   - Always add blank lines before and after lists.
   - Always add blank lines before and after tables.
   - Always add blank lines before and after code blocks.
   - Always specify language for code blocks (e.g., `bash`, `typescript`, `text`).
   - Remove trailing spaces at the end of lines.
   - End files with a single newline (no multiple blank lines at EOF).
2. **Content Structure**:
   - Use clear, descriptive headings that reflect the content hierarchy.
   - Keep lists concise and actionable.
   - Include code examples where helpful, with proper language tags.

## Code Quality Standards

Before committing any code changes, ensure all quality checks pass:

### Infrastructure (`infrastructure/`)

```bash
npm run build   # TypeScript compilation
npm run lint    # ESLint checks
npm run test    # Vitest unit tests
```

All three commands must complete successfully with no errors.

### Application (`app/`)

```bash
npm run build      # Astro build
npm run lint       # ESLint checks
npm run typecheck  # TypeScript type checking
npm run test       # Vitest unit tests
```

All four commands must complete successfully with no errors.

## Pull Request Checklist

1. Update relevant docs (`README.md`, `AGENTS.md`, or files under `docs/`) when changing behavior.
2. For infra: `npm run build && npm run lint && npm run test` in `infrastructure/` - all must pass.
3. For app: `npm run build && npm run lint && npm run typecheck && npm run test` in `app/` - all must pass.
4. Ensure all Markdown files pass linting (no MD0xx errors).
5. Mention any manual GCP steps (e.g., DNS imports, current gaps like IAP enablement) in the PR description.
