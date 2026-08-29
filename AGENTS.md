# Agents Guide

This document is a quick guide for any contributors or AI agents that touch the `koborin.ai` repository.

## Language Policy

- **Conversation**: Always communicate with the user in **Japanese**.
- **Code**: Write all code, comments, variable names, and commit messages in **English**.

## Mission

- Personal site + technical garden for `koborin.ai`.
- Astro with Starlight (documentation-focused theme) for MDX content under `app/src/content/docs/`.
- Cloudflare Workers static assets on `koborin.ai` only. No `dev.koborin.ai`.
- Infrastructure managed via TerraDart (Dart) with one Terraform root module: `site`.
- CI/CD and `terraform plan`/`apply` executed only through GitHub Actions using a scoped Cloudflare API token.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `app/` | Astro + Starlight app (TypeScript, MDX, Vitest). |
| `app/wrangler.jsonc` | Worker name `koborin-ai-web`, `assets.directory` `./dist`, and `not_found_handling` `404-page`. |
| `app/public/_headers` | Worker static-asset header rules (UTF-8 on `*.txt`). |
| `app/src/content/docs/` | MDX documentation pages. Mark drafts with `draft: true` in frontmatter. |
| `app/src/content/docs/beats/` | Beats showcase (`index` list + per-track share pages). English only. |
| `app/src/data/beats.ts` | Beat catalog (title, audio path, BPM/key, OG image, optional external URL). |
| `app/public/audio/beats/` | MP3 files for on-site playback. |
| `app/src/content.config.ts` | Content Collections schema (uses Starlight's `docsSchema`). |
| `app/src/utils/llms.ts` | Shared logic for llms.txt generation. |
| `app/src/pages/llms*.txt.ts` | Astro endpoints that generate llms.txt files at build time. |
| `app/src/pages/rss.xml.ts` | RSS feed endpoint for English articles. |
| `app/src/pages/ja/rss.xml.ts` | RSS feed endpoint for Japanese articles. |
| `infra/` | TerraDart infrastructure (`site` stack). |
| `infra/lib/site_stack.dart` | Zone lookup and Workers custom domain for `koborin.ai`. |
| `infra/lib/cloudflare_zone_lookup.dart` | Local `data.cloudflare_zone` wrapper. |
| `infra/lib/cloudflare_workers_custom_domain.dart` | Local `cloudflare_workers_custom_domain` wrapper. |
| `infra/bin/synth.dart` | Synth entry point; emits `tf-out/site/main.tf.json`. |
| `docs/` | Specifications, e.g. contact flow, o11y notes. |
| `docs/assets/{article}/` | Mermaid sources and generated images for each spec document. |
| `.github/workflows/` | CI/CD definitions. |

## Infrastructure Rules

1. **Plan/Apply**: never run `terraform apply` locally. All infra changes go through GitHub Actions with a scoped Cloudflare API token. Local `terraform plan` after import is OK for verification.
2. **State backend**: Cloudflare R2 bucket `koborin-ai-tfstate`. Key: `terraform/site/terraform.tfstate`.
3. **Stacks**: One Terraform root module (`site`) is synthesized via `dart run bin/synth.dart site`.
4. **Environments**:

   - Production host: `koborin.ai` only. There is no `dev.koborin.ai`.
   - Worker: `koborin-ai-web` (static assets from `app/dist`). No Worker JavaScript `main`.
   - GitHub Environments: `production (app)` and `production (infra)`.

5. **Architecture Design**:

   - The `site` stack looks up zone `koborin.ai` and attaches Worker `koborin-ai-web` as a custom domain.
   - It does not create the zone. MX and GitHub organization verification TXT stay unmanaged.
   - App files are published with `wrangler deploy`, not Terraform.

6. **Configuration Management**:

   - Synth reads `CLOUDFLARE_ACCOUNT_ID` and `SITE_ATTACH_CUSTOM_DOMAIN` from the environment.
   - Cloudflare credentials stay in GitHub Secrets (`CLOUDFLARE_API_TOKEN`, `R2_*`) and are never baked into synth output.
   - Site Terraform `variable` blocks stay empty; Terraform rejects `variable: {}`.

7. **IaC Philosophy - Code as Documentation**:

   - IaC differs fundamentally from application code: **the code itself is the design document**.
   - Prioritize readability and explicitness over abstraction.
   - A reviewer should be able to understand the entire infrastructure by reading the stack files alone.
   - Only extract to configuration when values genuinely vary across environments or need to be injected at runtime.

8. **File Organization**:

   - `infra/bin/synth.dart`: Entry point; synthesizes the `site` stack to `tf-out/site/main.tf.json`.
   - `infra/lib/site_stack.dart`: Zone lookup and Workers custom domain.
   - `infra/lib/cloudflare_zone_lookup.dart` / `cloudflare_workers_custom_domain.dart`: Local wrappers (`terradart_cloudflare` is not patched).
   - `infra/lib/terraform_variables.dart`: Empty site `variable` map so synth omits the block.
   - `infra/pubspec.yaml`: TerraDart dependencies (`terradart_core`, `terradart_cloudflare`).

## Application Rules

1. **MDX workflow**:
   - Author pages under `app/src/content/docs/`. Use YAML frontmatter with `title`, `description`.
   - Mark drafts with `draft: true` in frontmatter to exclude from navigation.
   - Starlight automatically generates navigation from the directory structure and sidebar config in `astro.config.mjs`.
   - **Drafts are not covered by `npm run build`**: draft pages are excluded from production builds, so a broken draft (missing image import, bad MDX) passes CI and only fails once rendered. Open every draft you touched in `npm run dev` before considering it done, and re-run `npm run build` after removing `draft: true` so the page enters the build for the first time under your own eyes.
   - `starlight-auto-drafts` keeps draft slugs in `app/src/sidebar.ts` from breaking production builds. Sidebar entries for drafts show a DRAFT badge in dev and disappear in production.
2. **Adding new content**:
   - Create `.mdx` file under `app/src/content/docs/` (or subdirectory for categories like `blog/`, `guides/`).
   - Add frontmatter: `title` (required), `description` (required), `publishedAt` (required for articles, `YYYY-MM-DD`), `draft` (optional, boolean).
   - Update `app/src/sidebar.ts` to add navigation entry:
     - Single page: `{ label: "Page Title", slug: "page-name" }`
     - Categorized: `{ label: "Category", items: [{ label: "Post", slug: "category/post" }] }`
     - **Sidebar labels**: Use English labels only (no `translations`). This ensures consistent navigation across all language versions.
   - Folder structure maps to URL structure: `docs/blog/post.mdx` → `/blog/post/`
   - **Japanese link spacing**: In Japanese MDX prose, add a half-width space between Japanese text characters (hiragana, katakana, kanji) and Markdown links. Do NOT add a space between full-width punctuation (`、`, `。`, `（`, `）`) and links — full-width characters already have built-in visual whitespace.
     - Good: `どのバージョンの [仕様](https://...) に準拠する`
     - Good: `GA で、[Dart 版](https://...) は 2026 年` (no space after `、`)
     - Bad: `どのバージョンの[仕様](https://...)に準拠する` (missing spaces around link)
     - Bad: `GA で、 [Dart 版](https://...) は` (unnecessary space after `、`)
3. **Brand Assets Management**:
   - **Favicon**: Place in `app/public/favicon.png`. Configured in `astro.config.mjs` (`favicon` property).
   - **Header Logo**: Place in `app/src/assets/_shared/`. Configured in `astro.config.mjs` (`logo.src` property). Set `replacesTitle: true` to hide text title.
   - **Article Images**: Place in `app/src/assets/{category}/{article}/` (e.g., `tech/koborin-ai-architecture/`).
   - **Logo Sizing**: Customize via `app/src/styles/custom.css` (`.site-title img` selector). Default: `5rem` desktop, `4.5rem` mobile.
   - Always use English comments in CSS/JS files. Avoid Japanese characters in code.
4. **Beats showcase**:
 - **Purpose**: English-only instrumental showcase. List at `/beats/`; each track has a thin share page at `/beats/<slug>/` with its own jacket OG. Not included in RSS (tech/life only); pages still appear in `llms-full.txt` via the docs collection. No dedicated `/llms-beats.txt`.
   - **Components** (`app/src/components/`):
     - `BeatList.astro` — renders the catalog on `/beats/` (cover map lives here).
     - `BeatTrackCard.astro` — one row on the list (cover, meta, player, actions).
     - `BeatTrack.astro` — body of a per-track share page.
     - `BeatPlayer.astro` — custom player (one track at a time). Root must use `not-content`.
     - `CopyLinkButton.astro` — copies the track URL. Root must use `not-content`.
   - **Playback modes** (toggle on each player; shared via `localStorage` key `koborin-beat-playback-mode`):
     - `once` (default) — play the current track, then stop.
     - `repeat` — loop the current track.
     - `queue` — when a track ends, play the next `[data-beat-player]` on the page in DOM order (wraps to the first). On a single-track page this behaves like repeat.
   - **Actions**: Navigation links in the action row use class `beat-action` (ghost chrome matching Copy link), defined in `app/src/styles/custom.css`.
   - **Sidebar**: Not listed in the site sidebar. Reachable via `/beats/` (and links from Home / About).
   - **Page frontmatter**: `engagement: false`, `tableOfContents: false`, and `ogImage` on every Beats MDX page.
   - **License note**: Short Splice note on the index only; no per-track sample/tool credits.
   - **Adding a track** (all required):
     1. Add an entry to `app/src/data/beats.ts` (`slug`, `title`, `description`, `date`, `bpm`/`key`, `audioSrc`, optional `externalUrl`, `ogImage`).
     2. Place MP3 at `app/public/audio/beats/<slug>.mp3` (~192 kbps, no embedded artwork).
     3. Place jacket at `app/public/og/beats-<slug>.jpg` (or `.png`) and the same file under `app/src/assets/og/`.
     4. Create `app/src/content/docs/beats/<slug>.mdx` rendering `<BeatTrack slug="..." cover={...} />`.
     5. Register the cover import in `BeatList.astro`.
   - **Icon pitfall**: Interactive SVGs inside MDX must sit under Starlight's `not-content` (already on `BeatPlayer` / `CopyLinkButton`). ImageZoom must only attach to Mermaid `svg[id^="mermaid"]`, never UI icons.
5. **Image Conventions**:
   - **MANDATORY**: All on-page images must be rendered through the `SiteImage` component (`app/src/components/SiteImage.astro`). Raw `<img>` tags and direct use of Astro's `<Image />` / `<Picture />` are forbidden in MDX and `.astro` files.
   - **Why**: `SiteImage` centralizes responsive `srcset`/`sizes`, quality, format (AVIF/WebP), and loading strategy per variant. Bypassing it breaks LCP budgets and ships multi-MB originals.
   - **Enforcement**: Going forward, prefer code review for `SiteImage` compliance until a dedicated CI check is added.
   - **Variant table** — pick the variant that matches the rendered size, not the source dimensions:

     | Variant | Use case | Rendered width |
     |---------|----------|----------------|
     | `hero` | LCP candidate, top-page hero | ~1376px |
     | `articleHeader` | LCP candidate, article opener (OG image displayed in body) | ~750px |
     | `card` | Top-page / list thumbnails | 160–480px |
     | `thumbnail` | Small icon-like images | 80–240px |
     | `inline` | Regular images inside article body | 400–1200px |

   - **Import pattern** (article body):

     ```mdx
     import SiteImage from '../../../components/SiteImage.astro';
     import myImage from '../../../assets/category/article/image.png';

     <SiteImage src={myImage} alt="Description" variant="inline" />
     ```

6. **OG Image Management**:
   - **Image Location**: Place OG images in `app/public/og/<slug>.png` as PNG or JPEG.
   - **Auto-optimization**: CI automatically converts images to WebP format during build. No manual optimization required.
   - **Frontmatter**: Set `ogImage: /og/<slug>.png` in frontmatter (`.png` reference is auto-converted to `.webp` by `Head.astro`).
   - **Japanese Articles**: Use the same `ogImage` path as the corresponding English article.
   - **Default**: Pages without `ogImage` fall back to `/og/index.webp`.
   - **Optimization Script**: `app/scripts/optimize-og-images.sh` handles WebP conversion (runs in `app-ci.yml` / `app-release.yml`).
   - **Dual-placement rule for body display**: The `/og/<slug>.png` under `app/public/og/` is consumed by OG meta tags (`Head.astro` rewrites the reference to `.webp`), so it must stay there. If you also want to render the same image at the top of the article body via `SiteImage`, copy the source PNG to `app/src/assets/og/<slug>.png` and `import` it from there:

     ```mdx
     import SiteImage from '../../../components/SiteImage.astro';
     import headerImage from '../../../assets/og/<slug>.png';

     <SiteImage src={headerImage} alt="..." variant="articleHeader" style="width: 100%; height: auto;" />
     ```

     Do **not** use `<SiteImage src="/og/<slug>.png" ... />` — `SiteImage` requires an imported asset so Astro can generate optimized variants at build time.
7. **Article Dates**:
   - **Published Date**: Set `publishedAt: YYYY-MM-DD` in frontmatter when creating a new article.
   - **Updated Date**: Automatically extracted from Git history at build time via Starlight's built-in `lastUpdated` feature.
   - **Display**: Dates appear below the article title (e.g., `Published: Dec 1, 2024 · Updated: Jan 2, 2025`).
   - **Localization**: English uses `Dec 1, 2024` format; Japanese uses `2024年12月1日` format.
   - **Same-day Updates**: If `publishedAt` and `lastUpdated` are within 1 day, only the published date is shown.
   - **CI/CD**: Uses `fetch-depth: 0` to clone full Git history so Starlight `lastUpdated` can read commits.
   - **Local Development**: Updated date is shown for committed files. New uncommitted files show only the published date (if set).
8. **Starlight Features**:
   - Built-in search (Pagefind), dark mode, responsive navigation, and Table of Contents.
   - Customize appearance via CSS variables or override components as needed.
   - Social links and sidebar are configured in `astro.config.mjs`.
9. **Testing**: run `npm run lint && npm run test && npm run typecheck && npm run check-images` in `app/` before committing.
10. **Observability**: structured logging via `console.log(JSON.stringify(...))` for now; a telemetry stack is not defined yet.
11. **Workers deployment**:
   - The app builds as a static site (`output: "static"` in Astro config). Wrangler uploads `app/dist` as Worker static assets.
   - Worker name and assets directory live in `app/wrangler.jsonc`. There is no `main` script and no `routes` block. Set `not_found_handling` to `404-page` so `404.html` is served.
   - `app/public/_headers` is copied into `dist/` and sets `Content-Type: text/plain; charset=utf-8` on `*.txt` (Astro response headers are not kept on uploaded files).
   - `app-release.yml` runs `npm run build` then `wrangler deploy`.
   - All pages are pre-rendered at build time; no Node.js runtime is required in production.
12. **LLM Context Files (llms.txt)**:
   - The site provides machine-readable context files for LLMs at `https://koborin.ai/llms.txt`.
   - **Index file** (`/llms.txt`): Lists all available llms.txt variants with links.
   - **Full content files**: `/llms-full.txt` (English), `/llms-ja-full.txt` (Japanese) - all articles with full Markdown body.
   - **Category files**: `/llms-{category}.txt` (English), `/llms-ja-{category}.txt` (Japanese) for filtered subsets (tech, life).
   - English is the default language (no prefix), Japanese uses `ja` prefix.
   - **Auto-generated**: Articles are automatically included when `draft: true` is not set. No manual updates needed.
   - **Static files**: Generated at build time via Astro endpoints. Zero runtime overhead.
   - **Implementation**: `app/src/utils/llms.ts` (shared logic), `app/src/pages/llms*.txt.ts` (endpoints).
   - **When to modify endpoints**:
     - Add a new category: Create `app/src/pages/llms-{category}.txt.ts` (English) and `app/src/pages/llms-ja-{category}.txt.ts` (Japanese), then update `app/src/pages/llms.txt.ts` index.
     - Change output format: Edit `app/src/utils/llms.ts`.
     - Existing articles are auto-included; no endpoint changes needed for new content.
13. **RichLinkCard Component**:
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
14. **RSS Feeds**:
    - The site provides RSS feeds for blog aggregation services.
    - **English feed**: `/rss.xml` - includes `tech/` and `life/` categories.
    - **Japanese feed**: `/ja/rss.xml` - includes `ja/tech/` and `ja/life/` categories.
    - **Excluded**: `about-me/` pages are not included in RSS feeds (not blog articles).
    - **Auto-generated**: Articles are automatically included when `draft: true` is not set. No manual updates needed.
    - **Static files**: Generated at build time via Astro endpoints using `@astrojs/rss`. Zero runtime overhead.
    - **Implementation**: `app/src/pages/rss.xml.ts` (English), `app/src/pages/ja/rss.xml.ts` (Japanese).
    - **Sorted by date**: Articles are sorted by `publishedAt` date (newest first).
15. **Engagement Features (Giscus)**:
    - Articles (pages with `publishedAt`) display an engagement footer with share buttons and Giscus comments.
    - **Components**:
      - `app/src/components/Footer.astro`: Starlight Footer override that conditionally renders engagement UI.
      - `app/src/components/EngagementFooter.astro`: Container for share buttons and Giscus.
      - `app/src/components/ShareButtons.astro`: Share links (X, Bluesky, Mastodon, Hatena Bookmark, copy link).
      - `app/src/components/Giscus.astro`: GitHub Discussions-based comments (only renders if configured).
    - **Display logic**: Engagement UI appears on pages with `publishedAt` frontmatter. Override with `engagement: true/false` in frontmatter.
    - **Giscus setup** (requires GitHub Secrets):
      - Enable Discussions on the GitHub repository.
      - Install the `giscus` GitHub App.
      - Create a category for comments (e.g., "Comments").
      - Get configuration values from [giscus.app](https://giscus.app/).
      - Add GitHub Secrets: `GISCUS_REPO_ID`, `GISCUS_CATEGORY_ID` (IDs only; repo/category are hardcoded in `Giscus.astro`).
      - CI injects these as `PUBLIC_GISCUS_*_ID` environment variables in `app/.env` at build time.
    - **Theme sync**: Giscus theme automatically syncs with Starlight's light/dark mode toggle.
    - **Localization**: UI labels and Giscus `lang` switch based on `/ja/` path prefix.

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
   - **Image Optimization**: Use the `SiteImage` component (`app/src/components/SiteImage.astro`) for all local images. Direct use of `<Image />` / `<Picture />` from `astro:assets` is forbidden.
   - **Lazy Loading**: Ensure off-screen images and heavy components are lazy-loaded.

5. **Routing (Custom Pages)**
   - *Note: Documentation pages are managed by Starlight.*
   - **File-based Routing**: Use `src/pages/` for Astro endpoints (llms.txt, RSS feeds) or custom apps.
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
3. **Prefer version pins from project files** (e.g. `pubspec.yaml` for Dart, `go-version-file` for Go in other packages) over hardcoded versions in workflows.
4. **Verify compatibility** with existing dependencies before upgrading.
5. **Document breaking changes** in PR descriptions when upgrading major versions.

Examples:

- GitHub Actions: Check the action's releases page (e.g., `actions/setup-go` → use `@v6` if latest).
- Go modules: Use `go get <module>@latest` to fetch the latest version.
- npm packages: Use `npm outdated` to check for updates.

## CI/CD Expectations

- Workflows:
  - `plan-infra.yml`: `dart analyze` + `terraform plan` for the `site` stack (no apply).
  - `release-infra.yml`: authenticated `terraform apply` for the `site` stack (manual dispatch, `main` infra push, or `infra-v*` tag).
  - `app-ci.yml`: Astro app quality checks (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check-images`) on PRs touching `app/`.
  - `app-release.yml`: builds the static site and runs `wrangler deploy` for Worker `koborin-ai-web`.
- Cloudflare auth:
  - Secret: `CLOUDFLARE_API_TOKEN` (scoped to this account and zone).
  - Variable: `CLOUDFLARE_ACCOUNT_ID`.
  - Terraform state: R2 bucket `koborin-ai-tfstate` via `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.

## Release Process

- Tag infra releases as `infra-v*` to force `release-infra.yml` to apply the `site` stack.
- Tag app releases as `app-v*` once `main` includes the desired content; this runs `app-release.yml` and deploys Worker `koborin-ai-web`.
- GitHub release notes respect `.github/release.yml`. Label every PR with `app`, `infra`, `feature`, `bug`, or `doc` so notes land in the right category; use the `ignore` label when a PR should be excluded entirely.

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
   - Use simple subgraph labels (avoid long strings like `"Terraform Backend State - R2"`).
   - If diagrams look broken in dark mode, check that CSS selectors in `custom.css` cover the generated SVG structure.

6. **Terminology Tables for Abbreviations**:
   - When using abbreviations in Mermaid diagrams (e.g., Worker, R2), always add a terminology table immediately below the diagram.
   - **Format**: Use a Markdown table with columns: `Abbreviation`, `Full Name`, `Description`.
   - **Full Name requirements**:
     - Use the official name from the primary source (vendor documentation).
     - Make the full name a hyperlink to the official documentation page.
   - **MCP tools for terminology lookup**:
     - Google Cloud terms: Use `google-cloud-mcp` (`search_documentation` → `read_documentation`).
     - Other libraries/frameworks: Use `context7` MCP (`resolve-library-id` → `query-docs`).
   - **Example**:

     ```markdown
     | Abbreviation | Full Name | Description |
     | --- | --- | --- |
     | Worker | [Cloudflare Workers](https://developers.cloudflare.com/workers/) | Serves the static Astro site |
     | R2 | [Cloudflare R2](https://developers.cloudflare.com/r2/) | Object storage for Terraform state |
     ```

## Documentation Standards

1. **Markdown Formatting**:
   - Always add blank lines before and after headings.
   - Always add blank lines before and after lists.
   - Always add blank lines before and after tables.
   - Always add blank lines before and after code blocks.
   - Always specify language for code blocks (e.g., `bash`, `typescript`, `text`).
   - Remove trailing spaces at the end of lines.
   - End files with a single newline (no multiple blank lines at EOF).
   - Do not use backticks in headings (e.g., use `### infra/lib/site_stack.dart` instead of ``### `infra/lib/site_stack.dart` ``).
2. **Content Structure**:
   - Use clear, descriptive headings that reflect the content hierarchy.
   - Keep lists concise and actionable.
   - Include code examples where helpful, with proper language tags.

## Code Quality Standards

Before committing any code changes, ensure all quality checks pass:

### Infrastructure (`infra/`)

```bash
cd infra
dart analyze
```

All commands must complete successfully with no errors. CI also runs `terraform plan` via `plan-infra.yml`.

### Application (`app/`)

```bash
cd app
npm run build         # Astro build
npm run lint          # ESLint checks
npm run typecheck     # TypeScript type checking
npm run test          # Vitest unit tests
npm run check-images  # Image usage validation
```

All five commands must complete successfully with no errors.

## Pull Request Checklist

1. Update relevant docs (`README.md`, `AGENTS.md`, or files under `docs/`) when changing behavior.
   - **Directory structure changes** (e.g., `app/src/assets/`, `infra/lib/`): Update "Repository Layout" sections in both `README.md` and `AGENTS.md`.
   - **New conventions or rules**: Add to `AGENTS.md` under the appropriate section.
2. For infra: `dart analyze` in `infra/` - must pass.
3. For app: `npm run build && npm run lint && npm run typecheck && npm run test && npm run check-images` in `app/` - all must pass.
   - If the change touches a page with `draft: true`, these commands skip it. Also open the page in `npm run dev` and confirm it renders.
4. Ensure all Markdown files pass linting (no MD0xx errors).
5. Mention any manual Cloudflare or DNS steps (e.g., unmanaged MX/TXT) in the PR description.
6. **Label the PR** — usually automatic via `label-pr.yml`. Before requesting review, confirm labels match the diff (or add `ignore` to opt out):
   - **Domain labels** (one or more):
     - `app` — Changes under `app/`.
     - `infra` — Changes under `infra/`.
     - `doc` — Documentation updates (`README.md`, `AGENTS.md`, `docs/`).
     - `ci` — Workflow changes under `.github/workflows/`.
   - **Category labels** (optional, for release notes):
     - `feature`, `bug`, `ignore`.

## Agent Execution Rules

Rules for AI agents during task execution:

1. **Process Lifecycle Management**:
   - Any process started by the AI (dev server, background jobs, watchers, etc.) must be stopped by the AI when the task or verification ends.
   - Before starting a new dev server, check if one is already running using the terminals folder.
   - Use `pkill` or appropriate commands to terminate background processes after testing.

2. **Resource Cleanup**:
   - Close browser tabs opened for testing when verification is complete.
   - Remove temporary files created during debugging.

## Cursor Cloud specific instructions

### Primary product

The main local runtime is the **Astro + Starlight app** under `app/`. There is no docker-compose, database, or local API backend. Production serves static files as Cloudflare Worker assets.

### Toolchain versions

- **Node.js 22** (matches `app-ci.yml`). All npm commands run from `app/`.
- **Dart 3.10+** for `infra/` (TerraDart synth; CI uses 3.13).

### App development

```bash
cd app
npm run dev                 # http://localhost:4321
npm run lint                # astro check (lint + typecheck + tests)
npm run check-images
npm run build               # requires Playwright Chromium (see below)
npm run preview             # serve dist/ after build
```

Use **tmux** for long-running processes such as `npm run dev`.

### Playwright (required for full `npm run build`)

CI installs Chromium for Mermaid diagram rendering during production builds. After the VM update script runs `npm ci`, run once per fresh environment:

```bash
cd app && npx playwright install chromium
```

`npm run dev` does not need Playwright (Mermaid uses inline SVG in dev).

### Infrastructure

```bash
cd infra && dart analyze
```

Never run `terraform apply` locally. Infra changes go through GitHub Actions only.

### Optional tooling

- **webp / imagemagick**: Used by `app/scripts/optimize-og-images.sh` in CI behavior builds. Not required for local dev or `npm run build`.
- **Giscus / GA4**: Set `PUBLIC_GISCUS_*` and `PUBLIC_GA_MEASUREMENT_ID` in `app/.env` to mirror production engagement features. The site works without them.

