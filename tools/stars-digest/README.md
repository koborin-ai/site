# stars-digest

Dart package that generates the daily `koborin.ai/stars` personalized OSS newsletter.  
It reads the starred-repos data from a local [stars](https://github.com/koborin-ai/stars) clone,
selects a main deep-dive + up-to-5 new-arrival sub items, and produces structured
prose via Gemini (or a deterministic stub for offline use).

## Setup

```bash
cd tools/stars-digest
dart pub get
dart run build_runner build
```

## Tests

```bash
dart test
```

## CLI — generate an edition

```bash
dart run bin/generate.dart \
  --stars-dir /absolute/path/to/stars \
  --site-dir  /absolute/path/to/n-koborinai-me

# Offline dry-run (no Gemini call, stub content):
dart run bin/generate.dart \
  --stars-dir /absolute/path/to/stars \
  --site-dir  /absolute/path/to/n-koborinai-me \
  --dry-run

# Override the date (defaults to today in Asia/Tokyo):
dart run bin/generate.dart \
  --stars-dir /absolute/path/to/stars \
  --site-dir  /absolute/path/to/n-koborinai-me \
  --date 2026-05-31
```

Requires `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) in the environment unless `--dry-run`.

## Genkit Developer UI

Iterate on the prompt and Edition output interactively.

### Required environment variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Gemini API key (not needed with `dryRun: true`) |
| `STARS_DIR` | _Optional._ Path to the local stars clone. Auto-detected as a sibling of the site repo; set only to override. |
| `SITE_DIR` | _Optional._ Path to the n-koborinai-me repo root. Auto-detected from the script location; set only to override. |

### Start the Dev UI

Run from **this directory** (`tools/stars-digest`). The local `package.json` exists
solely so the genkit CLI roots its project here — the CLI finds the project root by
walking up for a `package.json`, and it must match where the Dart reflection server
registers its runtime (`./.genkit/runtimes`). Running from elsewhere makes the CLI
watch the wrong directory and the Dev UI never connects.

```bash
cd tools/stars-digest
export GEMINI_API_KEY=...   # or GOOGLE_API_KEY (skip if only using dryRun)

genkit start -o -- dart run bin/dev.dart
```

`STARS_DIR` / `SITE_DIR` are auto-detected for the standard layout
(`StudioProjects/{stars, n-koborinai-me}`). Override them only if your clones live elsewhere.

The Genkit Dev UI opens at **http://localhost:4000**.

### Troubleshooting

- **"Waiting to connect to Genkit runtime…"** — the CLI's project root doesn't match
  where the Dart reflection server registered. Make sure you launched from
  `tools/stars-digest` (so the local `package.json` anchors the root). As a
  file-discovery–free alternative, use the WebSocket reflection server, which connects
  directly and ignores project-root matching:
  ```bash
  genkit start -o --experimental-reflection-v2 -- dart run bin/dev.dart
  ```
- **"ENOENT … ui/browser/index.html"** on first launch — the CLI is still downloading
  the Dev UI assets for its version. Re-run once the download finishes, or
  `rm -rf ~/.genkit/assets/<version>` and re-run to fetch them cleanly.

### Running the flow

Select the **`starsDigest`** flow in the Dev UI and provide input JSON:

| Input | Effect |
|---|---|
| `{}` | Use today's date (Asia/Tokyo), call Gemini |
| `{"dateJst": "2026-05-31"}` | Use the specified date, call Gemini |
| `{"dryRun": true}` | Skip Gemini, return stub content |
| `{"dateJst": "2026-05-31", "dryRun": true}` | Specified date + stub content |
