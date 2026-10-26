import { describe, expect, it } from 'vitest';
import { diffRoutes } from './check-routes.mjs';

describe('diffRoutes', () => {
  it('allows pagefind to disappear and generated og webp to appear', () => {
    const result = diffRoutes(
      ['/', '/pagefind/pagefind.js', '/og/index.png'],
      ['/', '/og/index.png', '/og/index.webp'],
    );

    expect(result.missing).toEqual([]);
    expect(result.unexpected).toEqual([]);
    expect(result.droppedSearch).toEqual(['/pagefind/pagefind.js']);
    expect(result.generated).toEqual(['/og/index.webp']);
  });

  it('fails when a page disappears or an unknown url appears', () => {
    const result = diffRoutes(['/tech/foo/'], ['/life/new/']);

    expect(result.missing).toEqual(['/tech/foo/']);
    expect(result.unexpected).toEqual(['/life/new/']);
  });

  it('allows the article and talk list pages', () => {
    const result = diffRoutes(
      ['/'],
      ['/', '/blog/', '/ja/blog/', '/talks/', '/ja/talks/', '/secret/'],
    );

    expect(result.unexpected).toEqual(['/secret/']);
    expect(result.missing).toEqual([]);
  });
});
