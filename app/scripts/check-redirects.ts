import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { readBaseline } from './check-routes.ts';
import { readRedirects, type RedirectRule } from './redirects.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(scriptDir, '..');
const distDir = path.join(appDir, 'dist');

const legacyRefPatterns: readonly { readonly label: string; readonly regex: RegExp }[] = [
  {
    label: 'absolute koborin.ai legacy URL',
    regex: /https?:\/\/koborin\.ai\/(?:og\/)?(?:ja\/)?(?:tech|life)\/[^\s"'<>)]*/g,
  },
  {
    label: 'HTML attribute legacy path',
    regex: /\b(?:href|src|content)=["']\/(?:og\/)?(?:ja\/)?(?:tech|life)\/[^"']*["']/g,
  },
  {
    label: 'Markdown legacy link',
    regex: /\]\(\/(?:og\/)?(?:ja\/)?(?:tech|life)\/[^)]*\)/g,
  },
];

const scannableExtensions = new Set(['.html', '.xml', '.txt']);

export function findLegacyRefsInText(relativePath: string, content: string): string[] {
  const hits: string[] = [];
  for (const { label, regex } of legacyRefPatterns) {
    regex.lastIndex = 0;
    for (const match of content.matchAll(regex)) {
      hits.push(`${relativePath}: ${label}: ${match[0]}`);
    }
  }
  return hits;
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walkFiles(full) : [full];
    }),
  );
  return nested.flat();
}

export async function scanDistForLegacyRefs(rootDir: string = distDir): Promise<string[]> {
  const files = await walkFiles(rootDir);
  const hits: string[] = [];
  for (const file of files) {
    const relative = path.relative(rootDir, file).split(path.sep).join('/');
    if (relative === '_redirects' || relative.startsWith('_astro/')) continue;
    if (!scannableExtensions.has(path.extname(file))) continue;
    const content = await readFile(file, 'utf8');
    hits.push(...findLegacyRefsInText(relative, content));
  }
  return hits;
}

export function checkArticleMetadata(route: string, html: string): string[] {
  const problems: string[] = [];
  const expectedCanonical = `https://koborin.ai${route}`;
  const slug = route.replace(/^\/(?:ja\/)?blog\//, '').replace(/\/$/, '');
  const expectedOgImage = route.startsWith('/ja/')
    ? `https://koborin.ai/og/ja/blog/${slug}.webp`
    : `https://koborin.ai/og/blog/${slug}.webp`;

  if (!html.includes(`<link rel="canonical" href="${expectedCanonical}">`)) {
    problems.push(`missing canonical ${expectedCanonical}`);
  }
  if (!html.includes(`<meta property="og:url" content="${expectedCanonical}">`)) {
    problems.push(`missing og:url ${expectedCanonical}`);
  }
  if (!html.includes(`<meta property="og:image" content="${expectedOgImage}">`)) {
    problems.push(`missing og:image ${expectedOgImage}`);
  }
  if (!html.includes(`<link rel="alternate" hreflang="en" href="https://koborin.ai/blog/${slug}/">`)) {
    problems.push(`missing en hreflang /blog/${slug}/`);
  }
  if (!html.includes(`<link rel="alternate" hreflang="ja" href="https://koborin.ai/ja/blog/${slug}/">`)) {
    problems.push(`missing ja hreflang /ja/blog/${slug}/`);
  }
  return problems;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Could not allocate ephemeral port')));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function startWrangler(): Promise<{ readonly origin: string; close(): Promise<void> }> {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const wranglerBin = path.join(appDir, 'node_modules', '.bin', 'wrangler');
  const child = spawn(
    wranglerBin,
    ['dev', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0', '--show-interactive-dev-session=false'],
    {
      cwd: appDir,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    },
  );

  let logs = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    logs += chunk.toString('utf8');
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    logs += chunk.toString('utf8');
  });

  const close = async (): Promise<void> => {
    if (child.pid !== undefined && child.exitCode === null) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // Process group may have already exited.
      }
      await Promise.race([
        new Promise<void>((resolve) => child.once('exit', () => resolve())),
        sleep(3_000),
      ]);
      if (child.exitCode === null) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          // Process group may have already exited.
        }
      }
    }
  };

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler dev exited early (${child.exitCode}):\n${logs}`);
    }
    try {
      const response = await fetch(`${origin}/`, { redirect: 'manual' });
      await response.body?.cancel();
      if (response.status === 200) return { origin, close };
    } catch {
      // Server not ready yet.
    }
    await sleep(250);
  }

  await close();
  throw new Error(`wrangler dev timed out waiting for ${origin}/:\n${logs}`);
}

async function verifyRedirectsAndRoutes(
  origin: string,
  rules: readonly RedirectRule[],
  blogRoutes: readonly string[],
): Promise<string[]> {
  const failures: string[] = [];

  for (const rule of rules) {
    const response = await fetch(new URL(rule.from, origin), { redirect: 'manual' });
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (response.status !== rule.status || location !== rule.to) {
      failures.push(
        `redirect ${rule.from}: expected ${rule.status} -> ${rule.to}, got ${response.status} -> ${location ?? 'none'}`,
      );
    }
  }

  const destinationSet = new Set([...blogRoutes, ...rules.map((rule) => rule.to)]);
  for (const route of [...destinationSet].toSorted()) {
    const response = await fetch(new URL(route, origin), { redirect: 'manual' });
    const contentType = response.headers.get('content-type') ?? '';
    const html = await response.text();
    if (response.status !== 200) {
      failures.push(`page ${route}: expected 200, got ${response.status}`);
      continue;
    }
    if (!contentType.toLowerCase().includes('text/html')) {
      failures.push(`page ${route}: expected text/html, got ${contentType}`);
    }
    if (route !== '/blog/' && route !== '/ja/blog/' && /^\/(?:ja\/)?blog\/[^/]+\/$/.test(route)) {
      for (const problem of checkArticleMetadata(route, html)) {
        failures.push(`metadata ${route}: ${problem}`);
      }
      const slug = route.replace(/^\/(?:ja\/)?blog\//, '').replace(/\/$/, '');
      const ogPath = route.startsWith('/ja/') ? `/og/ja/blog/${slug}.webp` : `/og/blog/${slug}.webp`;
      const ogResponse = await fetch(new URL(ogPath, origin), { redirect: 'manual' });
      await ogResponse.body?.cancel();
      if (ogResponse.status !== 200) {
        failures.push(`og ${ogPath}: expected 200, got ${ogResponse.status}`);
      }
    }
  }

  const unknownLegacyPaths = [
    '/tech/does-not-exist/',
    '/life/does-not-exist/',
    '/ja/tech/does-not-exist/',
    '/ja/life/does-not-exist/',
  ];
  for (const missing of unknownLegacyPaths) {
    const response = await fetch(new URL(missing, origin), { redirect: 'manual' });
    await response.body?.cancel();
    if (response.status !== 404) {
      failures.push(`unknown ${missing}: expected 404, got ${response.status}`);
    }
  }

  return failures;
}

async function main(): Promise<void> {
  const [rules, baseline, legacyHits] = await Promise.all([
    readRedirects(),
    readBaseline(),
    scanDistForLegacyRefs(distDir),
  ]);
  const blogRoutes = baseline.filter((route) => route.startsWith('/blog/') || route.startsWith('/ja/blog/'));
  const failures: string[] = [...legacyHits];

  const server = await startWrangler();
  try {
    failures.push(...(await verifyRedirectsAndRoutes(server.origin, rules, blogRoutes)));
  } finally {
    await server.close();
  }

  process.stdout.write(
    [
      `redirects verified ${rules.length}`,
      `blog routes verified ${blogRoutes.length}`,
      `legacy references in dist ${legacyHits.length}`,
      `failures ${failures.length}`,
    ].join('\n') + '\n',
  );

  if (failures.length > 0) {
    process.stderr.write(`${failures.join('\n')}\n`);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
