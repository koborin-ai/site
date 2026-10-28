import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MissingOgFile, renderStaticOg } from './optimize-og-images.ts';

const publicOg = fileURLToPath(new URL('../public/og/', import.meta.url));
const sources = ['index.png', 'koborin-ai-hero.png'] as const;

let ogDir: string;

beforeEach(async () => {
  ogDir = await mkdtemp(path.join(tmpdir(), 'static-og-'));
  for (const source of sources) await copyFile(path.join(publicOg, source), path.join(ogDir, source));
});

afterEach(async () => {
  await rm(ogDir, { recursive: true, force: true });
});

async function webpOnDisk(file: string) {
  const { format, width, height } = await sharp(path.join(ogDir, file)).metadata();
  return { format, width, height };
}

describe('renderStaticOg', () => {
  it('writes both static images as 1200 wide webp and keeps the hero aspect ratio', async () => {
    const written = await renderStaticOg(ogDir);

    expect(written.map((og) => [og.file, og.width])).toEqual([
      ['index.webp', 1200],
      ['koborin-ai-hero.webp', 1200],
    ]);
    expect(written.every((og) => og.bytes > 0)).toBe(true);
    expect(await webpOnDisk('index.webp')).toEqual({ format: 'webp', width: 1200, height: 630 });
    expect(await webpOnDisk('koborin-ai-hero.webp')).toEqual({ format: 'webp', width: 1200, height: 670 });
  });

  it('replaces earlier output and leaves no partial file for Astro to copy', async () => {
    await renderStaticOg(ogDir);
    await writeFile(path.join(ogDir, 'index.webp'), 'stale');
    await writeFile(path.join(ogDir, 'koborin-ai-hero.webp'), 'stale');
    await writeFile(path.join(ogDir, 'index.webp.partial'), 'crashed run');

    await renderStaticOg(ogDir);

    expect((await webpOnDisk('index.webp')).width).toBe(1200);
    expect((await webpOnDisk('koborin-ai-hero.webp')).width).toBe(1200);
    expect((await readdir(ogDir)).toSorted()).toEqual([
      'index.png',
      'index.webp',
      'koborin-ai-hero.png',
      'koborin-ai-hero.webp',
    ]);
  });

  it('throws MissingOgFile for a missing hero source', async () => {
    await rm(path.join(ogDir, 'koborin-ai-hero.png'));

    const error = await renderStaticOg(ogDir).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MissingOgFile);
    expect(error).toMatchObject({ role: 'input', file: 'koborin-ai-hero.png' });
  });

  it('throws on an index source of the wrong width before any webp exists', async () => {
    await sharp({ create: { width: 800, height: 420, channels: 3, background: '#000000' } })
      .png()
      .toFile(path.join(ogDir, 'index.png'));

    const error = await renderStaticOg(ogDir).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MissingOgFile);
    expect(error).toMatchObject({ role: 'input', file: 'index.png' });
    expect((await readdir(ogDir)).filter((file) => file.includes('.webp'))).toEqual([]);
  });
});
