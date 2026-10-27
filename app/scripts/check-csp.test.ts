import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inlineScriptBodies, policyHashes, scriptHash } from './check-csp.ts';

describe('inline script hashes', () => {
  it('hashes executable inline scripts and skips external or data scripts', () => {
    const html = [
      '<script type="module" src="/_astro/app.js"></script>',
      '<script>window.ready = true;</script>',
      '<script type="application/ld+json">{"@type":"WebSite"}</script>',
      '<script type="module">const n = 1;</script>',
    ].join('');

    const bodies = inlineScriptBodies(html);
    expect(bodies).toEqual(['window.ready = true;', 'const n = 1;']);
    expect(scriptHash(bodies[0] ?? '')).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('reads sha256 tokens from the policy line', () => {
    const headers = [
      '/*',
      "  Content-Security-Policy: script-src 'sha256-abc=' 'sha256-def=='",
    ].join('\n');
    expect(policyHashes(headers)).toEqual(['abc=', 'def==']);
  });

  it('ships the security headers on every response', async () => {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', '_headers');
    const headers = await readFile(file, 'utf8');
    expect(headers).toContain('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    expect(headers).not.toContain('preload');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin');
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain('Cache-Control: public, max-age=31536000, immutable');
    expect(headers).toContain("style-src 'self' 'unsafe-inline' https://giscus.app");
  });
});
