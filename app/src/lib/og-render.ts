import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori, { type Font } from 'satori';
import sharp from 'sharp';
import { formatPostDate } from './catalog';
import { ogMark } from './mark';
import type { OgCard } from './og';

export class MissingGlyphError extends Error {
  override readonly name = 'MissingGlyphError';
  constructor(readonly segment: string) {
    super(`No card font has a glyph for ${JSON.stringify(segment)}. Add a font file to FONT_FILES.`);
  }
}

const WIDTH = 1200;
const HEIGHT = 630;

/** Satori reads woff, not woff2. Paths are the packages' public files exports. */
const FONT_FILES = [
  { name: 'Geist', weight: 600, file: '@fontsource/geist/files/geist-latin-600-normal.woff' },
  { name: 'Noto Sans JP', weight: 600, file: '@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-600-normal.woff' },
  { name: 'Geist Mono', weight: 400, file: '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff' },
] as const;

let fonts: Promise<Font[]> | undefined;

export async function renderOgCard(card: OgCard): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(cardTree(card), {
    width: WIDTH,
    height: HEIGHT,
    fonts: await cardFonts(),
    loadAdditionalAsset: refuseMissingGlyph,
  });
  const encoded = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
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

function cardTree(card: OgCard): Parameters<typeof satori>[0] {
  const mark = ogMark();
  const tree = {
    type: 'div',
    props: {
      lang: card.locale,
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        backgroundColor: '#0b0d12',
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
              color: '#eceae5',
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
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 16, color: '#d5dae1' },
                  children: [
                    {
                      type: 'img',
                      props: {
                        src: `data:image/svg+xml,${encodeURIComponent(mark.markup)}`,
                        width: mark.width,
                        height: mark.height,
                      },
                    },
                    { type: 'div', props: { style: { color: '#d5dae1' }, children: 'koborin.ai' } },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: { color: 'rgba(236,234,229,0.42)' },
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
