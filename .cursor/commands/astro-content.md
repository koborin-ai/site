# /astro-content

Create Astro/Starlight MDX content pages.

## Usage

Invoke when the user says "write a new article", "add a blog post", "create content in Tech/Life category", or "add an MDX page".

## Directory Structure

```text
app/src/content/docs/
├── about-me/          # About Me section
│   └── overview.mdx
├── tech/              # Tech articles
│   └── *.mdx
└── life/              # Life articles
    └── *.mdx
```

Japanese versions live under `app/src/content/docs/ja/<category>/<slug>.mdx` with the same slug.

## Execution Flow

### 0. Before writing anything

Talk with the user first. Do not open an editor until these are settled.

1. **Clarify the core message**
   - Ask what the reader should take away, and identify the single most important point.
2. **Dig into experiences and episodes**
   - Ask for concrete stories, failures, and specifics. Raw detail is what makes the article theirs.
3. **Decide the writing style**
   - `life/` is だ・である調 and `tech/` is です・ます調. Confirm the category, which settles this.
4. **Verify the title matches the content**
   - Revisit the title if the direction shifts while drafting. The title, slug, and OG image should all agree.

Prefer having the author write the first draft in their own words. Editing their draft produces a better article than generating prose for them to react to. See `.cursor/rules/mdx-writing.md`.

### 1. Confirm category

| Category | Purpose |
|----------|---------|
| tech | Technical articles (Cloud, AI, DevOps, Architecture, etc.) |
| life | Lifestyle, hobbies, journals, etc. |

### 2. Gather article information

- **Title**
- **Description**: one sentence, around 60 to 70 Japanese characters so it is not truncated in search results and OG cards
- **Slug**: URL path (`tech/genkit-intro` becomes `/tech/genkit-intro/`)
- **publishedAt**: `YYYY-MM-DD`, set to the date the article actually goes live
- **Draft**: whether to start with `draft: true`

### 3. Create the MDX file

**File path**: `app/src/content/docs/{category}/{slug}.mdx`

```yaml
---
title: <title>
description: <description>
ogImage: /og/<slug>.png
publishedAt: YYYY-MM-DD
draft: true  # Only while unfinished
---
```

### 4. Update sidebar.ts

Add the article to `app/src/sidebar.ts`:

```typescript
{
  label: "Tech",
  items: [
    { label: "<Article Title>", slug: "tech/<slug>" },
  ],
},
```

Draft articles can stay in the sidebar. `starlight-auto-drafts` shows them with a DRAFT badge in dev and removes them from production builds.

### 5. Assets

All on-page images must go through the `SiteImage` component (`app/src/components/SiteImage.astro`). Raw `<img>` tags and direct use of Astro's `<Image />` / `<Picture />` are forbidden, because they bypass the responsive `srcset`/AVIF/WebP pipeline and ship multi-MB originals.

#### Variant cheat sheet

Pick the variant by *rendered* size, not source dimensions:

| Variant | Use case | Rendered width |
|---------|----------|----------------|
| `hero` | LCP candidate, top-page hero | ~1376px |
| `articleHeader` | LCP candidate, article opener (OG image displayed in body) | ~750px |
| `card` | Top-page / list thumbnails | 160–480px |
| `thumbnail` | Small icon-like images | 80–240px |
| `inline` | Regular images inside article body | 400–1200px |

#### Rules for a new article

1. **Article header image (OG image)**: place the same PNG in **both**
   - `app/public/og/<slug>.png` — consumed by OG meta tags (`Head.astro` rewrites to `.webp`; do not remove).
   - `app/src/assets/og/<slug>.png` — imported by `SiteImage` so Astro can generate optimized variants.

   Size it like the existing ones (1424x752). Standard OG cards crop to roughly 1.91:1, so a squarer image loses its top and bottom on social.

2. **Render the article opener** at the top of the MDX body:

   ```mdx
   import SiteImage from '../../../components/SiteImage.astro';
   import headerImage from '../../../assets/og/<slug>.png';

   <SiteImage src={headerImage} alt="..." variant="articleHeader" style="width: 100%; height: auto;" />
   ```

3. **In-body images** (screenshots, diagrams, etc.) go under `app/src/assets/{category}/{article}/` and are rendered with `variant="inline"`:

   ```mdx
   import SiteImage from '../../../components/SiteImage.astro';
   import myImage from '../../../assets/{category}/{article}/image.png';

   <SiteImage src={myImage} alt="Description" variant="inline" />
   ```

4. **Do not** pass a string path (e.g. `src="/og/<slug>.png"`) to `SiteImage`. It requires an imported asset module so the build pipeline can emit optimized variants.

`SiteImage` API reference: `app/src/components/SiteImage.astro`.

## Formatting

- Headings start at `##`. Starlight generates `#` from the frontmatter title.
- Always specify a language on code blocks.
- Emoji only when the user asks for them.

For Japanese prose style, see `.cursor/rules/mdx-writing.md`.

## Verification

```bash
mise run check && npm run build --prefix app
```

If the article still has `draft: true`, those commands skip it entirely. Also run `npm run dev` and open the page, because a missing image import or broken MDX in a draft passes the build and only fails when rendered.
