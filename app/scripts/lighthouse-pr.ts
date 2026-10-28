import { createServer } from 'node:http';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';
import type { Result } from 'lighthouse';

export const lighthousePaths = [
  '/',
  '/ja/',
  '/tech/koborin-ai-architecture/',
  '/ja/tech/koborin-ai-architecture/',
] as const;

export type LighthousePath = (typeof lighthousePaths)[number];

const formFactors = ['desktop', 'mobile'] as const;
type FormFactor = (typeof formFactors)[number];

const categories = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
type LighthouseCategory = (typeof categories)[number];

const floors: Record<FormFactor, Readonly<Partial<Record<LighthouseCategory, number>>>> = {
  desktop: { performance: 0.95, accessibility: 0.95, 'best-practices': 0.95, seo: 0.95 },
  mobile: { performance: 0.9 },
};

export type LighthouseAttempt =
  | {
      readonly path: LighthousePath;
      readonly formFactor: FormFactor;
      readonly scores: Readonly<Partial<Record<LighthouseCategory, number | null>>>;
    }
  | {
      readonly path: LighthousePath;
      readonly formFactor: FormFactor;
      readonly error: string;
    };

type Cell = { readonly path: LighthousePath; readonly formFactor: FormFactor; readonly category: LighthouseCategory };

export type ScoreRow = Cell & { readonly minimum: number; readonly actual: number; readonly pass: boolean };

export type MissingReport = Cell & { readonly reason: string };

export type LighthouseJudgement = {
  readonly rows: readonly ScoreRow[];
  readonly missing: readonly MissingReport[];
  readonly exitCode: 0 | 1;
  readonly summary: string;
};

const summaryHeadline = 'Scores are report-only. required-checks fails only when a report is missing.';

function judgeCell(cell: Cell, minimum: number, attempt: LighthouseAttempt | undefined): ScoreRow | MissingReport {
  if (attempt === undefined) return { ...cell, reason: 'no attempt' };
  if ('error' in attempt) return { ...cell, reason: attempt.error };
  const actual = attempt.scores[cell.category];
  if (typeof actual !== 'number') return { ...cell, reason: 'no score' };
  return { ...cell, minimum, actual, pass: actual >= minimum };
}

function summaryLine(result: ScoreRow | MissingReport): string {
  const minimum = floors[result.formFactor][result.category];
  const [score, verdict] =
    'reason' in result ? ['missing', result.reason] : [String(result.actual), result.pass ? 'pass' : 'below'];
  return `| ${result.path} | ${result.formFactor} | ${result.category} | ${minimum} | ${score} | ${verdict} |`;
}

/** No score has been recorded on the CI runner yet, so only a missing report may fail required-checks. */
export function judgeLighthouse(attempts: readonly LighthouseAttempt[]): LighthouseJudgement {
  const byCell = new Map<string, LighthouseAttempt>();
  for (const attempt of attempts) {
    const key = `${attempt.formFactor} ${attempt.path}`;
    if (byCell.has(key)) throw new Error(`duplicate Lighthouse attempt for ${key}`);
    byCell.set(key, attempt);
  }

  const results: (ScoreRow | MissingReport)[] = [];
  for (const pagePath of lighthousePaths) {
    for (const formFactor of formFactors) {
      const attempt = byCell.get(`${formFactor} ${pagePath}`);
      for (const category of categories) {
        const minimum = floors[formFactor][category];
        if (minimum !== undefined) results.push(judgeCell({ path: pagePath, formFactor, category }, minimum, attempt));
      }
    }
  }

  const rows = results.filter((result): result is ScoreRow => !('reason' in result));
  const missing = results.filter((result): result is MissingReport => 'reason' in result);
  const summary = [
    summaryHeadline,
    '',
    '| path | form factor | category | minimum | score | verdict |',
    '| --- | --- | --- | --- | --- | --- |',
    ...results.map(summaryLine),
    '',
    `${rows.filter((row) => row.pass).length} of ${results.length} scores met their minimum. ${missing.length} missing.`,
    '',
  ].join('\n');
  return { rows, missing, exitCode: missing.length > 0 ? 1 : 0, summary };
}

const contentTypes: Readonly<Record<string, string>> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const brotliTypes = new Set(['.html', '.css', '.js', '.svg', '.json', '.xml', '.txt']);

// Not the maximum. Quality 11 can compress below what Cloudflare serves and flatter the performance score.
const brotliQuality = 4;
const compress = promisify(brotliCompress);

function distFile(distDir: string, requestUrl: string | undefined): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname);
  } catch {
    return null;
  }
  const file = path.join(distDir, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
  return file.startsWith(distDir + path.sep) ? file : null;
}

async function serveDist(distDir: string): Promise<{ readonly origin: string; close(): Promise<void> }> {
  const server = createServer(async (request, response) => {
    const file = distFile(distDir, request.url);
    const body = file === null ? null : await readFile(file).catch(() => null);
    if (file === null || body === null) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    const extension = path.extname(file);
    const headers: Record<string, string> = {
      'content-type': contentTypes[extension] ?? 'application/octet-stream',
      vary: 'accept-encoding',
    };
    let payload: Buffer = body;
    if (brotliTypes.has(extension) && /\bbr\b/.test(request.headers['accept-encoding'] ?? '')) {
      payload = await compress(body, { params: { [constants.BROTLI_PARAM_QUALITY]: brotliQuality } });
      headers['content-encoding'] = 'br';
    }
    headers['content-length'] = String(payload.byteLength);
    response.writeHead(200, headers).end(payload);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('preview server has no port');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function attemptFrom(pagePath: LighthousePath, formFactor: FormFactor, lhr: Result): LighthouseAttempt {
  if (lhr.runtimeError) return { path: pagePath, formFactor, error: `${lhr.runtimeError.code} ${lhr.runtimeError.message}` };
  const details = lhr.audits['network-requests']?.details;
  const documentUrl = lhr.mainDocumentUrl ?? lhr.finalDisplayedUrl;
  const mainDocument = details?.type === 'table' ? details.items.find((item) => item.url === documentUrl) : undefined;
  if (mainDocument?.statusCode !== 200) {
    return { path: pagePath, formFactor, error: `main document status ${String(mainDocument?.statusCode ?? 'unknown')}` };
  }
  const scores = Object.fromEntries(categories.map((category) => [category, lhr.categories[category]?.score ?? null]));
  return { path: pagePath, formFactor, scores };
}

function reportName(formFactor: FormFactor, pagePath: LighthousePath): string {
  return `${formFactor}-${pagePath.split('/').filter(Boolean).join('-') || 'home'}.html`;
}

async function runLighthouse(outDir: string): Promise<LighthouseJudgement> {
  const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const { default: lighthouse, desktopConfig } = await import('lighthouse');
  const { launch } = await import('chrome-launcher');
  const { chromium } = await import('playwright');

  const server = await serveDist(distDir);
  const chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox'],
  });
  const attempts: LighthouseAttempt[] = [];
  try {
    // One at a time. Parallel runs share the runner's CPU and skew each other's performance score.
    for (const pagePath of lighthousePaths) {
      for (const formFactor of formFactors) {
        try {
          const result = await lighthouse(
            new URL(pagePath, server.origin).href,
            { port: chrome.port, output: 'html', logLevel: 'error', onlyCategories: [...categories] },
            formFactor === 'desktop' ? desktopConfig : undefined,
          );
          if (result === undefined) {
            attempts.push({ path: pagePath, formFactor, error: 'Lighthouse returned no result' });
            continue;
          }
          await writeFile(path.join(outDir, reportName(formFactor, pagePath)), String(result.report));
          attempts.push(attemptFrom(pagePath, formFactor, result.lhr));
        } catch (error) {
          attempts.push({ path: pagePath, formFactor, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  } finally {
    chrome.kill();
    await server.close();
  }

  const judgement = judgeLighthouse(attempts);
  await writeFile(path.join(outDir, 'summary.md'), judgement.summary);
  await writeFile(path.join(outDir, 'report.json'), `${JSON.stringify({ attempts, judgement }, null, 2)}\n`);
  return judgement;
}

if (import.meta.main) {
  const outDir = process.argv[2];
  if (outDir === undefined) {
    process.stderr.write('usage: node scripts/lighthouse-pr.ts <output directory>\n');
    process.exit(2);
  }
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const judgement = await runLighthouse(outDir);
  process.stdout.write(judgement.summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, judgement.summary);
  process.exit(judgement.exitCode);
}
