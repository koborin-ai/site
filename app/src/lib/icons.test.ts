import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ICONS, ICON_LINKS, renderIcon, type Icon } from './icons';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

function icoFrames(bytes: Uint8Array): { px: number; png: Uint8Array }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(view.getUint16(0, true)).toBe(0);
  expect(view.getUint16(2, true)).toBe(1);
  const count = view.getUint16(4, true);
  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + 16 * index;
    const px = view.getUint8(entry) || 256;
    const height = view.getUint8(entry + 1) || 256;
    expect(height).toBe(px);
    const size = view.getUint32(entry + 8, true);
    const offset = view.getUint32(entry + 12, true);
    return { px, png: bytes.subarray(offset, offset + size) };
  });
}

async function raw(bytes: Uint8Array): Promise<Buffer> {
  const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

async function corner(bytes: Uint8Array): Promise<number[]> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2], data[3]].map((channel, index) => (info.channels > index ? channel : 0));
}

describe('icons', () => {
  it('links the rows in table order', () => {
    expect(ICON_LINKS).toEqual([
      { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
      { rel: 'icon', href: '/favicon.png', type: 'image/png', sizes: '512x512' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' },
    ]);
  });

  it('lists every file in the route baseline', () => {
    const baseline = new Set(
      readFileSync(fileURLToPath(new URL('../../scripts/routes-baseline.txt', import.meta.url)), 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
    for (const icon of ICONS) {
      expect(baseline.has(`/${icon.file}`)).toBe(true);
    }
  });

  it.each(ICONS)('decodes $file at its size', async (icon) => {
    const rendered = await renderIcon(icon);
    await expectSize(icon, rendered.bytes);
  });

  it('keeps the favicon corner transparent and the apple tile square', async () => {
    const favicon = ICONS.find((icon) => icon.file === 'favicon.png');
    const apple = ICONS.find((icon) => icon.file === 'apple-touch-icon.png');
    expect(favicon?.format).toBe('png');
    expect(apple?.format).toBe('png');
    if (favicon?.format !== 'png' || apple?.format !== 'png') return;
    expect((await corner((await renderIcon(favicon)).bytes))[3]).toBe(0);
    expect(await corner((await renderIcon(apple)).bytes)).toEqual([0x0b, 0x0d, 0x12, 255]);
  });

  it('matches the committed files', async () => {
    for (const icon of ICONS) {
      const rendered = await renderIcon(icon);
      const committed = new Uint8Array(readFileSync(`${PUBLIC_DIR}${icon.file}`));
      if (icon.format === 'svg') {
        expect(Buffer.from(rendered.bytes).toString('utf8')).toBe(Buffer.from(committed).toString('utf8'));
      }
      if (icon.format === 'ico') {
        const fresh = icoFrames(rendered.bytes);
        const stored = icoFrames(committed);
        expect(fresh.map((frame) => frame.px)).toEqual([16, 32, 48]);
        expect(stored.map((frame) => frame.px)).toEqual([16, 32, 48]);
        for (let index = 0; index < fresh.length; index += 1) {
          expect(await raw(fresh[index].png)).toEqual(await raw(stored[index].png));
        }
        continue;
      }
      expect(await raw(rendered.bytes)).toEqual(await raw(committed));
    }
  });
});

async function expectSize(icon: Icon, bytes: Uint8Array): Promise<void> {
  if (icon.format === 'svg') {
    const meta = await sharp(bytes).metadata();
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
    return;
  }
  if (icon.format === 'png') {
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(icon.px);
    expect(meta.height).toBe(icon.px);
    return;
  }
  const frames = icoFrames(bytes);
  expect(frames.map((frame) => frame.px)).toEqual([16, 32, 48]);
  for (const frame of frames) {
    const meta = await sharp(frame.png).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(frame.px);
    expect(meta.height).toBe(frame.px);
  }
}
