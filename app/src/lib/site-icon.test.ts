import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fetchSiteIcon, pickIconUrl, siteHostname } from './site-icon';

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

describe('site icons', () => {
  it('strips a leading www from the hostname', () => {
    expect(siteHostname('https://www.pulumi.com/docs/')).toBe('pulumi.com');
  });

  it('picks a small icon link and ignores javascript and mask icons', () => {
    const html = `
      <link rel="mask-icon" href="/mask.svg">
      <link rel="icon" href="javascript:alert(1)">
      <link rel="icon" href="/favicon-192.png" sizes="192x192">
      <link rel="icon" href="/favicon-32.png" sizes="32x32">
    `;
    expect(pickIconUrl(html, 'https://example.com/a')).toBe('https://example.com/favicon-32.png');
  });

  it('returns a data url for the icon named in the page', async () => {
    const fetchImpl = (async (url: string) => {
      if (String(url).endsWith('.png')) {
        return new Response(png, { headers: { 'content-type': 'image/png' } });
      }
      return new Response('<link rel="icon" href="/favicon-32.png" sizes="32x32">', {
        headers: { 'content-type': 'text/html' },
      });
    }) as typeof fetch;
    const icon = await fetchSiteIcon('https://example.com/docs', fetchImpl);
    expect(icon).toBe(`data:image/png;base64,${Buffer.from(png).toString('base64')}`);
  });

  it('returns null when the page and favicon.ico are not images', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 404 })) as typeof fetch;
    expect(await fetchSiteIcon('https://missing.example/', fetchImpl)).toBeNull();
  });

  it('drops an svg that contains a script', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const fetchImpl = (async (url: string) => {
      if (String(url).endsWith('.svg')) return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
      if (String(url).endsWith('.ico')) return new Response('nope', { status: 404 });
      return new Response('<link rel="icon" href="/icon.svg">', { headers: { 'content-type': 'text/html' } });
    }) as typeof fetch;
    expect(await fetchSiteIcon('https://example.com/', fetchImpl)).toBeNull();
  });

  it('ships only data-url images keyed by hostname', () => {
    const icons = JSON.parse(readFileSync(new URL('../data/site-icons.json', import.meta.url), 'utf8')) as Record<string, string>;
    expect(icons['github.com']).toMatch(/^data:image\/[a-z0-9.+-]+;base64,/);
    for (const [host, value] of Object.entries(icons)) {
      expect(host).not.toMatch(/^www\./);
      expect(value).toMatch(/^data:image\/[a-z0-9.+-]+;base64,/);
    }
  });
});
