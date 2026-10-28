import sharp from 'sharp';
import { tileSvg } from './mark.ts';

export type Icon =
  | { readonly file: string; readonly format: 'ico'; readonly px: readonly number[] }
  | { readonly file: string; readonly format: 'png'; readonly px: number; readonly rel: 'icon' | 'apple-touch-icon' }
  | { readonly file: string; readonly format: 'svg' };

export const ICONS = [
  { file: 'favicon.ico', format: 'ico', px: [16, 32, 48] },
  { file: 'favicon.png', format: 'png', px: 512, rel: 'icon' },
  { file: 'favicon.svg', format: 'svg' },
  { file: 'apple-touch-icon.png', format: 'png', px: 180, rel: 'apple-touch-icon' },
] as const satisfies readonly Icon[];

export interface IconLink {
  readonly rel: 'icon' | 'apple-touch-icon';
  readonly href: `/${string}`;
  readonly type?: 'image/png' | 'image/svg+xml';
  readonly sizes?: `${number}x${number}`;
}

export const ICON_LINKS: readonly IconLink[] = ICONS.map(iconLink);

export async function renderIcon(icon: Icon): Promise<{ readonly bytes: Uint8Array<ArrayBuffer>; readonly type: string }> {
  switch (icon.format) {
    case 'svg':
      return { bytes: new TextEncoder().encode(tileSvg(32, 'rounded')), type: 'image/svg+xml' };
    case 'png':
      return { bytes: await png(icon.px, tileCorners(icon)), type: 'image/png' };
    case 'ico':
      return {
        bytes: packIco(await Promise.all(icon.px.map(async (px) => ({ px, png: await png(px, 'rounded') })))),
        type: 'image/x-icon',
      };
  }
}

function iconLink(icon: Icon): IconLink {
  const href = `/${icon.file}` as `/${string}`;
  switch (icon.format) {
    case 'ico':
      // Chrome prefers an ICO that advertises sizes="any" over the SVG icon.
      return { rel: 'icon', href, sizes: '32x32' };
    case 'png':
      return { rel: icon.rel, href, type: 'image/png', sizes: `${icon.px}x${icon.px}` };
    case 'svg':
      return { rel: 'icon', href, type: 'image/svg+xml' };
  }
}

function tileCorners(icon: Extract<Icon, { format: 'png' }>): 'rounded' | 'square' {
  // iOS paints transparent apple-touch pixels black.
  return icon.rel === 'apple-touch-icon' ? 'square' : 'rounded';
}

async function png(px: number, corners: 'rounded' | 'square'): Promise<Uint8Array<ArrayBuffer>> {
  const encoded = await sharp(Buffer.from(tileSvg(px, corners))).png().toBuffer();
  const bytes = new Uint8Array(encoded.byteLength);
  bytes.set(encoded);
  return bytes;
}

function packIco(frames: readonly { readonly px: number; readonly png: Uint8Array<ArrayBuffer> }[]): Uint8Array<ArrayBuffer> {
  const headerSize = 6 + 16 * frames.length;
  const total = headerSize + frames.reduce((sum, frame) => sum + frame.png.byteLength, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, frames.length, true);
  let offset = headerSize;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const entry = 6 + 16 * index;
    const side = frame.px >= 256 ? 0 : frame.px;
    view.setUint8(entry, side);
    view.setUint8(entry + 1, side);
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, frame.png.byteLength, true);
    view.setUint32(entry + 12, offset, true);
    out.set(frame.png, offset);
    offset += frame.png.byteLength;
  }
  return out;
}
