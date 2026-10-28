import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(scriptDir, '..', 'dist');
const headersPath = path.join(scriptDir, '..', 'public', '_headers');

const ID = 'G-CHECK0000';
const SITE = 'https://koborin.ai';
const LOCAL = 'http://localhost:4321';
const ARTICLE = '/tech/koborin-ai-architecture/';
const MEASUREMENT_META = /<meta name="ga-measurement-id"[^>]*>/g;
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

type Origin = typeof SITE | typeof LOCAL;

type Observed = {
  stored: string | null;
  banner: 'visible' | 'hidden';
  gtagScripts: number;
  gaDisabled: boolean | null;
  lastConsent: string | null;
  configs: number;
  cookies: string[];
};

const failures: string[] = [];
const pageErrors: string[] = [];

function expect(label: string, actual: unknown, expected: unknown): void {
  const ok = isDeepStrictEqual(actual, expected);
  const line = `${ok ? 'ok  ' : 'FAIL'} ${label} => ${JSON.stringify(actual)}`;
  if (ok) {
    process.stdout.write(`${line}\n`);
  } else {
    failures.push(label);
    process.stderr.write(`${line} (expected ${JSON.stringify(expected)})\n`);
  }
}

function contentSecurityPolicy(headers: string): string {
  const prefix = 'content-security-policy:';
  const line = headers
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.toLowerCase().startsWith(prefix));
  if (!line) throw new Error('public/_headers has no Content-Security-Policy');
  return line.slice(prefix.length).trim();
}

async function readDist(pathname: string): Promise<{ file: string; body: Buffer } | null> {
  const base = path.join(distDir, decodeURIComponent(pathname));
  const candidates = pathname.endsWith('/') ? [path.join(base, 'index.html')] : [base, `${base}.html`];
  for (const file of candidates) {
    const body = await readFile(file).catch(() => null);
    if (body) return { file, body };
  }
  return null;
}

// Every third-party request, gtag.js and giscus.app included, gets an empty script so the
// check never reaches the network.
async function serveDist(context: BrowserContext, origin: Origin, csp: string, measurementId: string | null) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
      return;
    }
    const found = await readDist(url.pathname);
    if (!found) {
      await route.fulfill({ status: 404, body: '' });
      return;
    }
    const ext = path.extname(found.file);
    let body = found.body;
    if (ext === '.html') {
      const meta = measurementId ? `<meta name="ga-measurement-id" content="${measurementId}">` : '';
      body = Buffer.from(found.body.toString('utf8').replace(MEASUREMENT_META, '').replace('<head>', `<head>${meta}`));
    }
    await route.fulfill({
      status: 200,
      body,
      headers: { 'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream', 'content-security-policy': csp },
    });
  });
}

async function open(browser: Browser, origin: Origin, csp: string, measurementId: string | null) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await serveDist(context, origin, csp, measurementId);
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(`${origin} pageerror ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`${origin} console ${message.text()}`);
  });
  return { context, page };
}

async function observe(page: Page, context: BrowserContext, origin: Origin): Promise<Observed> {
  const seen = await page.evaluate((id) => {
    const gtagWindow = window as unknown as { dataLayer?: ArrayLike<unknown>[] } & Record<string, unknown>;
    const commands = (gtagWindow.dataLayer ?? []).map((entry) => Array.from(entry));
    const consent = commands
      .filter((command) => command[0] === 'consent')
      .map((command) => (command[2] as { analytics_storage?: string }).analytics_storage ?? null);
    const banner = document.getElementById('cookie-consent-banner');
    const disabled = gtagWindow[`ga-disable-${id}`];
    return {
      stored: localStorage.getItem('cookie_consent'),
      banner: banner && !banner.hidden ? ('visible' as const) : ('hidden' as const),
      gtagScripts: document.querySelectorAll('script[src^="https://www.googletagmanager.com/gtag/js"]').length,
      gaDisabled: typeof disabled === 'boolean' ? disabled : null,
      lastConsent: consent.at(-1) ?? null,
      configs: commands.filter((command) => command[0] === 'config').length,
    };
  }, ID);
  const cookies = (await context.cookies(origin))
    .filter((cookie) => cookie.name === '_ga' || cookie.name.startsWith('_ga_'))
    .map((cookie) => `${cookie.name}@${cookie.domain}`)
    .toSorted();
  return { ...seen, cookies };
}

async function seedGaCookies(context: BrowserContext, origin: Origin): Promise<void> {
  const base = { value: 'GA1.1.123.456', expires: Math.floor(Date.now() / 1000) + 3600 };
  if (origin === SITE) {
    await context.addCookies([
      { ...base, name: '_ga_HOSTONLY', url: `${SITE}/` },
      { ...base, name: '_ga', domain: '.koborin.ai', path: '/' },
      { ...base, name: '_ga_CHECK0000', domain: '.koborin.ai', path: '/' },
    ]);
  } else {
    await context.addCookies([
      { ...base, name: '_ga_HOSTONLY', url: `${LOCAL}/` },
      { ...base, name: '_ga', url: `${LOCAL}/` },
    ]);
  }
}

const FIRST_VISIT: Observed = { stored: null, banner: 'visible', gtagScripts: 0, gaDisabled: null, lastConsent: null, configs: 0, cookies: [] };
const ACCEPTED: Observed = { stored: 'accepted', banner: 'hidden', gtagScripts: 1, gaDisabled: false, lastConsent: null, configs: 1, cookies: [] };
const HALTED: Observed = { stored: 'rejected', banner: 'hidden', gtagScripts: 1, gaDisabled: true, lastConsent: 'denied', configs: 1, cookies: [] };
const RESUMED: Observed = { stored: 'accepted', banner: 'hidden', gtagScripts: 1, gaDisabled: false, lastConsent: 'granted', configs: 2, cookies: [] };
const DECLINED: Observed = { stored: 'rejected', banner: 'hidden', gtagScripts: 0, gaDisabled: null, lastConsent: null, configs: 0, cookies: [] };
const ACCEPTED_WITHOUT_ID: Observed = { stored: 'accepted', banner: 'hidden', gtagScripts: 0, gaDisabled: null, lastConsent: null, configs: 0, cookies: [] };

async function checkReopenAndHalt(browser: Browser, csp: string): Promise<void> {
  const { context, page } = await open(browser, SITE, csp, ID);
  await page.goto(`${SITE}/`);
  expect('first visit', await observe(page, context, SITE), FIRST_VISIT);
  await page.click('#cookie-accept');
  expect('accept', await observe(page, context, SITE), ACCEPTED);
  await page.click('[data-cookie-settings]');
  expect('reopen shows banner', (await observe(page, context, SITE)).banner, 'visible');
  expect('reopen moves focus into banner', await page.evaluate(() => document.activeElement?.id), 'cookie-consent-banner');
  await page.click('#cookie-accept');
  expect('accept twice', await observe(page, context, SITE), ACCEPTED);
  expect(
    'focus returns to footer button',
    await page.evaluate(() => document.activeElement?.hasAttribute('data-cookie-settings')),
    true,
  );
  await seedGaCookies(context, SITE);
  await page.click('[data-cookie-settings]');
  await page.click('#cookie-reject');
  expect('decline after load', await observe(page, context, SITE), HALTED);
  await page.click('[data-cookie-settings]');
  await page.click('#cookie-reject');
  expect('decline twice', await observe(page, context, SITE), HALTED);
  await page.click('[data-cookie-settings]');
  await page.click('#cookie-accept');
  expect('accept after decline, same page', await observe(page, context, SITE), RESUMED);
  await page.reload();
  expect('reload after accept', await observe(page, context, SITE), ACCEPTED);
  await context.close();
}

async function checkInitialDecline(browser: Browser, csp: string): Promise<void> {
  const { context, page } = await open(browser, SITE, csp, ID);
  await seedGaCookies(context, SITE);
  await page.goto(`${SITE}/ja/`);
  await page.click('#cookie-reject');
  expect('initial decline (ja)', await observe(page, context, SITE), DECLINED);
  await seedGaCookies(context, SITE);
  await page.reload();
  expect('decline then reload purges', await observe(page, context, SITE), DECLINED);
  await page.getByRole('button', { name: 'Cookie 設定' }).focus();
  await page.keyboard.press('Enter');
  expect('keyboard Enter reopens (ja)', (await observe(page, context, SITE)).banner, 'visible');
  await page.click('#cookie-accept');
  expect('accept after decline loads GA', await observe(page, context, SITE), ACCEPTED);
  await context.close();
}

async function checkLocalhost(browser: Browser, csp: string): Promise<void> {
  const { context, page } = await open(browser, LOCAL, csp, ID);
  await seedGaCookies(context, LOCAL);
  await page.goto(`${LOCAL}/`);
  await page.click('#cookie-reject');
  expect('localhost decline', await observe(page, context, LOCAL), DECLINED);
  await context.close();
}

async function checkNoMeasurementId(browser: Browser, csp: string): Promise<void> {
  const { context, page } = await open(browser, SITE, csp, null);
  await page.goto(`${SITE}/`);
  await page.click('#cookie-accept');
  expect('no measurement id: accept keeps GA out', await observe(page, context, SITE), ACCEPTED_WITHOUT_ID);
  await context.close();
}

async function checkFooterLayout(browser: Browser, csp: string): Promise<void> {
  const { context, page } = await open(browser, SITE, csp, null);
  const views = [
    ['/', 320, 'Cookie settings'],
    ['/ja/', 320, 'Cookie 設定'],
    [ARTICLE, 1280, 'Cookie settings'],
    [`/ja${ARTICLE}`, 390, 'Cookie 設定'],
    ['/404', 320, 'Cookie settings'],
  ] as const;
  for (const [pathname, width, label] of views) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${SITE}${pathname}`);
    const row = await page.evaluate((viewport) => {
      const footer = document.querySelector('footer.site-footer');
      const button = footer?.querySelector('button[type="button"][data-cookie-settings]');
      if (!footer || !button) return null;
      const box = button.getBoundingClientRect();
      return {
        label: button.textContent?.trim(),
        font: getComputedStyle(button).fontFamily.split(',')[0],
        colorMatchesFooter: getComputedStyle(button).color === getComputedStyle(footer).color,
        inside: box.right <= viewport + 0.5 && box.left >= -0.5,
        overflow: footer.scrollWidth > footer.clientWidth,
        rows: new Set([...footer.children].map((child) => Math.round(child.getBoundingClientRect().top))).size,
        footerWidth: Math.round(footer.getBoundingClientRect().width),
      };
    }, width);
    const { footerWidth, ...shape } = row ?? { footerWidth: null };
    expect(`footer button at ${pathname} ${width}px`, shape, {
      label,
      font: '"Geist Mono"',
      colorMatchesFooter: true,
      inside: true,
      overflow: false,
      rows: 1,
    });
    if (pathname === ARTICLE) expect(`article footer width at ${width}px`, footerWidth, 740);
  }
  await context.close();
}

async function checkPolicyPages(browser: Browser, csp: string): Promise<void> {
  const { context, page } = await open(browser, SITE, csp, null);
  await page.goto(`${SITE}/`);
  await page.click('#cookie-accept');
  await page.selectOption('starlight-theme-select select', 'light');
  const keys = await page.evaluate(() => Object.keys(localStorage).toSorted());
  const pages = [
    ['/privacy-policy/', 'Cookie settings', 'Last updated: October 28, 2026'],
    ['/ja/privacy-policy/', 'Cookie 設定', '最終更新日: 2026年10月28日'],
  ] as const;
  for (const [pathname, label, date] of pages) {
    await page.goto(`${SITE}${pathname}`);
    const policy = await page.evaluate(() => ({
      body: document.querySelector('.sl-markdown-content')?.textContent ?? '',
      titleDates: document.querySelectorAll('.article-dates').length,
    }));
    expect(`${pathname} names every localStorage key ${JSON.stringify(keys)}`, keys.filter((key) => !policy.body.includes(key)), []);
    expect(`${pathname} quotes the footer label`, policy.body.includes(label), true);
    expect(`${pathname} shows one date (no title date line)`, policy.titleDates, 0);
    expect(
      `${pathname} body date`,
      policy.body.match(/Last updated: [A-Za-z]+ \d+, \d{4}|最終更新日: \d+年\d+月\d+日/g) ?? [],
      [date],
    );
  }
  await context.close();
}

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(full);
      return entry.name.endsWith('.html') ? [full] : [];
    }),
  );
  return files.flat();
}

async function checkEveryFooter(): Promise<void> {
  const files = await htmlFiles(distDir);
  const missing: string[] = [];
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (!html.includes('class="site-footer')) continue;
    const rel = path.relative(distDir, file);
    const label = rel.startsWith('ja/') ? 'Cookie 設定' : 'Cookie settings';
    if (!new RegExp(`<button type="button"[^>]*data-cookie-settings[^>]*>${label}</button>`).test(html)) missing.push(rel);
  }
  expect(`footer button on every footer page (${files.length} html files)`, missing, []);
}

async function main(): Promise<void> {
  const csp = contentSecurityPolicy(await readFile(headersPath, 'utf8'));
  const browser = await chromium.launch();
  try {
    await checkReopenAndHalt(browser, csp);
    await checkInitialDecline(browser, csp);
    await checkLocalhost(browser, csp);
    await checkNoMeasurementId(browser, csp);
    await checkFooterLayout(browser, csp);
    await checkPolicyPages(browser, csp);
  } finally {
    await browser.close();
  }
  await checkEveryFooter();
  expect('no page errors or CSP violations', pageErrors, []);
  if (failures.length > 0) process.exit(1);
}

if (import.meta.main) {
  await main();
}
