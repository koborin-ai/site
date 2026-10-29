# Agents Guide

Personal site and technical garden for `koborin.ai`. Talk to the user in Japanese. Write code, comments, names, and commit messages in English. Japanese in components is the copy a visitor reads.

Astro MDX lives in `app/src/content/docs/`. Home, lists, and articles share one centred column. The only public host is `koborin.ai`. TerraDart has one stack, `site`. For article prose, see Writing articles in `README.md`.

## Invariants

- A published article keeps its URL under `/tech/` or `/life/` (Japanese pages under `/ja/`). Do not move it to `/blog/`.
- Add each new public URL to `app/scripts/routes-baseline.txt`. The build fails when a listed URL is missing, or when an unexpected URL appears.
- `npm run build` skips `draft: true`. Open every draft you touched with `npm run dev`. After you remove `draft: true`, run the build again.
- Local images in MDX go through `SiteImage`. Do not use a raw `<img>`, or Astro `<Image />` or `<Picture />`, for a file under `app/src/assets/`.
- In Japanese prose, put a half-width space between Japanese text and a Markdown link. Do not put a space between full-width punctuation (`、`, `。`, `（`, `）`) and a link.
- Pass `title` and `description` to `RichLinkCard`. A URL alone fetches Open Graph data on every dev request.
- The updated date comes from `git log` on that MDX file. Put `Updated-Date: ignore` in the commit message to skip a commit. A trailer that exists only in the pull request description does not count.
- `app/src/sidebar.ts` is not rendered.
- Call `mdx()` without `optimize: true`. That option writes diagram CSS into `set:html`, and the fills go black.
- Do not set a Mermaid theme inside a diagram fence. `app/src/plugins/rehype-diagrams.ts` paints with the `--diagram-*` tokens.
- Under a diagram that uses an abbreviation, add a table with columns Abbreviation, Full Name, and Description. Link the official name. Keep node labels short.
- Leave the zone MX records and the GitHub verification TXT unmanaged. Do not add them to the `site` stack.
- Never run `terradart apply` locally. A local `terradart plan` is read-only. Apply runs in GitHub Actions.
- Terraform state is GCS bucket `koborin-ai-tfstate-n-koborinai`, prefix `terraform/site`. Actions use `GCP_WIF_PROVIDER` and `GCP_SA_EMAIL`. Do not run `terradart state migrate`.
- To change a shared social card, edit `SITE_CARDS` in `app/src/lib/og.ts` and bump that card's `version`.
- `npm run lint:prose` is advisory. It is not part of `mise run check`. Do not rewrite an article to silence it.
- Do not put backticks in a heading.

## Checks

Run `mise run check` from the repository root before committing. For an app change, also run `npm run build` in `app/`.

## Cursor Cloud

The VM image does not ship Dart, actionlint, or shellcheck. Install the pins in `.tool-versions` once:

```bash
curl https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"
mise install
```

Run later commands with `mise exec --` so they use those pins. mise does not install OpenTofu. The pinned `terradart_cli` downloads it when `tofu` is not on `PATH`.

A fresh environment needs `cd app && npx playwright install chromium`. The build renders Mermaid in Chromium. The consent check and Lighthouse launch that same browser. `npm run dev` does not need Chromium. Run `npm run dev` in tmux. The site runs without Giscus or GA4 variables.
