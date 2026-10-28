import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { OG_SIZE } from './og';
import { MissingGlyphError, OG_WEBP_QUALITY, renderOgCard } from './og-render';

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

const channelToleranceByWebpQuality = { 90: 8 } as const;

const background = [0x0b, 0x0d, 0x12];
const accent = [0xd5, 0xda, 0xe1];
const mutedOnBackground = [0xec, 0xea, 0xe5].map((channel, index) =>
  Math.round(channel * (0x6b / 255) + background[index] * (1 - 0x6b / 255)),
);

interface InkBand {
  top: number;
  bottom: number;
  left: number;
  right: number;
  brightest: number[];
}

const brightness = (pixel: number[]) => pixel[0] + pixel[1] + pixel[2];

async function raster(bytes: Uint8Array): Promise<{ pixel: (x: number, y: number) => number[]; bands: InkBand[] }> {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => {
    const index = (y * info.width + x) * info.channels;
    return [data[index], data[index + 1], data[index + 2]];
  };
  const bands: InkBand[] = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const ink = pixel(x, y);
      if (channelDelta(ink, background) <= 24) continue;
      let band = bands.at(-1);
      if (!band || band.bottom < y - 1) {
        band = { top: y, bottom: y, left: x, right: x, brightest: ink };
        bands.push(band);
      }
      band.bottom = y;
      band.left = Math.min(band.left, x);
      band.right = Math.max(band.right, x);
      if (brightness(ink) > brightness(band.brightest)) band.brightest = ink;
    }
  }
  return { pixel, bands };
}

describe('renderOgCard', () => {
  it('paints the footer mark and leaves the arch open', async () => {
    const bytes = await renderOgCard({ kind: 'article', title: 'A', locale: 'en', publishedAt });
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const index = (y * info.width + x) * info.channels;
      return [data[index], data[index + 1], data[index + 2]];
    };
    const channelTolerance = channelToleranceByWebpQuality[OG_WEBP_QUALITY];
    expect(channelDelta(pixel(82, 538), [0xd5, 0xda, 0xe1])).toBeLessThanOrEqual(channelTolerance);
    expect(channelDelta(pixel(88, 528), [0x0b, 0x0d, 0x12])).toBeLessThanOrEqual(channelTolerance);
  });

  it('renders the longest Japanese title and a short English title as 1200x630 webp', async () => {
    const longBytes = await renderOgCard({
      kind: 'article',
      title: longestJapaneseTitle,
      locale: 'ja',
      publishedAt,
    });
    const shortBytes = await renderOgCard({
      kind: 'article',
      title: 'A',
      locale: 'en',
      publishedAt,
    });
    expect(await sharp(longBytes).metadata()).toMatchObject({ format: 'webp', width: 1200, height: 630 });
    expect(await sharp(shortBytes).metadata()).toMatchObject({ format: 'webp', width: 1200, height: 630 });
  });

  it('keeps the footer when the title is the longest Japanese title', async () => {
    const longBytes = await renderOgCard({
      kind: 'article',
      title: longestJapaneseTitle,
      locale: 'ja',
      publishedAt,
    });
    const shortBytes = await renderOgCard({
      kind: 'article',
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
      kind: 'article',
      title: '老いていく自分を認める',
      locale: 'ja',
      publishedAt,
    });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('rejects an emoji the card fonts cannot draw', async () => {
    const rocket = '\u{1F680}';
    const error = await renderOgCard({
      kind: 'article',
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
        kind: 'article',
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

describe('renderOgCard for site cards', () => {
  const tolerance = channelToleranceByWebpQuality[OG_WEBP_QUALITY];
  const hero = renderOgCard({ kind: 'site', tagline: 'Personal site and technical proving ground' });
  const fallback = renderOgCard({ kind: 'site' });

  it('draws both cards at the size Head advertises', async () => {
    expect(await sharp(await hero).metadata()).toMatchObject({ format: 'webp', ...OG_SIZE });
    expect(await sharp(await fallback).metadata()).toMatchObject({ format: 'webp', ...OG_SIZE });
  });

  it('centres the accent lockup alone on the fallback card, with the mark 80px tall', async () => {
    const { pixel, bands } = await raster(await fallback);
    expect(bands).toHaveLength(1);
    const [lockup] = bands;
    expect(lockup.bottom - lockup.top + 1).toBe(80);
    expect(Math.abs((lockup.top + lockup.bottom) / 2 - (OG_SIZE.height - 1) / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs((lockup.left + lockup.right) / 2 - (OG_SIZE.width - 1) / 2)).toBeLessThanOrEqual(4);
    const leftBar = pixel(lockup.left + 8, lockup.bottom - 10);
    expect(channelDelta(leftBar, accent)).toBeLessThanOrEqual(tolerance);
  });

  it('adds one muted tagline line below the lockup on the hero card', async () => {
    const { pixel, bands } = await raster(await hero);
    expect(bands).toHaveLength(2);
    const [lockup, tagline] = bands;
    expect(lockup.bottom - lockup.top + 1).toBe(80);
    const leftBar = pixel(lockup.left + 8, lockup.bottom - 10);
    expect(channelDelta(leftBar, accent)).toBeLessThanOrEqual(tolerance);
    expect(tagline.top).toBeGreaterThan(lockup.bottom + 36);
    // A 26px stroke has no flat interior, and lossy WebP rings past its colour at the edges.
    expect(channelDelta(tagline.brightest, mutedOnBackground)).toBeLessThanOrEqual(2 * tolerance);
  });
});
