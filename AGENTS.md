# Agents Guide

This document is a quick guide for any contributors or AI agents that touch the `koborin.ai` repository.

## Language Policy

- **Conversation**: Always communicate with the user in **Japanese**.
- **Code**: Write all code, comments, variable names, and commit messages in **English**.

## Mission

- Personal site + technical garden for `koborin.ai`.
- Astro with Starlight (documentation-focused theme) for MDX content under `app/src/content/docs/`.
- Google Cloud Run (dev / prod) fronted by a single global HTTPS load balancer.
- Infrastructure managed via Pulumi (Go) with three stacks: `shared`, `dev`, `prod`.
- CI/CD and Pulumi preview/up executed only through GitHub Actions using Workload Identity Federation.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `app/` | Astro + Starlight app (TypeScript, MDX, Vitest). |
| `app/src/content/docs/` | MDX documentation pages. Mark drafts with `draft: true` in frontmatter. |
| `app/src/content/config.ts` | Content Collections schema (uses Starlight's `docsSchema`). |
| `app/src/utils/llms.ts` | Shared logic for llms.txt generation. |
| `app/src/pages/llms*.txt.ts` | Astro endpoints that generate llms.txt files at build time. |
| `app/nginx/nginx.conf` | nginx configuration for static file serving (port 8080). |
| `infra/` | Pulumi Go stacks (`shared`, `dev`, `prod`). |
| `infra/stacks/shared.go` | Shared resources: APIs, Artifact Registry, HTTPS LB, Workload Identity. |
| `infra/stacks/dev.go` | Dev Cloud Run service. |
| `infra/stacks/prod.go` | Prod Cloud Run service. |
| `docs/` | Specifications, e.g. contact flow, o11y notes. |
| `docs/assets/{article}/` | Mermaid sources and generated images for each spec document. |
| `.github/workflows/` | CI/CD definitions. |

## Infrastructure Rules

1. **Preview/Up**: never run Pulumi applies locally. All infra changes go through GitHub Actions with Workload Identity Federation.
2. **State backend**: GCS bucket with Pulumi's automatic stack-based state management. Backend URL: `gs://<BUCKET_NAME>/pulumi`.
3. **Stacks**: Pulumi stacks (`shared`, `dev`, `prod`) are managed via `pulumi stack select`. Each stack has its own state file.
4. **Environments**:

   - `shared`: APIs, Artifact Registry, static IP, Managed SSL cert, HTTPS LB (NEG, Backend Service, URL Map, Target Proxy, Forwarding Rule), IAP configuration for dev, Workload Identity for GitHub Actions.
   - `dev`: Cloud Run service `koborin-ai-web-dev`.
   - `prod`: Cloud Run service `koborin-ai-web-prod`.

5. **Architecture Design**:

   - `shared` stack creates the entire HTTPS load balancer including Serverless NEGs and Backend Services for both dev/prod.
   - NEGs reference Cloud Run services by name (string), so Cloud Run services can be created later in dev/prod stacks without circular dependencies.
   - Dev Backend Service has IAP enabled with allowlist, prod has no IAP.
   - Dev Backend Service adds `X-Robots-Tag: noindex, nofollow` response header.

6. **Configuration Management**:

   - All configuration values are set dynamically via `pulumi config set` in GitHub Actions.
   - Secrets (OAuth credentials, passphrase) are stored in GitHub Secrets and passed at runtime.
   - Stack configuration files (`Pulumi.*.yaml`) are gitignored - CI/CD sets all values.

7. **IaC Philosophy - Code as Documentation**:

   - IaC differs fundamentally from application code: **the code itself is the design document**.
   - Prioritize readability and explicitness over abstraction.
   - A reviewer should be able to understand the entire infrastructure by reading the stack files alone.
   - Only extract to configuration when values genuinely vary across environments or need to be injected at runtime.

8. **File Organization**:

   - `infra/main.go`: Entry point that loads the appropriate stack based on stack name.
   - `infra/config.go`: Configuration helper functions.
   - `infra/stacks/*.go`: Stack definitions (shared, dev, prod).
   - `infra/Pulumi.yaml`: Project configuration.
   - `infra/go.mod` / `infra/go.sum`: Go module dependencies.

## Application Rules

1. **MDX workflow**:
   - Author pages under `app/src/content/docs/`. Use YAML frontmatter with `title`, `description`.
   - Mark drafts with `draft: true` in frontmatter to exclude from navigation.
   - Starlight automatically generates navigation from the directory structure and sidebar config in `astro.config.mjs`.
2. **Adding new content**:
   - Create `.mdx` file under `app/src/content/docs/` (or subdirectory for categories like `blog/`, `guides/`).
   - Add frontmatter: `title` (required), `description` (required), `publishedAt` (required for articles, `YYYY-MM-DD`), `draft` (optional, boolean).
   - Update `app/src/sidebar.ts` to add navigation entry:
     - Single page: `{ label: "Page Title", slug: "page-name" }`
     - Categorized: `{ label: "Category", items: [{ label: "Post", slug: "category/post" }] }`
     - **Sidebar labels**: Use English labels only (no `translations`). This ensures consistent navigation across all language versions.
   - Folder structure maps to URL structure: `docs/blog/post.mdx` → `/blog/post/`
3. **Brand Assets Management**:
   - **Favicon**: Place in `app/public/favicon.png`. Configured in `astro.config.mjs` (`favicon` property).
   - **Header Logo**: Place in `app/src/assets/_shared/`. Configured in `astro.config.mjs` (`logo.src` property). Set `replacesTitle: true` to hide text title.
   - **Article Images**: Place in `app/src/assets/{category}/{article}/` (e.g., `tech/koborin-ai-architecture/`). Reference with relative paths from MDX.
   - **Logo Sizing**: Customize via `app/src/styles/custom.css` (`.site-title img` selector). Default: `5rem` desktop, `4.5rem` mobile.
   - Always use English comments in CSS/JS files. Avoid Japanese characters in code.
4. **OG Image Management**:
   - **Image Location**: Place OG images in `app/public/og/` as PNG or JPEG.
   - **Auto-optimization**: CI automatically converts images to WebP format during build. No manual optimization required.
   - **Frontmatter**: Set `ogImage: /og/xxx.png` in frontmatter (`.png` reference is auto-converted to `.webp` by `Head.astro`).
   - **Display in Article**: Add `![](/og/xxx.png)` at the beginning of the article content (nginx auto-serves WebP version).
   - **Japanese Articles**: Use the same `ogImage` path as the corresponding English article.
   - **Default**: Pages without `ogImage` fall back to `/og/index.webp`.
   - **Optimization Script**: `app/scripts/optimize-og-images.sh` handles WebP conversion (runs in Dockerfile and app-ci.yml).
5. **Article Dates**:
   - **Published Date**: Set `publishedAt: YYYY-MM-DD` in frontmatter when creating a new article.
   - **Updated Date**: Automatically extracted from Git history at build time via Starlight's built-in `lastUpdated` feature.
   - **Display**: Dates appear below the article title (e.g., `Published: Dec 1, 2024 · Updated: Jan 2, 2025`).
   - **Localization**: English uses `Dec 1, 2024` format; Japanese uses `2024年12月1日` format.
   - **Same-day Updates**: If `publishedAt` and `lastUpdated` are within 1 day, only the published date is shown.
   - **CI/CD**: Uses `depth: 1` shallow clone (no fetch-depth changes needed). Only the latest commit date is required.
   - **Local Development**: Updated date is shown for committed files. New uncommitted files show only the published date (if set).
6. **Starlight Features**:
   - Built-in search (Pagefind), dark mode, responsive navigation, and Table of Contents.
   - Customize appearance via CSS variables or override components as needed.
   - Social links and sidebar are configured in `astro.config.mjs`.
7. **Testing**: run `npm run lint && npm run test && npm run typecheck` in `app/` before committing.
8. **Observability**: structured logging via `console.log(JSON.stringify(...))` for now; Cloud Run log analysis dashboards will be defined once telemetry stack lands.
9. **Docker & Deployment**:
   - The app builds as a static site (`output: "static"` in Astro config) and is served via nginx.
   - Dockerfile uses multi-stage build: `node:22-slim` for build, `nginx:alpine` for runtime.
   - nginx configuration is at `app/nginx/nginx.conf` (port 8080 for Cloud Run compatibility).
   - All pages are pre-rendered at build time; no Node.js runtime required in production.
10. **LLM Context Files (llms.txt)**:
   - The site provides machine-readable context files for LLMs at `https://koborin.ai/llms.txt`.
   - **Index file** (`/llms.txt`): Lists all available llms.txt variants with links.
   - **Full content files**: `/llms-full.txt` (English), `/llms-ja-full.txt` (Japanese) - all articles with full Markdown body.
   - **Category files**: `/llms-{category}.txt` (English), `/llms-ja-{category}.txt` (Japanese) for filtered subsets (tech, life, about-me).
   - English is the default language (no prefix), Japanese uses `ja` prefix.
   - **Auto-generated**: Articles are automatically included when `draft: true` is not set. No manual updates needed.
   - **Static files**: Generated at build time via Astro endpoints. Zero runtime overhead.
   - **Implementation**: `app/src/utils/llms.ts` (shared logic), `app/src/pages/llms*.txt.ts` (endpoints).
   - **When to modify endpoints**:
     - Add a new category: Create `app/src/pages/llms-{category}.txt.ts` (English) and `app/src/pages/llms-ja-{category}.txt.ts` (Japanese), then update `app/src/pages/llms.txt.ts` index.
     - Change output format: Edit `app/src/utils/llms.ts`.
     - Existing articles are auto-included; no endpoint changes needed for new content.
11. **RichLinkCard Component**:
    - Use `RichLinkCard` instead of Starlight's built-in `LinkCard` for external links in MDX.
    - **Location**: `app/src/components/RichLinkCard.astro`
    - **Import**: `import RichLinkCard from '../../../../components/RichLinkCard.astro';`
    - **Recommended usage** (always specify `title` and `description` for performance):
      ```mdx
      <RichLinkCard
        href="https://example.com"
        title="Page Title"
        description="Page description text."
      />
      ```
    - **Why manual specification is preferred**:
      - In dev mode (`npm run dev`), OG metadata is fetched on every page request, causing slow page loads (1-2+ seconds).
      - Some sites (O'Reilly, Google Cloud docs) have slow response times (up to 9 seconds).
      - Manual specification skips all fetches, resulting in instant page loads in dev mode.
    - **URL-only usage** (auto-fetches OG metadata - use sparingly):
      ```mdx
      <RichLinkCard href="https://example.com" />
      ```
      - Only use this for quick prototyping or when you don't know the page title/description.
      - Always replace with manual specification before committing.
    - **Auto-fetch priority** (when title/description not provided): title (og:title → `<title>` → domain), description (og:description → meta description), thumbnail (og:image → favicon).

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

## Dependency Version Policy

When adding or updating dependencies (GitHub Actions, Go modules, npm packages, etc.):

1. **Always check for the latest stable version** before adding a new dependency.
2. **Use specific major versions** for GitHub Actions (e.g., `@v6` not `@main` or `@latest`).
3. **Prefer `go-version-file`** over hardcoded Go versions to keep CI in sync with `go.mod`.
4. **Verify compatibility** with existing dependencies before upgrading.
5. **Document breaking changes** in PR descriptions when upgrading major versions.

Examples:

- GitHub Actions: Check the action's releases page (e.g., `actions/setup-go` → use `@v6` if latest).
- Go modules: Use `go get <module>@latest` to fetch the latest version.
- npm packages: Use `npm outdated` to check for updates.

## CI/CD Expectations

- Workflows:
  - `plan-infra.yml`: `pulumi preview` for shared/dev/prod stacks (no apply).
  - `release-infra.yml`: authenticated `pulumi up` for shared/dev/prod stacks (manual dispatch or tag based).
  - `app-ci.yml`: Astro app quality checks (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`) on PRs touching `app/`.
  - `app-release.yml`: builds/pushes the Astro container with Cloud Build and feeds the resulting `image_uri` into Pulumi for dev/prod deploys.
- Workload Identity:
  - Pool ID: `github-actions-pool`
  - Provider ID: `actions-firebase-provider`
  - Service account created in `shared` stack (`github-actions-service@<project>.iam.gserviceaccount.com`).
  - Principal string: `principal://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions-pool/subject/nozomi-koborinai/koborin-ai`.

## Release Process

- Tag infra releases as `infra-v*` to force `release-infra.yml` to apply shared/dev/prod stacks ahead of app rollouts.
- Tag app releases as `app-v*` once `main` includes the desired content; this runs `app-release.yml`, builds a new Artifact Registry image, and updates the Cloud Run service.
- GitHub release notes respect `.github/release.yml`. Label every PR with `app`, `infra`, `pulumi`, `feature`, `bug`, or `doc` so notes land in the right category; use the `ignore` label when a PR should be excluded entirely.

## Contact Flow & Analytics

- `/docs/contact-flow.md` captures the agreed design: Astro API route + Cloud Logging + SendGrid (notify). Use reCAPTCHA v3 + rate limiting.
- Analytics baseline uses GA4; `/api/track` endpoint will later forward custom events to Logging/BigQuery.

## Diagram Guidelines

1. **Directory Structure**:
   - Mermaid source: `docs/assets/{article-name}/diagrams/{diagram-name}.md`
   - Generated images: `docs/assets/{article-name}/images/{diagram-name}.png`
   - Article filename maps to folder name (e.g., `contact-flow.md` → `assets/contact-flow/`)

2. **Mermaid Code Standards**:
   - Use `flowchart LR` (left-to-right) layout. Avoid `TB` (top-to-bottom).
   - New diagram files contain Mermaid code only (no explanatory text).

3. **PNG Generation**:
   - Use `mmdc` (mermaid-cli) to generate high-quality PNG:

   ```bash
   mmdc -i docs/assets/{article}/diagrams/{name}.md \
        -o docs/assets/{article}/images/{name}.png \
        -b transparent -s 3
   ```

   - Options: `-b transparent` (transparent background), `-s 3` (3x scale for high quality)

4. **Referencing in Documents**:
   - Use relative image references in article body:

   ```markdown
   ![Description](./assets/{article-name}/images/{diagram-name}.png)
   ```

5. **Mermaid in MDX Articles**:
   - Mermaid code blocks in MDX files are rendered via `rehype-mermaid` with `strategy: "inline-svg"`.
   - Dark/light mode theming is handled by CSS in `app/src/styles/custom.css`.
   - **Do not override Mermaid theme in code blocks** - the global CSS handles theme switching.
   - Keep node labels short to avoid text overlap (especially in `flowchart LR` layouts).
   - Use simple subgraph labels (avoid long strings like `"Pulumi Backend State - GCS"`).
   - If diagrams look broken in dark mode, check that CSS selectors in `custom.css` cover the generated SVG structure.

## Documentation Standards

1. **Markdown Formatting**:
   - Always add blank lines before and after headings.
   - Always add blank lines before and after lists.
   - Always add blank lines before and after tables.
   - Always add blank lines before and after code blocks.
   - Always specify language for code blocks (e.g., `bash`, `typescript`, `text`).
   - Remove trailing spaces at the end of lines.
   - End files with a single newline (no multiple blank lines at EOF).
   - Do not use backticks in headings (e.g., use `### infra/stacks/shared.go` instead of ``### `infra/stacks/shared.go` ``).
2. **Content Structure**:
   - Use clear, descriptive headings that reflect the content hierarchy.
   - Keep lists concise and actionable.
   - Include code examples where helpful, with proper language tags.

## Code Quality Standards

Before committing any code changes, ensure all quality checks pass:

## Change Types (Behavior vs Structure)

This repo distinguishes between **behavior changes** (externally observable) and **structure changes** (internal-only).
Use these change types to decide PR labels and the appropriate level of testing.

### Definitions

- **Behavior Change**: Any change that can affect what users/production systems observe.
  - App: UI/UX changes, content changes under `app/src/content/docs/`, routing/sidebar changes, asset changes under `app/public/` or `app/src/assets/`, build/runtime config changes (e.g. `app/astro.config.mjs`, `app/nginx/nginx.conf`, `app/Dockerfile`).
  - Infra: Any Pulumi change that could change the deployed resources/configuration.
  - CI: Workflow changes that can change what checks run or how deployments happen.
- **Structure Change**: Changes intended to preserve external behavior while improving maintainability.
  - Examples: refactors, renames, formatting, comment-only changes, internal documentation updates, reorganization that does not change URLs/output.

When in doubt, treat it as **Behavior Change**.

### Required PR labels

Add exactly one:

- `change:behavior`
- `change:structure`

These are in addition to the existing domain labels (`app`, `infra`, `doc`, etc.).

### How CI uses the change type

- **App CI (`.github/workflows/app-ci.yml`)**:
  - Default is **Behavior Change** (full checks).
  - If the PR has `change:structure`, CI runs a **fast** check (skips `npm audit` and `npm run build`).

### Infrastructure (`infra/`)

```bash
cd infra
go build ./...     # Go compilation
go vet ./...       # Go static analysis
```

All commands must complete successfully with no errors.

### Application (`app/`)

```bash
cd app
npm run build      # Astro build
npm run lint       # ESLint checks
npm run typecheck  # TypeScript type checking
npm run test       # Vitest unit tests
```

All four commands must complete successfully with no errors.

## Pull Request Checklist

1. Update relevant docs (`README.md`, `AGENTS.md`, or files under `docs/`) when changing behavior.
   - **Directory structure changes** (e.g., `app/src/assets/`, `infra/stacks/`): Update "Repository Layout" sections in both `README.md` and `AGENTS.md`.
   - **New conventions or rules**: Add to `AGENTS.md` under the appropriate section.
2. For infra: `go build ./... && go vet ./...` in `infra/` - all must pass.
3. For app: `npm run build && npm run lint && npm run typecheck && npm run test` in `app/` - all must pass.
4. Ensure all Markdown files pass linting (no MD0xx errors).
5. Mention any manual GCP steps (e.g., DNS imports, current gaps like IAP enablement) in the PR description.
6. **Label the PR** based on the diff before requesting review:
   - **Change type** (exactly one, required for CI behavior):
     - `change:behavior` — URLs, output, UI, config, or infra changes that affect users/production.
     - `change:structure` — Internal refactors, renames, or formatting with no external impact. CI skips `npm audit` and `npm run build`.
   - **Domain labels** (one or more):
     - `app` — Changes under `app/`.
     - `infra` — Changes under `infra/`.
     - `doc` — Documentation updates (`README.md`, `AGENTS.md`, `docs/`).
     - `ci` — Workflow changes under `.github/workflows/`.
   - **Category labels** (optional, for release notes):
     - `feature`, `bug`, `pulumi`, `ignore`.

## Agent Execution Rules

Rules for AI agents during task execution:

1. **Process Lifecycle Management**:
   - Any process started by the AI (dev server, background jobs, watchers, etc.) must be stopped by the AI when the task or verification ends.
   - Before starting a new dev server, check if one is already running using the terminals folder.
   - Use `pkill` or appropriate commands to terminate background processes after testing.

2. **Resource Cleanup**:
   - Close browser tabs opened for testing when verification is complete.
   - Remove temporary files created during debugging.
