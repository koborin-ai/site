import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listRoutes, toUrl } from './list-routes.ts';

describe('toUrl', () => {
  it('maps dist files to public urls and drops hashed assets', () => {
    expect(toUrl('index.html')).toBe('/');
    expect(toUrl('ja/blog/index.html')).toBe('/ja/blog/');
    expect(toUrl('404.html')).toBe('/404.html');
    expect(toUrl('_headers')).toBe('/_headers');
    expect(toUrl('og/index.webp')).toBe('/og/index.webp');
    expect(toUrl('_astro/page.abc123.js')).toBeNull();
  });
});

describe('listRoutes', () => {
  it('sorts urls and does not walk a symlinked directory', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'list-routes-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'list-routes-outside-'));
    await mkdir(path.join(root, 'a'), { recursive: true });
    await mkdir(path.join(root, '_astro'), { recursive: true });
    await mkdir(path.join(root, 'og'), { recursive: true });
    await writeFile(path.join(root, 'index.html'), '');
    await writeFile(path.join(root, '_headers'), '');
    await writeFile(path.join(root, '404.html'), '');
    await writeFile(path.join(root, 'b.html'), '');
    await writeFile(path.join(root, 'a', 'index.html'), '');
    await writeFile(path.join(root, 'og', 'index.webp'), '');
    await writeFile(path.join(root, '_astro', 'page.js'), '');
    await writeFile(path.join(outside, 'secret.html'), '');
    await symlink(outside, path.join(root, 'link'));

    await expect(listRoutes(root)).resolves.toEqual([
      '/',
      '/404.html',
      '/_headers',
      '/a/',
      '/b.html',
      '/link',
      '/og/index.webp',
    ]);
  });

  it('prints the urls when node runs the file', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'list-routes-cli-'));
    await mkdir(path.join(root, 'ja'));
    await writeFile(path.join(root, 'index.html'), '');
    await writeFile(path.join(root, 'ja', 'index.html'), '');

    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./list-routes.ts', import.meta.url)), root], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('/\n/ja/\n');
  });
});
