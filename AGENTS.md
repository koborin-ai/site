# Agents Guide

This document is a quick guide for any contributors or AI agents that touch the `koborin.ai` repository.

## Language Policy

- **Conversation**: Always communicate with the user in **Japanese**.
- **Code**: Write all code, comments, variable names, and commit messages in **English**.

## Mission

- Personal site + technical garden for `koborin.ai`.
- Astro for MDX content under `app/src/content/docs/`. Home, lists, and articles share one centred column.
- Cloudflare Workers static assets on `koborin.ai` only. No `dev.koborin.ai`.
- Infrastructure managed via TerraDart (Dart) with one Terraform root module: `site`.
- CI/CD and `terradart plan` / `terradart apply` executed only through GitHub Actions using a scoped Cloudflare API token.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `.tool-versions` | Node, Dart, actionlint, and shellcheck versions. The only place they are declared. OpenTofu is not listed. When `tofu` is not on `PATH`, `terradart_cli` 0.35.0 downloads OpenTofu 1.13.1. |
| `mise.toml` | The `check` task tree that fans out to app, infra, and automation. |
| `app/` | Astro app (TypeScript, MDX, Vitest). |
| `app/.oxlintrc.json` | oxlint rules; covers `.ts` and the client `<script>` blocks in `.astro`. |
| `app/.textlintrc.json` | textlint AI-writing preset for article prose; advisory, not a gate. |
| `app/vitest.config.ts` | Vitest wired through Astro's `getViteConfig`. |
| `app/wrangler.jsonc` | Worker name `koborin-ai-web`, `assets.directory` `./dist`, and `not_found_handling` `404-page`. |
| `app/public/_headers` | Worker static-asset header rules. UTF-8 on `*.txt`, immutable cache on `/_astro/*`, and the security headers for every response. |
| `app/src/content/docs/` | MDX documentation pages. Mark drafts with `draft: true` in frontmatter. |
| `app/src/content.config.ts` | Zod schema for the `docs` content collection. |
| `app/src/pages/[...slug].astro` | Renders each docs entry at its current public URL. |
| `app/src/lib/` | Public URL mapping, the home and list catalog, the git updated date, and link-card icon lookup. |
| `app/src/data/site-icons.json` | Hostname to data-URL favicons for rich link cards. |
| `app/src/lib/og.ts` | Which card each page gets (`ogImageFor`), every `/og/` file the build emits (`ogCards`), and the card size. |
| `app/src/lib/og-render.ts` | Renders article and shared cards to WebP at build time. |
| `app/src/lib/mark.ts` | The only copy of the mark geometry. |
| `app/src/lib/icons.ts` | Favicon rows, `ICON_LINKS`, and `renderIcon`. |
| `app/src/lib/consent.ts` | The only owner of analytics consent. Stores the choice, loads or halts gtag.js, deletes `_ga` cookies, and tells the banner when to show. |
| `app/scripts/render-mark.ts` | Writes the four public icon files from the mark. |
| `app/src/styles/vendor/` | Reset, props, util, and print CSS copied from Starlight 0.42.6. The layout keeps the class names those files expect. |
| `app/src/styles/prose.css` | The only stylesheet inside `.sl-markdown-content`; tokens at the top. |
| `app/src/plugins/rehype-diagrams.ts` | Renders Mermaid at natural size in `figure.diagram`, paints it with the `--diagram-*` tokens, and wraps each table in `div.table-frame`. |
| `app/scripts/routes-baseline.txt` | Public URLs the production build must still emit. `/pagefind/` is the only allowed omission. |
| `app/scripts/required-checks.ts` | The only list of pull request path areas (`areaPaths`), and the `required-checks` verdict. Imports `node:` built-ins only, because it runs before `npm ci`. |
| `app/scripts/smoke-prod.ts` | Probes `koborin.ai` from the route baseline after each app deploy and weekly. Sends GETs only. |
| `app/scripts/lighthouse-pr.ts` | Serves `app/dist` on `127.0.0.1` with Brotli and runs Lighthouse on four baseline pages. `judgeLighthouse` owns the minimums and the exit code. |
| `app/scripts/workflow-policy.ts` | One rule per file in `.github/workflows/`: SHA pins, `contents: read` permissions, the fork skip on the label job, and the concurrency groups. Imports `node:` built-ins only. |
| `app/scripts/subset-noto-sans-jp.ts` | Subsets Noto Sans JP on every build and writes the late-loaded stylesheet. |
| `app/src/utils/llms.ts` | Shared logic for llms.txt generation. |
| `app/src/pages/llms*.txt.ts` | Astro endpoints that generate llms.txt files at build time. |
| `app/src/pages/rss.xml.ts` | RSS feed endpoint for English articles. |
| `app/src/pages/ja/rss.xml.ts` | RSS feed endpoint for Japanese articles. |
| `app/src/pages/og/[...slug].webp.ts` | Prerendered endpoint for every card in `ogCards`. |
| `infra/` | TerraDart infrastructure (`site` stack). |
| `infra/lib/site_stack.dart` | Zone lookup and Workers custom domain for `koborin.ai`. |
| `infra/bin/infra.dart` | Entry point. `runStack` writes `tf-out/site/main.tf.json` with `S3Backend.r2`. `terradart plan` and `terradart apply` run it. |
| `infra/test/` | `dart test` coverage for the synthesized Terraform JSON. |
| `.github/actionlint.yaml` | Declares the Blacksmith runner labels so actionlint stays clean. |
| `.github/scripts/` | Shell helpers (`compute-pr-labels.sh`) plus their test suite. |
| `.github/workflows/` | CI/CD definitions. `required-checks.yml` is the only `pull_request` entry for app, infra, and automation checks. |

## Infrastructure Rules

1. **Plan/Apply**: never run `terradart apply` locally. All infra changes go through GitHub Actions with a scoped Cloudflare API token. A local `terradart plan` is read-only and is OK for verification.
2. **State backend**: Cloudflare R2 bucket `koborin-ai-tfstate`. Key: `terraform/site/terraform.tfstate`. Do not run `terradart state migrate`.
3. **Stacks**: One root module (`site`). From `infra/`, `dart run terradart_cli:terradart plan` synthesizes it and plans with the OpenTofu binary that `terradart_cli` downloads.
4. **Environments**:

   - Production host: `koborin.ai` only. There is no `dev.koborin.ai`.
   - Worker: `koborin-ai-web` (static assets from `app/dist`). No Worker JavaScript `main`.
   - GitHub Environments: `production (app)` and `production (infra)`.

5. **Architecture Design**:

   - The `site` stack looks up zone `koborin.ai` and attaches Worker `koborin-ai-web` as a custom domain.
   - It does not create the zone. MX and GitHub organization verification TXT stay unmanaged.
   - App files are published with `wrangler deploy`, not Terraform.

6. **Configuration Management**:

   - The entry point reads one environment variable, `CLOUDFLARE_ACCOUNT_ID`. The
     state bucket and key are constants in `bin/infra.dart`.
   - Cloudflare credentials stay in GitHub Secrets (`CLOUDFLARE_API_TOKEN`, `R2_*`) and are never baked into synth output. Plan and apply pass the R2 keys as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
   - Site `variable` blocks stay empty. The encoder omits an empty variable block because Terraform JSON rejects `variable: {}`.
   - `infra/pubspec.yaml` sets `terradart.engine: tofu` and pins `terradart_cli` to `0.35.0`. With that setting, a `tofu` on `PATH` is used. Otherwise that release downloads OpenTofu 1.13.1, checks the archive SHA-256, and caches the binary. CI does not install Terraform or `tofu`, so the download is what runs.

7. **File Organization**:

   - `infra/bin/infra.dart`: Entry point. Builds the stack, passes `S3Backend.r2` (`terradart_core`) as the state backend, and calls `runStack`, which writes `tf-out/site`.
   - `infra/lib/site_stack.dart`: Zone lookup and Workers custom domain, both from the `terradart_cloudflare` catalog. Prefer catalog types over hand-written wrappers.
   - `infra/pubspec.yaml`: TerraDart dependencies (`terradart_core`, `terradart_cloudflare`) and the pinned `terradart_cli`.

## Application Rules

1. **MDX workflow**:
   - Author pages under `app/src/content/docs/`. Use YAML frontmatter with `title`, `description`.
   - Mark drafts with `draft: true` in frontmatter to exclude them from production and from the article lists.
   - **Drafts are not covered by `npm run build`**: `getStaticPaths` omits `draft: true` outside `npm run dev`, so a broken draft passes CI and only fails once rendered. Open every draft you touched in `npm run dev` before considering it done, and re-run `npm run build` after removing `draft: true` so the page enters the build for the first time under your own eyes.
   - **Prose review while drafting**: `npx textlint <file>` in `app/` reads the article back for AI-writing tells (English-calque `〜：` lead-ins, absolute claims, mechanical emphasis). It only reacts to Japanese; all 17 English MDX files report zero. Treat every hit as a suggestion to read again, not a rule.
2. **Adding new content**:
   - Create `.mdx` file under `app/src/content/docs/` (or a subdirectory such as `tech/`, `life/`, or `ja/`).
   - Add frontmatter: `title` (required), `description` (required), `publishedAt` (required for articles, `YYYY-MM-DD`), `draft` (optional, boolean).
   - A published article (frontmatter `publishedAt`, not a draft) is listed on the home page and on `/blog/` or `/ja/blog/` from the content collection. No sidebar entry.
   - Folder structure maps to URL structure: `docs/tech/post.mdx` → `/tech/post/`. Article URLs stay under `/tech/` and `/life/` until a later move to `/blog/`.
   - Add the new public URL to `app/scripts/routes-baseline.txt`. `npm run build` fails when a baseline URL is missing, or when an unexpected URL appears. Generated `/og/*.webp` files are allowed. `/pagefind/` may disappear. The only other allowed additions are the pages in `allowedAdditions` inside `app/scripts/check-routes.ts` (`/blog/`, `/ja/blog/`, `/talks/`, `/ja/talks/`, `/about/`, `/ja/about/`). After the next deploy, `app/scripts/smoke-prod.ts` probes those URLs on `https://koborin.ai`. It skips `/pagefind/` and worker control files such as `/_headers`.
   - **Japanese link spacing**: In Japanese MDX prose, add a half-width space between Japanese text characters (hiragana, katakana, kanji) and Markdown links. Do NOT add a space between full-width punctuation (`、`, `。`, `（`, `）`) and links — full-width characters already have built-in visual whitespace.
     - Good: `どのバージョンの [仕様](https://...) に準拠する`
     - Good: `GA で、[Dart 版](https://...) は 2026 年` (no space after `、`)
     - Bad: `どのバージョンの[仕様](https://...)に準拠する` (missing spaces around link)
     - Bad: `GA で、 [Dart 版](https://...) は` (unnecessary space after `、`)
3. **Brand Assets Management**:
   - **Favicon**: `ICONS` in `app/src/lib/icons.ts` lists `favicon.ico`, `favicon.png`, `favicon.svg`, and `apple-touch-icon.png`. `app/scripts/render-mark.ts` writes those files into `app/public/`. `Head.astro` links them in that order. Every theme gets the dark tile. To add an icon, add a row, run the script, and add its URL to `app/scripts/routes-baseline.txt`.
   - **Header mark**: The home link in `app/src/components/SiteHeader.astro` is the mark plus the word `koborin.ai`. The geometry lives only in `app/src/lib/mark.ts`. `mark.test.ts` fails if the arch path appears in any other file, and it allows a public `ICONS` file only when the bytes match `renderIcon`. It also fails on any other image file under `app/public/`. The SVG is `aria-hidden` and paints with `--site-accent`. At 385px and below the word is visually hidden and stays the link's accessible name.
   - **Article Images**: Place in `app/src/assets/{category}/{article}/` (e.g., `tech/koborin-ai-architecture/`).
   - Comments in CSS and JS are English. Japanese text in components is user-facing copy.
4. **Image Conventions**:
   - **MANDATORY**: Local images in MDX go through `SiteImage` (`app/src/components/SiteImage.astro`). Do not use a raw `<img>`, or Astro's `<Image />` / `<Picture />`, for those files. Remote thumbnails in `RichLinkCard.astro` use a plain `<img>` because `SiteImage` requires an `ImageMetadata` import.
   - **Why**: `SiteImage` centralizes responsive `srcset`/`sizes`, quality, format (AVIF/WebP), and loading strategy per variant. Bypassing it breaks LCP budgets and ships multi-MB originals.
   - **Enforcement**: `npm run check-images` (part of `npm run check`) scans MDX for raw `<img>` tags and Markdown images that point at `src/assets`. It does not scan `.astro` files.
   - **Variant table** — pick the variant that matches the rendered size, not the source dimensions:

     | Variant | Use case | Rendered width |
     |---------|----------|----------------|
     | `card` | Top-page / list thumbnails | 160–480px |
     | `thumbnail` | Small icon-like images | 80–240px |
     | `inline` | Regular images inside article body | 400–1200px |

   - **Import pattern** (article body):

     ```mdx
     import SiteImage from '../../../components/SiteImage.astro';
     import myImage from '../../../assets/category/article/image.png';

     <SiteImage src={myImage} alt="Description" variant="inline" />
     ```

5. **OG Image Management**:
   - Article pages open with the title and the dates. Authors do not add a cover.
   - Every page's `og:image` comes from `ogImageFor(entry)` in `app/src/lib/og.ts`. `Head.astro` takes the page's `entry`, not an image URL, and the docs schema is strict, so frontmatter cannot name an image.
   - An article gets its card at `/og/<page path>.webp`, drawn from the title. An English article at `/tech/mcp-deep-dive/` gets `/og/tech/mcp-deep-dive.webp`. The Japanese page gets `/og/ja/tech/mcp-deep-dive.webp`. The card footer shows the mark left of the word.
   - Home and About get `/og/koborin-ai-hero.webp?v=2`. Every other page, including 404 and the list pages, gets `/og/index.webp?v=2`. Both shared cards are the mark and the word centred, from `SITE_CARDS` in `og.ts`. The hero adds the tagline.
   - `renderOgCard` in `app/src/lib/og-render.ts` draws every card at build time, locally and in CI alike. The mark reaches a card only through `ogMark(height)` in `app/src/lib/mark.ts`. No card is a file under `app/public/`.
   - X and Slack cache a card by its URL. To change a shared card, edit `SITE_CARDS` or the site card tree in `og-render.ts`, and bump that card's `version` in `SITE_CARDS`.
   - Inline images stay on `SiteImage` with `variant="inline"`.
6. **Article Dates**:
   - **Published Date**: Set `publishedAt: YYYY-MM-DD` in frontmatter when creating a new article.
   - **Updated Date**: `app/src/lib/last-updated.ts` walks `git log` for the MDX file and skips a commit whose message contains `Updated-Date: ignore`. Put that trailer in the commit message. Squash merges on this repo keep the commit list, so a trailer that exists only in the pull request description does not count. Set `lastUpdated: false` to hide the line. The home pages do.
   - **Display**: Dates appear below the article title (e.g., `Published: Dec 1, 2024 · Updated: Jan 2, 2025`).
   - **Localization**: English uses `Dec 1, 2024` format; Japanese uses `2024年12月1日` format.
   - **Same-day Updates**: If `publishedAt` and `lastUpdated` are within 1 day, only the published date is shown.
   - **CI/CD**: Uses `fetch-depth: 0` to clone full Git history so the updated date can read commits.
   - **Local Development**: Updated date is shown for committed files. New uncommitted files show only the published date (if set).
7. **Site chrome**:
   - One centred column on a dot grid. Home, `/about/`, `/blog/`, `/talks/`, and article pages share `app/src/components/SiteShell.astro`. There is no sidebar and no table of contents. Home, About, and the list pages stay on a 720px column. Article pages widen to an 800px column, with body text held to 740px and figures, code, and diagrams using the full column.
   - Colours and type live in `app/src/styles/site.css` and `app/src/styles/fonts.css`. The accent is neutral (`#d5dae1` in dark, `#4a5260` in light). Text links are underlined. Article prose is `app/src/styles/prose.css`. `npm run test` fails if another stylesheet selects into the body.
   - Noto Sans JP is not on the critical path. `npm run build` runs `app/scripts/subset-noto-sans-jp.ts`, which subsets weights 400 and 500 to the characters in the built HTML and the content files, plus ASCII, kana, and Japanese punctuation. Japanese pages fetch `/fonts/noto-sans-jp.css` after the load event and register the faces with the Font Loading API (`font-display: swap`). A stylesheet link makes the browser apply the Latin faces it had already skipped, which shifts a line. `fonts.css` keeps a local fallback whose vertical metrics match the source face, so the swap does not move the line box. `diagram-fonts.css` is only for Mermaid measurement and is not shipped as a page stylesheet. `npm run dev` writes the same files under `app/public/fonts/` (gitignored).
   - The header has the mark and the word `koborin.ai` in one home link, an About link, an EN/JA link, GitHub, X, RSS, and the theme control. Home keeps the name, bio, and three lists. The longer profile lives on `/about/` and `/ja/about/`. Home sections and the list pages read `app/src/lib/catalog.ts`. `app/src/sidebar.ts` is not rendered.
8. **Testing**: run `mise run check` from the repository root before committing. The task list is under Code Quality Standards. Run `npm run build` in `app/` as well whenever content or configuration changes.
9. **Observability**: structured logging via `console.log(JSON.stringify(...))` for now; a telemetry stack is not defined yet.
10. **Workers deployment**:
    - The app builds as a static site. `astro.config.ts` leaves `output` unset, and Astro's default is `static`. Wrangler uploads `app/dist` as Worker static assets.
    - Worker name and assets directory live in `app/wrangler.jsonc`. There is no `main` script and no `routes` block. Set `not_found_handling` to `404-page` so `404.html` is served.
    - `app/public/_headers` is copied into `dist/` (Astro response headers are not kept on uploaded files). It sets `Content-Type: text/plain; charset=utf-8` on `*.txt`, `Cache-Control: public, max-age=31536000, immutable` on `/_astro/*` and `/fonts/*.woff2`, `Cache-Control: public, max-age=0, must-revalidate` on `/fonts/noto-sans-jp.css`, and the security headers (HSTS without preload, nosniff, Referrer-Policy, Permissions-Policy, COOP, `X-Frame-Options`, CSP) on every asset. `script-src` allows hashed inline scripts plus `googletagmanager.com` and `giscus.app`. `style-src` keeps `'unsafe-inline'` because Mermaid SVG and Shiki emit inline styles, and also allows `giscus.app` because the comments client injects its stylesheet. `npm run build` runs `scripts/check-csp.ts`, which fails when an inline script hash drifts. Do not add HSTS `preload` unless every `koborin.ai` hostname is HTTPS.
    - `app-release.yml` runs `npm run check`, `npm run build`, then `wrangler deploy`, and only when `github.ref` is `refs/heads/main`. A separate `smoke` job then calls `smoke-prod.yml`, so a failed probe shows as a red job next to a green deploy.
    - All pages are pre-rendered at build time; no Node.js runtime is required in production.
11. **LLM Context Files (llms.txt)**:
    - The site provides machine-readable context files for LLMs at `https://koborin.ai/llms.txt`.
    - **Index file** (`/llms.txt`): Lists all available llms.txt variants with links.
    - **Full content files**: `/llms-full.txt` (English), `/llms-ja-full.txt` (Japanese). Every non-draft doc, with its Markdown body (articles, home, about, and privacy).
    - **Category files**: `/llms-{category}.txt` (English), `/llms-ja-{category}.txt` (Japanese) for filtered subsets (tech, life).
    - English is the default language (no prefix), Japanese uses `ja` prefix.
    - **Auto-generated**: Non-draft docs are included when `draft: true` is not set. No manual updates needed.
    - **Static files**: Generated at build time via Astro endpoints. Zero runtime overhead.
    - **Implementation**: `app/src/utils/llms.ts` (shared logic), `app/src/pages/llms*.txt.ts` (endpoints).
    - **When to modify endpoints**:
      - Add a new category: Create `app/src/pages/llms-{category}.txt.ts` (English) and `app/src/pages/llms-ja-{category}.txt.ts` (Japanese), then update `app/src/pages/llms.txt.ts` index.
      - Change output format: Edit `app/src/utils/llms.ts`.
      - Existing articles are auto-included; no endpoint changes needed for new content.
12. **RichLinkCard Component**:
     - Use `RichLinkCard` for external links in MDX.
     - **Location**: `app/src/components/RichLinkCard.astro`
     - **Import**: from `tech/` or `life/`, `../../../components/RichLinkCard.astro`. From `ja/tech/` or `ja/life/`, `../../../../components/RichLinkCard.astro`.
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
     - **Auto-fetch priority** (when title/description not provided): title (og:title → `<title>` → domain), description (og:description → meta description).
     - **Site icon**: a 14px icon sits left of the domain. `app/scripts/fetch-site-icons.ts` reads each card host's own favicon at build time and writes `app/src/data/site-icons.json`. The card never requests a favicon service. A missing host renders the domain alone. Re-run `node --experimental-strip-types scripts/fetch-site-icons.ts` from `app/` after adding a host.
13. **RSS Feeds**:
     - The site provides RSS feeds for blog aggregation services.
     - **English feed**: `/rss.xml` - includes `tech/` and `life/` categories.
     - **Japanese feed**: `/ja/rss.xml` - includes `ja/tech/` and `ja/life/` categories.
     - **Excluded**: Paths outside `tech/` and `life/`. The filter is `path.startsWith('tech/') || path.startsWith('life/')`, so home, about, and privacy stay out.
     - **Auto-generated**: Articles are automatically included when `draft: true` is not set. No manual updates needed.
     - **Static files**: Generated at build time via Astro endpoints using `@astrojs/rss`. Zero runtime overhead.
     - **Implementation**: `app/src/pages/rss.xml.ts` (English), `app/src/pages/ja/rss.xml.ts` (Japanese).
     - **Sorted by date**: Articles are sorted by `publishedAt` date (newest first).
14. **Engagement Features (Giscus)**:
     - Articles (pages with `publishedAt`) display an engagement footer with share buttons and Giscus comments.
     - **Components**:
       - `app/src/components/Footer.astro`: Renders the engagement UI, then the copyright and privacy link.
       - `app/src/components/EngagementFooter.astro`: Container for share buttons and Giscus.
       - `app/src/components/ShareButtons.astro`: Share links (X, LinkedIn, Facebook, Bluesky, Mastodon, Hatena Bookmark, copy link).
       - `app/src/components/Giscus.astro`: GitHub Discussions-based comments (only renders if configured).
     - **Display logic**: Engagement UI appears on pages with `publishedAt` frontmatter. Override with `engagement: true/false` in frontmatter.
     - **Giscus setup** (requires GitHub Secrets):
       - Enable Discussions on the GitHub repository.
       - Install the `giscus` GitHub App.
       - Create a category for comments (e.g., "Comments").
       - Get configuration values from [giscus.app](https://giscus.app/).
       - Add GitHub Secrets: `GISCUS_REPO_ID`, `GISCUS_CATEGORY_ID` (IDs only; repo/category are hardcoded in `Giscus.astro`).
       - CI injects these as `PUBLIC_GISCUS_*_ID` environment variables in `app/.env` at build time.
     - **Theme sync**: Giscus theme syncs with the light and dark toggle. The stored key remains `starlight-theme`.
     - **Localization**: UI labels and Giscus `lang` switch based on `/ja/` path prefix.

## Astro Development Best Practices

1. **Styling**
   - **No Tailwind**: This project does not use Tailwind CSS. Stick to standard CSS.

2. **Routing (Custom Pages)**
   - Documentation pages are the `docs` collection, rendered by `src/pages/[...slug].astro`. A file under `src/pages/` wins over that rest route.
   - **File-based Routing**: Use `src/pages/` for Astro endpoints (llms.txt, RSS feeds) or custom apps.
   - **Dynamic Routes**: Use `[...slug].astro` and `getStaticPaths()` for dynamic static pages.
   - **404**: Maintain a custom `404.astro` for proper error handling.

3. **Type Safety**
   - Component props use TypeScript interfaces.
   - `app/tsconfig.json` extends `astro/tsconfigs/base`. That preset does not enable `strict`.

## Dependency Version Policy

When adding or updating dependencies (GitHub Actions, npm packages, pub packages):

1. **Always check for the latest stable version** before adding a new dependency.
2. **Pin every external GitHub Action to a full commit SHA** with a trailing `# vX.Y.Z` comment, for example `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`. Local `./.github/workflows/...` calls stay as paths.
3. **Prefer version pins from project files** over hardcoded versions in workflows: `.tool-versions` for Node, Dart, actionlint, and shellcheck; `package.json` for npm; `pubspec.yaml` for pub. OpenTofu is pinned inside the exact `terradart_cli` version.
4. **Verify compatibility** with existing dependencies before upgrading.
5. **Document breaking changes** under Risk and manual steps in the PR description when upgrading major versions.

Dependabot covers npm (`app/`), pub (`infra/`), and GitHub Actions. It does not understand `.tool-versions`, so Node, Dart, actionlint, and shellcheck are bumped by hand there. `terradart_cli` is pinned to an exact version in `infra/pubspec.yaml`. That pin selects the OpenTofu release.

Examples:

- GitHub Actions: Pin the commit SHA and keep the version in the comment (`actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`). Dependabot updates both.
- npm packages: Use `npm outdated` in `app/`.
- pub packages: Use `dart pub outdated` in `infra/`.

## CI/CD Expectations

- Workflows:
  - `required-checks.yml`: runs on every pull request. Its `changes` job maps the merge diff to the app, infra, and automation areas through `areaPaths` in `app/scripts/required-checks.ts`, and the workflow calls the area workflows below for the areas that changed. Its `required-checks` job is the one check context a ruleset needs. It fails when `changes` did not succeed, when any area job failed or was cancelled, and when a changed area's job was skipped or is missing. A pull request that touches no area passes.
  - `app-ci.yml`: called for the app area. `npm run check` plus `npm audit` and the production build, then `app/scripts/lighthouse-pr.ts` over `/`, `/ja/`, and the English and Japanese architecture articles, once per page on desktop and on mobile. It uploads the reports as the `lighthouse` artifact. A score under its minimum is report-only. A missing report (no Chrome, a non-200 page, a null score) fails the app job and so `required-checks`.
  - `plan-infra.yml`: called for the infra area, or dispatched. The `check` job runs `mise run check:infra` with no secrets, so Dependabot and fork pull requests run it too. The `plan` job runs `dart run terradart_cli:terradart plan` for the `site` stack, skips Dependabot and forks, and alone holds the `terraform-state` concurrency group. A failed `check` or `plan` fails `required-checks`.
  - `automation-ci.yml`: called for the automation area. `mise run check:automation` and `mise run check:docs`.
  - `release-infra.yml`: `mise run check:infra`, then `dart run terradart_cli:terradart plan` and `dart run terradart_cli:terradart apply --auto-approve` for the `site` stack, on a `main` push under `infra/` or a dispatch. The job runs only when `github.ref` is `refs/heads/main`, in the `production (infra)` environment.
  - `app-release.yml`: `npm run check`, the production build, and `wrangler deploy` for Worker `koborin-ai-web`, then the `smoke` job. The deploy job runs only when `github.ref` is `refs/heads/main`.
  - `smoke-prod.yml`: runs `node scripts/smoke-prod.ts` against `https://koborin.ai` after each app deploy, every Monday at 04:23 UTC, and on dispatch from `main`. It needs no token and no `npm ci`. A failure turns the run red and rolls nothing back.
- Path filters: pull request path filters do not select checks. Do not add `paths` or `paths-ignore` to a `pull_request` trigger. To change which checks a path runs, edit `areaPaths`. A new area also needs a job with the same id in `required-checks.yml` and an entry in the `required-checks` job's `needs`. `app/scripts/required-checks.test.ts` fails if a filter returns or the job wiring drifts.
- Concurrency: `required-checks.yml` and `label-pr.yml` cancel the superseded run of the same pull request. `app-release` and `terraform-state` (apply and the `plan` job) never cancel a run in progress. Called workflows have no group of their own. `mise run check:automation` runs `app/scripts/workflow-policy.ts`, which fails when a pin, a permission block, or a group drifts, and when a workflow file has no rule.
- Toolchain: every workflow takes its Node, Dart, actionlint, and shellcheck versions from `.tool-versions`. `actions/setup-node` uses `node-version-file: .tool-versions`; the infra and automation workflows use `jdx/mise-action`. Bump those versions in `.tool-versions`, never in a workflow. Infra plan and apply do not install Terraform. With no `tofu` on `PATH`, `terradart plan` downloads OpenTofu.
- Cloudflare auth:
  - Secret: `CLOUDFLARE_API_TOKEN` (scoped to this account and zone).
  - Variable: `CLOUDFLARE_ACCOUNT_ID`.
  - State: R2 bucket `koborin-ai-tfstate` via `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.

## Release Process

- App deploy and infra apply run only from `main`. A `workflow_dispatch` from any other ref skips the deploy or apply job.
- `release-infra.yml` applies the `site` stack when a push to `main` touches `infra/**`. To re-apply, dispatch it from `main`. `infra-v*` tags do not apply. The workflow has no tag trigger.
- `app-release.yml` deploys Worker `koborin-ai-web` when a push to `main` touches its path filter (`app/**`, `.tool-versions`, `mise.toml`, and the two app workflow files), and on `workflow_dispatch` from `main`.
- GitHub release notes respect `.github/release.yml`. Label every PR with `app`, `infra`, `feature`, `bug`, or `doc` so notes land in the right category; use the `ignore` label when a PR should be excluded entirely.

## Analytics

- The site uses GA4. `app/src/components/Head.astro` writes the `ga-measurement-id` meta when `PUBLIC_GA_MEASUREMENT_ID` is set, and `app/src/lib/consent.ts` loads gtag only after the visitor accepts. The footer's Cookie settings button reopens the banner. Decline halts a loaded tag and deletes `_ga` and `_ga_*` on the host and its parent domains.
- `consent.test.ts` fails if another file under `app/src/` names `cookie_consent`, the gtag.js URL, or `ga-disable-`. `npm run build` ends with `scripts/check-consent.ts`, which drives `dist/` in Chromium under the CSP from `public/_headers`.

## Diagram Guidelines

1. **Article diagrams**:
   - Put each diagram in a fenced `mermaid` block in the MDX file.
2. **Layout**:
   - Published articles use both `flowchart LR` and `flowchart TB`.
3. **Spec images**:
   - `docs/` is gitignored. Article diagrams stay in the MDX file.
4. **Referencing in Documents**:
   - Do not replace a Mermaid block with a Markdown image. The old `docs/assets` sample is not a file in this repo.

   ```markdown
   A fenced mermaid block stays in the MDX. It is not a PNG under docs/.
   ```

5. **Mermaid in MDX Articles**:
   - Mermaid code blocks in MDX files are rendered via `rehype-mermaid` with `strategy: "inline-svg"`, called from `app/src/plugins/rehype-diagrams.ts`.
   - Call `mdx()` without `optimize: true`. That option writes SVG `<style>` CSS into a `set:html` attribute, and the diagram fills go black.
   - `rehype-diagrams.ts` paints diagrams with the `--diagram-*` tokens in `prose.css`. A diagram type without a `PAINT` entry fails the build.
   - **Do not override Mermaid theme in code blocks** - the `--diagram-*` tokens handle theme switching.
   - Keep node labels short to avoid text overlap (especially in `flowchart LR` layouts).
   - Use simple subgraph labels (avoid long strings like `"Terraform Backend State - R2"`).

6. **Terminology Tables for Abbreviations**:
   - When using abbreviations in Mermaid diagrams (e.g., Worker, R2), always add a terminology table immediately below the diagram.
   - **Format**: Use a Markdown table with columns: `Abbreviation`, `Full Name`, `Description`.
   - **Full Name requirements**:
     - Use the official name from the primary source (vendor documentation).
     - Make the full name a hyperlink to the official documentation page.
   - **Where to look terms up**: Cloudflare terms come from `developers.cloudflare.com`. For libraries and frameworks, use whatever documentation MCP your client has configured; the repository does not ship one.
   - **Example**:

     ```markdown
     | Abbreviation | Full Name | Description |
     | --- | --- | --- |
     | Worker | [Cloudflare Workers](https://developers.cloudflare.com/workers/) | Serves the static Astro site |
     | R2 | [Cloudflare R2](https://developers.cloudflare.com/r2/) | Object storage for Terraform state |
     ```

## Documentation Standards

- `mise run check:docs` runs markdownlint on every tracked Markdown file. The config is `.markdownlint.yaml`.
- Fenced blocks and lists need a blank line before and after (MD031, MD032). A fence does not need a language tag (MD040 is off).
- Do not put backticks in headings.

## Code Quality Standards

Before committing any code changes, ensure all quality checks pass.

### Everything at once

```bash
mise run check
```

This is the command to reach for. It runs the four `check:*` tasks in `mise.toml` (`check:app`, `check:infra`, `check:automation`, `check:docs`) in parallel.

### Infrastructure (`infra/`)

```bash
mise run check:infra  # dart pub get, dart analyze, dart test
```

On a pull request, `required-checks.yml` calls `plan-infra.yml`, which also runs `terradart plan`.

### Application (`app/`)

```bash
cd app
npm run lint          # oxlint over .ts and .astro <script> blocks
npm run typecheck     # astro check (types + Astro diagnostics)
npm run test          # Vitest unit tests; needs Playwright Chromium
npm run check-images  # Image usage validation
npm run check         # All four of the above
npm run build         # Astro build; needs Playwright Chromium
npm run lint:prose    # textlint over the articles; advisory, see below
node scripts/lighthouse-pr.ts /tmp/lighthouse  # after npm run build; reports into the given directory
```

`npm run build` is not part of `check` because it takes 40 seconds. Run it whenever content, assets, or configuration change.

`npm run lint:prose` is not part of `check` either, for a different reason. Measured against the 32 non-draft MDX files, the `@textlint-ja` AI-writing preset disagrees with the house style rather than finding defects. The script itself globs every MDX file under `src/content/docs/` (34 files, drafts included):

| Rule | Hits | Verdict |
| --- | --- | --- |
| `no-ai-list-formatting` | 209 | Disabled. 191 are `- **Term**: description`, the convention this very file is written in. |
| `no-ai-colon-continuation` | 33 | Kept. Flags `〜は以下の通りです：`, which is ordinary Japanese; read the suggestion, then decide. |
| `ai-tech-writing-guideline` | 12 | Kept. Advisory; per-rule `severity` is ignored inside a preset, so it cannot be downgraded. |
| `no-ai-hype-expressions` | 4 | Kept, but all four current hits are false positives on essay prose. |

Gating on 49 stylistic disagreements would force a rewrite of the author's Japanese voice, so this stays a drafting aid. If you decide you agree with a rule, promoting it is a config change plus adding the script to `check`.

### Automation (`.github/`)

```bash
mise run check:automation  # actionlint, workflow policy, shellcheck, PR label tests
mise run check:docs        # markdownlint over every tracked .md
```

## Pull Request Checklist

1. Update relevant docs (`README.md`, `AGENTS.md`) when changing behavior.
   - **Directory structure changes** (e.g., `app/src/assets/`, `infra/lib/`): Update "Repository Layout" sections in both `README.md` and `AGENTS.md`.
   - **New conventions or rules**: Add to `AGENTS.md` under the appropriate section.
2. `mise run check` from the repository root - must pass.
3. For app changes, also run `npm run build` in `app/` - must pass.
   - If the change touches a page with `draft: true`, these commands skip it. Also open the page in `npm run dev` and confirm it renders.
4. Markdown lint is part of `mise run check` (`check:docs`); no separate step.
5. Fill in every section of `.github/pull_request_template.md`. Put manual Cloudflare, DNS, or repository settings steps, such as edits to the unmanaged MX and TXT records, under Risk and manual steps.
6. **Label the PR** — usually automatic via `label-pr.yml`, which skips fork pull requests because their token cannot write labels. Before requesting review, confirm labels match the diff (or add `ignore` to opt out):
   - **Domain labels** (one or more):
     - `app` — Changes under `app/`.
     - `infra` — Changes under `infra/`.
     - `doc` — `docs/*`, `README.md`, `AGENTS.md`, or `.cursor/*` (`compute-pr-labels.sh`).
     - `ci` — Workflow changes under `.github/workflows/`.
   - **Category labels** (optional, for release notes):
     - `feature`, `bug`, `ignore`.

## Cursor Cloud specific instructions

### Primary product

The main local runtime is the **Astro app** under `app/`. There is no docker-compose, database, or local API backend. Production serves static files as Cloudflare Worker assets.

### Toolchain versions

`.tool-versions` at the repository root is the only place Node, Dart, actionlint, and shellcheck versions are declared. The VM image does not ship Dart, actionlint, or shellcheck, so install them once per fresh environment. OpenTofu is downloaded by `terradart plan`, not by mise:

```bash
curl https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"
mise install                # ~4s for the whole toolchain
```

Prefix commands with `mise exec --` (or activate mise in the shell) so they use the pinned versions rather than whatever the image happens to have.

### App development

```bash
cd app
npm run dev                 # http://localhost:4321
npm run check               # oxlint, astro check, Vitest, image usage; requires Playwright Chromium
npm run build               # requires Playwright Chromium (see below)
npm run preview             # serve dist/ after build
```

From the repository root, `mise run check` additionally covers `infra/` and `.github/`.

Use **tmux** for long-running processes such as `npm run dev`.

### Playwright (required for `npm run check` and `npm run build`)

CI installs Chromium for Mermaid diagram rendering during production builds, and `app/scripts/lighthouse-pr.ts` launches the same binary. The Vitest contract test in `app/src/styles/prose.test.ts` renders Mermaid too. After the VM update script runs `npm ci`, run once per fresh environment:

```bash
cd app && npx playwright install chromium
```

The image may carry a stale browser build; if the build reports a missing executable, rerun that command. `npm run dev` does not need Playwright (Mermaid uses inline SVG in dev).

### Infrastructure

```bash
mise run check:infra
```

Never run `terradart apply` locally. Infra changes go through GitHub Actions only.

### Optional tooling

- **Giscus / GA4**: Set `PUBLIC_GISCUS_*` and `PUBLIC_GA_MEASUREMENT_ID` in `app/.env` to mirror production engagement features. The site works without them.

