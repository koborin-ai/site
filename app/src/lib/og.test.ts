import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { diffRoutes } from '../../scripts/check-routes.mjs';
import { articleCard, ogImageFor, type OgSource } from './og';

function source(id: string, data: OgSource['data']): OgSource {
  return { id, data };
}

const publishedAt = new Date('2026-02-14T00:00:00.000Z');

describe('articleCard', () => {
  it('serves an English article at its page path', () => {
    expect(
      articleCard(
        source('tech/mcp-deep-dive', {
          title: 'Understanding Model Context Protocol Through Building the Genkit for Dart MCP Plugin',
          publishedAt,
        }),
      ),
    ).toEqual({
      path: '/og/tech/mcp-deep-dive.webp',
      card: {
        title: 'Understanding Model Context Protocol Through Building the Genkit for Dart MCP Plugin',
        locale: 'en',
        publishedAt,
      },
    });
  });

  it('serves a Japanese article at its page path', () => {
    expect(
      articleCard(
        source('ja/tech/mcp-deep-dive', {
          title: 'Genkit for Dart の MCP プラグイン開発で体感した Model Context Protocol の仕組み',
          publishedAt,
        }),
      ),
    ).toEqual({
      path: '/og/ja/tech/mcp-deep-dive.webp',
      card: {
        title: 'Genkit for Dart の MCP プラグイン開発で体感した Model Context Protocol の仕組み',
        locale: 'ja',
        publishedAt,
      },
    });
  });

  it('follows the page path instead of the legacy image name', () => {
    expect(
      articleCard(
        source('life/reflections-on-2025', {
          title: 'Reflections on 2025',
          publishedAt,
        }),
      )?.path,
    ).toBe('/og/life/reflections-on-2025.webp');
  });

  it('returns undefined for home, about, and privacy', () => {
    expect(articleCard(source('index', { title: 'Welcome to koborin.ai' }))).toBeUndefined();
    expect(articleCard(source('about', { title: 'About' }))).toBeUndefined();
    expect(articleCard(source('privacy-policy', { title: 'Privacy Policy' }))).toBeUndefined();
  });
});

describe('ogImageFor', () => {
  it('returns the card path for an article', () => {
    expect(
      ogImageFor(
        source('tech/mcp-deep-dive', {
          title: 'Understanding Model Context Protocol Through Building the Genkit for Dart MCP Plugin',
          publishedAt,
        }),
      ),
    ).toBe('/og/tech/mcp-deep-dive.webp');
  });

  it('returns the frontmatter image for home', () => {
    expect(
      ogImageFor(
        source('index', {
          title: 'Welcome to koborin.ai',
          ogImage: '/og/koborin-ai-hero.png',
        }),
      ),
    ).toBe('/og/koborin-ai-hero.png');
  });

  it('returns undefined for privacy so Head can use its default', () => {
    expect(ogImageFor(source('privacy-policy', { title: 'Privacy Policy' }))).toBeUndefined();
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
});
