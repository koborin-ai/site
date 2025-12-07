# Agents Guide

This document is a quick guide for any contributors or AI agents that touch the `koborin.ai` repository.

## Mission

- Personal site + technical garden for `koborin.ai`.
- Astro with Starlight (documentation-focused theme) for MDX content under `app/src/content/docs/`.
- Google Cloud Run (dev / prod) fronted by a single global HTTPS load balancer.
- Infrastructure managed via CDK for Terraform (CDKTF) 0.21.x with TypeScript.
- CI/CD and Terraform plan/apply executed only through GitHub Actions using Workload Identity Federation.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `app/` | Astro + Starlight app (TypeScript, MDX, Vitest). |
| `app/src/content/docs/` | MDX documentation pages. Mark drafts with `draft: true` in frontmatter. |
| `app/src/content/config.ts` | Content Collections schema (uses Starlight's `docsSchema`). |
| `app/nginx/nginx.conf` | nginx configuration for static file serving (port 8080). |
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
   - Author pages under `app/src/content/docs/`. Use YAML frontmatter with `title`, `description`.
   - Mark drafts with `draft: true` in frontmatter to exclude from navigation.
   - Starlight automatically generates navigation from the directory structure and sidebar config in `astro.config.mjs`.
2. **Adding new content**:
   - Create `.mdx` file under `app/src/content/docs/` (or subdirectory for categories like `blog/`, `guides/`).
   - Add frontmatter: `title` (required), `description` (required), `draft` (optional, boolean).
   - Update `app/src/sidebar.ts` to add navigation entry:
     - Single page: `{ label: "Page Title", slug: "page-name" }`
     - Categorized: `{ label: "Category", items: [{ label: "Post", slug: "category/post" }] }`
   - Folder structure maps to URL structure: `docs/blog/post.mdx` → `/blog/post/`
3. **Brand Assets Management**:
   - **Favicon**: Place in `app/public/favicon.png`. Configured in `astro.config.mjs` (`favicon` property).
   - **Header Logo**: Place in `app/src/assets/`. Configured in `astro.config.mjs` (`logo.src` property). Set `replacesTitle: true` to hide text title.
   - **Hero Images**: Place in `app/src/assets/`. Reference from MDX frontmatter (`hero.image.file` property with relative path).
   - **Logo Sizing**: Customize via `app/src/styles/custom.css` (`.site-title img` selector). Default: `5rem` desktop, `4.5rem` mobile.
   - Always use English comments in CSS/JS files. Avoid Japanese characters in code.
4. **OG Image Generation**:
   - **Hero Image Priority**: If a page has a hero image (`hero.image.file` in frontmatter), it is used as the OG image.
   - **Fallback**: Pages without hero images fall back to `/og/index.png` (static default).
   - **Static Files**: Default OG images are placed in `app/public/og/`. This directory is gitignored (images are copied at build time).
   - Custom `Head.astro` component (`app/src/components/Head.astro`) handles the logic to select hero image or fallback.
   - OG meta tags set: `og:image`, `twitter:image`.
5. **Starlight Features**:
   - Built-in search (Pagefind), dark mode, responsive navigation, and Table of Contents.
   - Customize appearance via CSS variables or override components as needed.
   - Social links and sidebar are configured in `astro.config.mjs`.
6. **Testing**: run `npm run lint && npm run test && npm run typecheck` in `app/` before committing.
7. **Observability**: structured logging via `console.log(JSON.stringify(...))` for now; Cloud Run log analysis dashboards will be defined once telemetry stack lands.
8. **Docker & Deployment**:
   - The app builds as a static site (`output: "static"` in Astro config) and is served via nginx.
   - Dockerfile uses multi-stage build: `node:22-slim` for build, `nginx:alpine` for runtime.
   - nginx configuration is at `app/nginx/nginx.conf` (port 8080 for Cloud Run compatibility).
   - All pages are pre-rendered at build time; no Node.js runtime required in production.

## Astro Development Best Practices

1. **Core Principles**
   - **Minimal JavaScript**: Prioritize static generation. Use client-side JavaScript only when absolutely necessary.
   - **Concise & Technical**: Write code that is easy to understand and maintain. Use descriptive variable names.

2. **Component Development**
   - **`.astro` First**: Use `.astro` components for UI structure and layout.
   - **Props**: Use `Astro.props` (with TypeScript interfaces) to pass data to components.
   - **Composition**: Break down complex UIs into smaller, reusable components.
   - **Frameworks**: Use specific frameworks (React etc.) only when complex state management is required (`client:*` directives).

3. **Styling**
   - **Scoped CSS**: Use `<style>` tags within `.astro` components for scoped styling.
   - **Variables**: Use CSS custom properties (defined in global styles) for consistent theming.
   - **No Tailwind**: This project does not use Tailwind CSS. Stick to standard CSS.

4. **Performance Optimization**
   - **Partial Hydration**: Use `client:load`, `client:idle`, `client:visible` directives judiciously. Default to static.
   - **Image Optimization**: Use `astro:assets` (`<Image />` component) for all local images.
   - **Lazy Loading**: Ensure off-screen images and heavy components are lazy-loaded.

5. **Routing (Custom Pages)**
   - *Note: Documentation pages are managed by Starlight.*
   - **File-based Routing**: Use `src/pages/` for custom landing pages or apps.
   - **Dynamic Routes**: Use `[...slug].astro` and `getStaticPaths()` for dynamic static pages.
   - **404**: Maintain a custom `404.astro` for proper error handling.

6. **Accessibility**
   - **Semantic HTML**: Use proper tags (`<main>`, `<nav>`, `<article>`, etc.).
   - **ARIA**: Use ARIA attributes where semantic HTML is insufficient.
   - **Keyboard Nav**: Ensure all interactive elements are keyboard accessible.

7. **Type Safety**
   - **TypeScript**: Always use TypeScript. Define interfaces for Props and data structures.
   - **Strict Mode**: Adhere to strict type checking rules enabled in the project.

## CI/CD Expectations

- Workflows:
  - `plan-infra.yml`: synth + plan for shared/dev/prod stacks (no apply).
  - `release-infra.yml`: authenticated apply for shared/dev/prod stacks (manual dispatch or tag based).
  - `app-ci.yml`: Astro app quality checks (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`) on PRs touching `app/`.
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
