# /astro-content

Create Astro MDX content pages.

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
   - Revisit the title if the direction shifts while drafting. The title and the slug should agree. The social card uses the title.

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

Draft articles can stay in the sidebar. Dev shows a DRAFT badge. The production build omits the page and the sidebar link.

### 5. Assets

All on-page images must go through the `SiteImage` component (`app/src/components/SiteImage.astro`). Raw `<img>` tags and direct use of Astro's `<Image />` / `<Picture />` are forbidden, because they bypass the responsive `srcset`/AVIF/WebP pipeline and ship multi-MB originals.

#### Variant cheat sheet

Pick the variant by *rendered* size, not source dimensions:

| Variant | Use case | Rendered width |
|---------|----------|----------------|
| `card` | Top-page / list thumbnails | 160–480px |
| `thumbnail` | Small icon-like images | 80–240px |
| `inline` | Regular images inside article body | 400–1200px |

#### Rules for a new article

Article pages open with the title and the dates. Authors do not add a cover. The social card is generated at build time from the title, at `/og/<page path>.webp`. Home and about still set `ogImage`. Inline images stay on `SiteImage`.

1. **In-body images** (screenshots, diagrams, etc.) go under `app/src/assets/{category}/{article}/` and are rendered with `variant="inline"`:

   ```mdx
   import SiteImage from '../../../components/SiteImage.astro';
   import myImage from '../../../assets/{category}/{article}/image.png';

   <SiteImage src={myImage} alt="Description" variant="inline" />
   ```

2. **Do not** pass a string path (e.g. `src="/og/<slug>.png"`) to `SiteImage`. It requires an imported asset module so the build pipeline can emit optimized variants.

`SiteImage` API reference: `app/src/components/SiteImage.astro`.

## Formatting

- Headings start at `##`. The page title comes from frontmatter.
- Always specify a language on code blocks.
- Emoji only when the user asks for them.

For Japanese prose style, see `.cursor/rules/mdx-writing.md`.

## Verification

```bash
mise run check && npm run build --prefix app
```

Add the new public URL to `app/scripts/routes-baseline.txt` before the build. The build fails if that URL is missing, or if an unexpected URL appears. Generated `/og/*.webp` files are allowed.

If the article still has `draft: true`, those commands skip it entirely. Also run `npm run dev` and open the page, because a missing image import or broken MDX in a draft passes the build and only fails when rendered.
