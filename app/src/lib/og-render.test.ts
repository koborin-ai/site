import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MissingGlyphError, renderOgCard } from './og-render';

const publishedAt = new Date('2026-02-14T00:00:00.000Z');

const longestJapaneseTitle =
  'Genkit for Dart の MCP プラグイン開発で体感した Model Context Protocol の仕組み';

async function bottomRows(bytes: Uint8Array, rows: number): Promise<Buffer> {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const rowBytes = info.width * info.channels;
  return data.subarray((info.height - rows) * rowBytes);
}

function channelDelta(pixel: number[], expected: number[]): number {
  return Math.max(...pixel.map((channel, index) => Math.abs(channel - expected[index])));
}

describe('renderOgCard', () => {
  it('paints the footer mark and leaves the arch open', async () => {
    const bytes = await renderOgCard({ title: 'A', locale: 'en', publishedAt });
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const index = (y * info.width + x) * info.channels;
      return [data[index], data[index + 1], data[index + 2]];
    };
    // WebP quality 90 shifts a flat fill by a couple of levels.
    expect(channelDelta(pixel(82, 538), [0xd5, 0xda, 0xe1])).toBeLessThanOrEqual(8);
    expect(channelDelta(pixel(88, 528), [0x0b, 0x0d, 0x12])).toBeLessThanOrEqual(8);
  });

  it('renders the longest Japanese title and a short English title as 1200x630 webp', async () => {
    const longBytes = await renderOgCard({
      title: longestJapaneseTitle,
      locale: 'ja',
      publishedAt,
    });
    const shortBytes = await renderOgCard({
      title: 'A',
      locale: 'en',
      publishedAt,
    });
    expect(await sharp(longBytes).metadata()).toMatchObject({ format: 'webp', width: 1200, height: 630 });
    expect(await sharp(shortBytes).metadata()).toMatchObject({ format: 'webp', width: 1200, height: 630 });
  });

  it('keeps the footer when the title is the longest Japanese title', async () => {
    const longBytes = await renderOgCard({
      title: longestJapaneseTitle,
      locale: 'ja',
      publishedAt,
    });
    const shortBytes = await renderOgCard({
      title: 'A',
      locale: 'en',
      publishedAt,
    });
    const longFooter = await bottomRows(longBytes, 40);
    const shortFooter = await bottomRows(shortBytes, 40);
    expect(longFooter.equals(shortFooter)).toBe(true);
  });

  it('renders a Japanese title', async () => {
    const bytes = await renderOgCard({
      title: '老いていく自分を認める',
      locale: 'ja',
      publishedAt,
    });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('rejects an emoji the card fonts cannot draw', async () => {
    const rocket = '\u{1F680}';
    const error = await renderOgCard({
      title: `ship it ${rocket}`,
      locale: 'en',
      publishedAt,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MissingGlyphError);
    expect((error as MissingGlyphError).segment).toBe(rocket);
  });

  it('renders a Japanese title when fetch throws', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error('network disabled');
    };
    try {
      const bytes = await renderOgCard({
        title: '老いていく自分を認める',
        locale: 'ja',
        publishedAt,
      });
      expect(await sharp(bytes).metadata()).toMatchObject({ format: 'webp', width: 1200, height: 630 });
    } finally {
      globalThis.fetch = original;
    }
  });
});
