import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { readBaseline } from './check-routes.ts';
import { probesFor, productionOrigin, smoke } from './smoke-prod.ts';
import type { Probe, SmokeRun } from './smoke-prod.ts';

function page(path: string): Probe {
  return { path, expect: { kind: 'page' } };
}

function redirect(path: string, to: string): Probe {
  return { path, expect: { kind: 'redirect', to } };
}

function fakeRun(reply: (url: URL, attempt: number) => Response | Error) {
  const fetched: { url: URL; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  const lines: string[] = [];
  const run: SmokeRun = {
    origin: productionOrigin,
    fetch: async (url, init) => {
      fetched.push({ url, init });
      const result = reply(url, fetched.filter((entry) => entry.url.href === url.href).length);
      if (result instanceof Error) throw result;
      return result;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    log: (line) => {
      lines.push(line);
    },
  };
  return { run, fetched, sleeps, lines };
}

const securityHeaders = {
  'content-security-policy': "default-src 'self'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

function htmlPage(headers: Record<string, string> = securityHeaders): Response {
  return new Response('<!doctype html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

function moved(location: string, status = 307): Response {
  return new Response(null, { status, headers: { location } });
}

async function problemsFor(probe: Probe, response: () => Response): Promise<readonly string[]> {
  const { run } = fakeRun(response);
  const failures = await smoke([probe], run);
  return failures[0]?.problems ?? [];
}

describe('probesFor', () => {
  it('derives page and redirect probes from the route baseline', async () => {
    const probes = probesFor(await readBaseline());

    expect(probes).toContainEqual(page('/'));
    expect(probes).toContainEqual(page('/favicon.png'));
    expect(probes).toContainEqual(redirect('/404.html', '/404'));
    expect(probes).toContainEqual(page('/tech/mcp-deep-dive/'));
    expect(probes).toContainEqual(redirect('/tech/mcp-deep-dive', '/tech/mcp-deep-dive/'));
    expect(probes).toContainEqual(redirect('/ja/life/everything-has-meaning', '/ja/life/everything-has-meaning/'));
    expect(probes.filter((probe) => probe.path === '/_headers')).toEqual([]);
    expect(probes.filter((probe) => probe.path.startsWith('/pagefind/'))).toEqual([]);
    expect(probes.filter((probe) => ['/ja', '/privacy-policy', ''].includes(probe.path))).toEqual([]);
  });

  it('keeps baseline order and adds the slash redirect only under the article prefixes', () => {
    expect(probesFor(['/_redirects', '/blog/', '/life/x/', '/ja/tech/y/', '/rss.xml'])).toEqual([
      page('/blog/'),
      page('/life/x/'),
      redirect('/life/x', '/life/x/'),
      page('/ja/tech/y/'),
      redirect('/ja/tech/y', '/ja/tech/y/'),
      page('/rss.xml'),
    ]);
  });
});

describe('smoke judging', () => {
  it('passes an HTML page with both security headers, fetched without following redirects', async () => {
    const { run, fetched } = fakeRun(() => htmlPage());

    expect(await smoke([page('/tech/x/')], run)).toEqual([]);
    expect(fetched[0]?.url.href).toBe('https://koborin.ai/tech/x/');
    expect(fetched[0]?.init.redirect).toBe('manual');
    expect(fetched[0]?.init.method ?? 'GET').toBe('GET');
  });

  it('fails an HTML page without a content security policy', async () => {
    const problems = await problemsFor(page('/'), () =>
      htmlPage({ 'strict-transport-security': securityHeaders['strict-transport-security'] }),
    );
    expect(problems).toEqual(['missing content-security-policy']);
  });

  it('fails an HTML page whose HSTS header is blank', async () => {
    const problems = await problemsFor(page('/'), () =>
      htmlPage({ ...securityHeaders, 'strict-transport-security': '  ' }),
    );
    expect(problems).toEqual(['missing strict-transport-security']);
  });

  it.each([
    ['text/plain', { 'content-type': 'text/plain; charset=utf-8' }],
    ['no content type', {}],
  ])('does not require security headers on %s', async (_label, headers) => {
    const problems = await problemsFor(page('/llms.txt'), () => new Response(null, { status: 200, headers }));
    expect(problems).toEqual([]);
  });

  it('fails a page that is not 200', async () => {
    const problems = await problemsFor(page('/tech/gone/'), () => new Response(null, { status: 404 }));
    expect(problems).toEqual(['expected 200, got 404']);
  });

  it.each([
    ['a path', '/tech/x/', 307],
    ['an absolute URL on the production origin', 'https://koborin.ai/tech/x/', 307],
    ['a permanent redirect', '/tech/x/', 308],
  ])('passes a redirect whose Location is %s', async (_label, location, status) => {
    expect(await problemsFor(redirect('/tech/x', '/tech/x/'), () => moved(location, status))).toEqual([]);
  });

  it.each([
    ['https://example.com/tech/x/', 'expected Location /tech/x/, got https://example.com/tech/x/'],
    ['http://koborin.ai/tech/x/', 'expected Location /tech/x/, got http://koborin.ai/tech/x/'],
    ['/tech/y/', 'expected Location /tech/x/, got /tech/y/'],
  ])('fails a redirect to %s', async (location, problem) => {
    expect(await problemsFor(redirect('/tech/x', '/tech/x/'), () => moved(location))).toEqual([problem]);
  });

  it('fails a redirect probe that answers 200 or omits Location', async () => {
    expect(await problemsFor(redirect('/404.html', '/404'), () => htmlPage())).toEqual(['expected 3xx to /404, got 200']);
    expect(await problemsFor(redirect('/404.html', '/404'), () => new Response(null, { status: 307 }))).toEqual([
      'expected Location /404, got none',
    ]);
  });
});

describe('smoke module graph', () => {
  it('imports only Node built-ins, because smoke-prod.yml runs it without npm ci', async () => {
    const pending = [new URL('./smoke-prod.ts', import.meta.url)];
    const seen = new Set<string>();
    const bare: string[] = [];
    while (pending.length > 0) {
      const file = pending.pop();
      if (!file || seen.has(file.pathname)) continue;
      seen.add(file.pathname);
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1];
        if (!specifier) continue;
        if (specifier.startsWith('node:')) continue;
        if (specifier.startsWith('.')) {
          pending.push(new URL(specifier, file));
          continue;
        }
        bare.push(specifier);
      }
    }
    expect(bare).toEqual([]);
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('smoke retries', () => {
  it('re-probes only what failed and stops once everything passes', async () => {
    const { run, fetched, sleeps, lines } = fakeRun((url, attempt) =>
      url.pathname === '/flaky/' && attempt === 1 ? new Response(null, { status: 503 }) : htmlPage(),
    );

    expect(await smoke([page('/flaky/'), page('/steady/')], run)).toEqual([]);
    expect(sleeps).toEqual([0, 15_000]);
    expect(fetched.map((entry) => entry.url.pathname)).toEqual(['/flaky/', '/steady/', '/flaky/']);
    expect(lines.at(-1)).toBe('attempt 2/5 2 passed 0 failing');
  });

  it('gives up after five attempts and 120 seconds of waits, reporting the last problems', async () => {
    const { run, fetched, sleeps } = fakeRun(() => new Response(null, { status: 503 }));

    const failures = await smoke([page('/down/')], run);

    expect(fetched).toHaveLength(5);
    expect(sleeps).toEqual([0, 15_000, 30_000, 30_000, 45_000]);
    expect(sleeps.reduce((total, ms) => total + ms, 0)).toBe(120_000);
    expect(failures).toEqual([{ probe: page('/down/'), problems: ['expected 200, got 503'] }]);
  });

  it('retries a fetch that throws and reports it as unreachable', async () => {
    const { run, fetched } = fakeRun((_url, attempt) =>
      attempt < 3 ? new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') }) : htmlPage(),
    );
    expect(await smoke([page('/')], run)).toEqual([]);
    expect(fetched).toHaveLength(3);

    const { run: down } = fakeRun(() => new TypeError('fetch failed', { cause: new Error('ECONNRESET') }));
    expect(await smoke([page('/')], down)).toEqual([
      { probe: page('/'), problems: ['unreachable: fetch failed: ECONNRESET'] },
    ]);
  });
});
