import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { diffRoutes, readBaseline } from '../../scripts/check-routes.ts';
import { ogCards, ogImageFor, type OgSource } from './og';

function source(id: string, data: OgSource['data']): OgSource {
  return { id, data };
}

const publishedAt = new Date('2026-02-14T00:00:00.000Z');

const englishArticle = source('tech/mcp-deep-dive', {
  title: 'Understanding Model Context Protocol Through Building the Genkit for Dart MCP Plugin',
  publishedAt,
});
const japaneseArticle = source('ja/tech/mcp-deep-dive', {
  title: 'Genkit for Dart の MCP プラグイン開発で体感した Model Context Protocol の仕組み',
  publishedAt,
});

describe('ogImageFor', () => {
  it('serves an article its card at the page path, with no query', () => {
    expect(ogImageFor(englishArticle)).toBe('/og/tech/mcp-deep-dive.webp');
    expect(ogImageFor(japaneseArticle)).toBe('/og/ja/tech/mcp-deep-dive.webp');
    expect(ogImageFor(source('life/reflections-on-2025', { title: 'Reflections on 2025', publishedAt }))).toBe(
      '/og/life/reflections-on-2025.webp',
    );
  });

  it('gives home and about, in both locales, the versioned hero card', () => {
    for (const id of ['index', 'ja', 'ja/index', 'about', 'ja/about']) {
      expect(ogImageFor(source(id, { title: 'koborin.ai' })), id).toBe('/og/koborin-ai-hero.webp?v=2');
    }
  });

  it('gives every other page, and a page with no entry, the versioned fallback card', () => {
    expect(ogImageFor(source('privacy-policy', { title: 'Privacy Policy' }))).toBe('/og/index.webp?v=2');
    expect(ogImageFor(source('ja/privacy-policy', { title: 'Privacy Policy' }))).toBe('/og/index.webp?v=2');
    expect(ogImageFor(source('tech/undated', { title: 'Undated' }))).toBe('/og/index.webp?v=2');
    expect(ogImageFor(undefined)).toBe('/og/index.webp?v=2');
  });
});

describe('ogCards', () => {
  it('emits one card per article, then both site cards', () => {
    const docs = [englishArticle, japaneseArticle, source('index', { title: 'Welcome to koborin.ai' })];
    expect(ogCards(docs)).toEqual([
      {
        slug: 'tech/mcp-deep-dive',
        path: '/og/tech/mcp-deep-dive.webp',
        card: { kind: 'article', title: englishArticle.data.title, locale: 'en', publishedAt },
      },
      {
        slug: 'ja/tech/mcp-deep-dive',
        path: '/og/ja/tech/mcp-deep-dive.webp',
        card: { kind: 'article', title: japaneseArticle.data.title, locale: 'ja', publishedAt },
      },
      {
        slug: 'koborin-ai-hero',
        path: '/og/koborin-ai-hero.webp',
        card: { kind: 'site', tagline: 'Personal site and technical proving ground' },
      },
      { slug: 'index', path: '/og/index.webp', card: { kind: 'site' } },
    ]);
  });

  it('emits the file behind every og:image', () => {
    const docs = [
      englishArticle,
      japaneseArticle,
      source('index', { title: 'Welcome to koborin.ai' }),
      source('ja/about', { title: 'About' }),
      source('privacy-policy', { title: 'Privacy Policy' }),
    ];
    const emitted = new Set<string>(ogCards(docs).map((card) => card.path));
    for (const entry of [...docs, undefined]) {
      expect(emitted.has(ogImageFor(entry).split('?')[0]), entry?.id).toBe(true);
    }
  });
});

describe('route checker', () => {
  it('files card paths as generated og webp', async () => {
    const baseline = (await readFile(new URL('../../scripts/routes-baseline.txt', import.meta.url), 'utf8'))
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const cardPaths = [
      '/og/tech/mcp-deep-dive.webp',
      '/og/ja/tech/mcp-deep-dive.webp',
      '/og/life/reflections-on-2025.webp',
    ];
    const result = diffRoutes(baseline, [...baseline, ...cardPaths]);
    expect(result.unexpected).toEqual([]);
    expect(result.generated).toEqual(cardPaths);
  });

  it('lists every shared card in the baseline, so the build fails if one stops being emitted', async () => {
    const baseline = new Set(await readBaseline());
    const paths = ogCards([]).map((card) => card.path);
    expect(paths).not.toEqual([]);
    expect(paths.filter((path) => !baseline.has(path))).toEqual([]);
  });
});
