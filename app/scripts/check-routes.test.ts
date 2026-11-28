import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { diffRoutes } from './check-routes.ts';

describe('diffRoutes', () => {
  it('allows pagefind to disappear and generated og webp to appear', () => {
    const result = diffRoutes(
      ['/', '/pagefind/pagefind.js', '/blog/foo/'],
      ['/', '/blog/foo/', '/og/blog/foo.webp'],
    );

    expect(result.missing).toEqual([]);
    expect(result.unexpected).toEqual([]);
    expect(result.droppedSearch).toEqual(['/pagefind/pagefind.js']);
    expect(result.generated).toEqual(['/og/blog/foo.webp']);
  });

  it('fails when a page disappears or an unknown url appears', () => {
    const result = diffRoutes(['/blog/foo/'], ['/blog/new/']);

    expect(result.missing).toEqual(['/blog/foo/']);
    expect(result.unexpected).toEqual(['/blog/new/']);
  });

  it('allows the list pages and the about pages', () => {
    const result = diffRoutes(
      ['/'],
      ['/', '/blog/', '/ja/blog/', '/talks/', '/ja/talks/', '/about/', '/ja/about/', '/secret/'],
    );

    expect(result.unexpected).toEqual(['/secret/']);
    expect(result.missing).toEqual([]);
  });
});

describe('check-routes cli', () => {
  it('does not exit 0 without printing the report', () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-routes.ts', import.meta.url))], {
      encoding: 'utf8',
    });
    expect(result.status === 0 && result.stdout === '').toBe(false);
  });
});
