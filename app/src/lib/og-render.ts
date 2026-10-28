import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori, { type Font } from 'satori';
import sharp from 'sharp';
import { formatPostDate } from './catalog';
import { ogMark } from './mark';
import { OG_SIZE, type OgCard } from './og';

export class MissingGlyphError extends Error {
  override readonly name = 'MissingGlyphError';
  constructor(readonly segment: string) {
    super(`No card font has a glyph for ${JSON.stringify(segment)}. Add a font file to FONT_FILES.`);
  }
}

export const OG_WEBP_QUALITY = 90 as const;

const INK = {
  background: '#0b0d12',
  foreground: '#eceae5',
  accent: '#d5dae1',
  muted: '#eceae56b',
} as const;

const FOOTER_MARK = 26;
const SITE_MARK = 80;

/** Satori reads woff, not woff2. Paths are the packages' public files exports. */
const FONT_FILES = [
  { name: 'Geist', weight: 600, file: '@fontsource/geist/files/geist-latin-600-normal.woff' },
  { name: 'Noto Sans JP', weight: 600, file: '@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-600-normal.woff' },
  { name: 'Geist Mono', weight: 400, file: '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff' },
] as const;

let fonts: Promise<Font[]> | undefined;

export async function renderOgCard(card: OgCard): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(card.kind === 'article' ? articleTree(card) : siteTree(card), {
    ...OG_SIZE,
    fonts: await cardFonts(),
    loadAdditionalAsset: refuseMissingGlyph,
  });
  const encoded = await sharp(Buffer.from(svg)).webp({ quality: OG_WEBP_QUALITY }).toBuffer();
  const bytes = new Uint8Array(encoded.byteLength);
  bytes.set(encoded);
  return bytes;
}

function cardFonts(): Promise<Font[]> {
  const resolve = createRequire(import.meta.url).resolve;
  fonts ??= Promise.all(
    FONT_FILES.map(async (face) => ({
      name: face.name,
      weight: face.weight,
      style: 'normal' as const,
      data: await readFile(resolve(face.file)),
    })),
  );
  return fonts;
}

/** Satori calls this only for text that no loaded font covers. */
async function refuseMissingGlyph(_languageCode: string, segment: string): Promise<never> {
  throw new MissingGlyphError(segment);
}

function articleTree(card: Extract<OgCard, { kind: 'article' }>): Parameters<typeof satori>[0] {
  const tree = {
    type: 'div',
    props: {
      lang: card.locale,
      style: {
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        backgroundColor: INK.background,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              // Satori 0.33.5 applies lineClamp only when display is block.
              display: 'block',
              fontFamily: 'Geist, "Noto Sans JP"',
              fontWeight: 600,
              fontSize: 64,
              lineHeight: 1.25,
              color: INK.foreground,
              lineClamp: 4,
            },
            children: card.title,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'Geist Mono',
              fontWeight: 400,
              fontSize: 26,
              flexShrink: 0,
            },
            children: [
              lockup(FOOTER_MARK),
              {
                type: 'div',
                props: {
                  style: { color: INK.muted },
                  children: formatPostDate(card.publishedAt, 'home'),
                },
              },
            ],
          },
        },
      ],
    },
  };
  return tree as Parameters<typeof satori>[0];
}

function siteTree(card: Extract<OgCard, { kind: 'site' }>): Parameters<typeof satori>[0] {
  const tree = {
    type: 'div',
    props: {
      style: {
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36,
        backgroundColor: INK.background,
      },
      children: [
        lockup(SITE_MARK),
        ...(card.tagline
          ? [
              {
                type: 'div',
                props: {
                  style: { fontFamily: 'Geist Mono', fontWeight: 400, fontSize: 26, color: INK.muted },
                  children: card.tagline,
                },
              },
            ]
          : []),
      ],
    },
  };
  return tree as Parameters<typeof satori>[0];
}

function lockup(markHeight: number) {
  const mark = ogMark(markHeight);
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: Math.round((markHeight * 16) / FOOTER_MARK),
        color: INK.accent,
        fontFamily: 'Geist Mono',
        fontWeight: 400,
        fontSize: markHeight,
      },
      children: [
        {
          type: 'img',
          props: {
            src: `data:image/svg+xml,${encodeURIComponent(mark.markup)}`,
            width: mark.width,
            height: mark.height,
          },
        },
        { type: 'div', props: { children: 'koborin.ai' } },
      ],
    },
  };
}
