import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ICONS, renderIcon } from './icons';
import { headerMark, ogMark, tileSvg } from './mark';

const INK = { x: 6, y: 8, width: 20.5, height: 20 } as const;
const UNIT = 10;
const BACKGROUND = { r: 0x0b, g: 0x0d, b: 0x12, a: 255 };

function countTags(markup: string, tag: string): number {
  return markup.match(new RegExp(`<${tag}\\b`, 'g'))?.length ?? 0;
}

async function raster(svg: string): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function crop(data: Buffer, width: number, x: number, y: number, cropWidth: number, cropHeight: number): Buffer {
  const out = Buffer.alloc(cropWidth * cropHeight * 4);
  for (let row = 0; row < cropHeight; row += 1) {
    const start = ((y + row) * width + x) * 4;
    data.copy(out, row * cropWidth * 4, start, start + cropWidth * 4);
  }
  return out;
}

function onBackground(mark: Buffer): Buffer {
  const out = Buffer.alloc(mark.length);
  for (let index = 0; index < mark.length; index += 4) {
    const alpha = mark[index + 3] / 255;
    out[index] = Math.round(mark[index] * alpha + BACKGROUND.r * (1 - alpha));
    out[index + 1] = Math.round(mark[index + 1] * alpha + BACKGROUND.g * (1 - alpha));
    out[index + 2] = Math.round(mark[index + 2] * alpha + BACKGROUND.b * (1 - alpha));
    out[index + 3] = 255;
  }
  return out;
}

function maxChannelDelta(left: Buffer, right: Buffer): number {
  let max = 0;
  for (let index = 0; index < left.length; index += 1) {
    max = Math.max(max, Math.abs(left[index] - right[index]));
  }
  return max;
}

function filesUnder(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = `${root}/${entry.name}`;
    if (entry.isDirectory()) files.push(...filesUnder(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

async function isRenderedIcon(rel: string, bytes: Buffer): Promise<boolean> {
  const file = rel.startsWith('public/') ? rel.slice('public/'.length) : '';
  const icon = ICONS.find((row) => row.file === file);
  if (!icon) return false;
  const rendered = await renderIcon(icon);
  return Buffer.from(rendered.bytes).equals(bytes);
}

describe('mark', () => {
  it('draws one arch and two rects', () => {
    for (const frame of [headerMark(), ogMark(26), ogMark(80)]) {
      expect(countTags(frame.markup, 'path')).toBe(1);
      expect(countTags(frame.markup, 'rect')).toBe(2);
      expect(frame.markup).toContain(`viewBox="${INK.x} ${INK.y} ${INK.width} ${INK.height}"`);
      expect(frame.markup).toContain('aria-hidden="true"');
      expect(frame.markup).toContain(`width="${frame.width}"`);
      expect(frame.markup).toContain(`height="${frame.height}"`);
    }
    expect(headerMark()).toMatchObject({ width: 18.45, height: 18 });
    expect(headerMark().markup).toContain('stroke="currentColor"');
    expect(ogMark(26)).toMatchObject({ width: 26.65, height: 26 });
    expect(ogMark(80)).toMatchObject({ width: 82, height: 80 });
    expect(ogMark(26).markup).toContain('stroke="#d5dae1"');
  });

  it('matches the header mark to the cropped tile', async () => {
    const tile = await raster(tileSvg(32 * UNIT, 'square'));
    expect(tile.width).toBe(32 * UNIT);
    expect(tile.height).toBe(32 * UNIT);

    const cropX = INK.x * UNIT;
    const cropY = INK.y * UNIT;
    const cropWidth = INK.width * UNIT;
    const cropHeight = INK.height * UNIT;
    const tileCrop = crop(tile.data, tile.width, cropX, cropY, cropWidth, cropHeight);

    const painted = headerMark().markup.replaceAll('currentColor', '#d5dae1').replace(
      /^<svg\b([^>]*)>/,
      (_match, attrs: string) => {
        const sized = attrs
          .replace(/\swidth="[^"]*"/, ` width="${cropWidth}"`)
          .replace(/\sheight="[^"]*"/, ` height="${cropHeight}"`);
        return `<svg${sized}>`;
      },
    );
    const mark = await raster(painted);
    expect(mark.width).toBe(cropWidth);
    expect(mark.height).toBe(cropHeight);
    expect(maxChannelDelta(tileCrop, onBackground(mark.data))).toBeLessThanOrEqual(1);
  });

  it('keeps the arch geometry in mark.ts', async () => {
    const needle = ['A5', '5', '0', '0', '1', '18', '15'].join(' ');
    const srcDir = fileURLToPath(new URL('..', import.meta.url));
    const publicDir = fileURLToPath(new URL('../../public', import.meta.url));
    const files = [
      ...filesUnder(srcDir).map((abs) => ({ rel: `src/${abs.slice(srcDir.length + 1)}`, abs })),
      ...filesUnder(publicDir).map((abs) => ({ rel: `public/${abs.slice(publicDir.length + 1)}`, abs })),
    ];
    const hits: string[] = [];
    for (const { rel, abs } of files) {
      if (rel === 'src/lib/mark.ts') continue;
      const bytes = readFileSync(abs);
      if (!bytes.includes(Buffer.from(needle))) continue;
      if (await isRenderedIcon(rel, bytes)) continue;
      hits.push(rel);
    }
    expect(hits).toEqual([]);
  });

  it('ships no image in public/ except the rendered icons', async () => {
    const publicDir = fileURLToPath(new URL('../../public', import.meta.url));
    const images = filesUnder(publicDir)
      .map((abs) => ({ rel: `public/${abs.slice(publicDir.length + 1)}`, abs }))
      .filter(({ rel }) => /\.(png|jpe?g|webp|gif|svg|ico|avif)$/i.test(rel));
    const strays: string[] = [];
    for (const { rel, abs } of images) {
      if (!(await isRenderedIcon(rel, readFileSync(abs)))) strays.push(rel);
    }
    expect(strays).toEqual([]);
    expect(images.map(({ rel }) => rel).toSorted()).toEqual(ICONS.map((icon) => `public/${icon.file}`).toSorted());
  });

  it('uses the dark accent for the tile ink', () => {
    const css = readFileSync(fileURLToPath(new URL('../styles/site.css', import.meta.url)), 'utf8');
    const root = css.slice(0, css.indexOf('html[data-theme'));
    const accent = root.match(/--site-accent:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(accent).toBe('#d5dae1');
  });
});
