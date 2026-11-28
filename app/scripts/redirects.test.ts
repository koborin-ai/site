import { describe, expect, it } from 'vitest';
import { parseRedirects, readRedirects } from './redirects.ts';

describe('parseRedirects', () => {
  it('parses rules and ignores comments and blank lines', () => {
    expect(
      parseRedirects(`
# Comment
/tech /blog/ 301
/tech/foo/ /blog/foo/ 301
/temp /target
`),
    ).toEqual([
      { from: '/tech', to: '/blog/', status: 301 },
      { from: '/tech/foo/', to: '/blog/foo/', status: 301 },
      { from: '/temp', to: '/target', status: 302 },
    ]);
  });

  it('rejects malformed lines and non-redirect status codes', () => {
    expect(() => parseRedirects('/only-source')).toThrow('invalid rule');
    expect(() => parseRedirects('/a /b 200')).toThrow('invalid status');
  });
});

describe('public/_redirects', () => {
  it('uses 301 for every rule and has no duplicate sources', async () => {
    const rules = await readRedirects();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((rule) => rule.status === 301)).toBe(true);
    expect(new Set(rules.map((rule) => rule.from)).size).toBe(rules.length);
  });
});
