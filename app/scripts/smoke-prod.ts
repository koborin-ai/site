import { setTimeout as sleep } from 'node:timers/promises';
import { allowedDropPrefix, readBaseline } from './check-routes.ts';

export const productionOrigin = new URL('https://koborin.ai');

const retryWaitsMs = [0, 15_000, 30_000, 30_000, 45_000] as const;
const requestTimeoutMs = 10_000;

// Worker asset control files. Cloudflare reads them and never serves them.
const controlFiles = new Set(['/_headers', '/_redirects']);
const articlePrefixes = ['/tech/', '/life/', '/ja/tech/', '/ja/life/'] as const;
const securityHeaders = ['content-security-policy', 'strict-transport-security'] as const;

export type Expectation = { readonly kind: 'page' } | { readonly kind: 'redirect'; readonly to: string };

export type Probe = { readonly path: string; readonly expect: Expectation };

type Observation =
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly location: string | null;
      readonly html: boolean;
      readonly blankHeaders: readonly string[];
    }
  | { readonly kind: 'unreachable'; readonly reason: string };

export type Failure = { readonly probe: Probe; readonly problems: readonly string[] };

export type SmokeRun = {
  readonly origin: URL;
  readonly fetch: (url: URL, init: RequestInit) => Promise<Response>;
  readonly sleep: (ms: number) => Promise<unknown>;
  readonly log: (line: string) => void;
};

export function probesFor(baseline: readonly string[]): Probe[] {
  return baseline.flatMap((path): Probe[] => {
    if (path.startsWith(allowedDropPrefix) || controlFiles.has(path)) return [];
    if (path.endsWith('.html')) {
      return [{ path, expect: { kind: 'redirect', to: path.slice(0, -'.html'.length) } }];
    }
    const page: Probe = { path, expect: { kind: 'page' } };
    const article = path.endsWith('/') && articlePrefixes.some((prefix) => path.startsWith(prefix));
    return article ? [page, { path: path.slice(0, -1), expect: { kind: 'redirect', to: path } }] : [page];
  });
}

function locationPath(raw: string, requested: URL): string {
  try {
    const target = new URL(raw, requested);
    return target.origin === requested.origin ? target.pathname : target.href;
  } catch {
    return raw;
  }
}

function observe(response: Response, requested: URL): Observation {
  const location = response.headers.get('location');
  const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  return {
    kind: 'response',
    status: response.status,
    location: location === null ? null : locationPath(location, requested),
    html: mediaType === 'text/html',
    blankHeaders: securityHeaders.filter((name) => !response.headers.get(name)?.trim()),
  };
}

function reasonOf(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message;
}

function judge(expect: Expectation, seen: Observation): string[] {
  if (seen.kind === 'unreachable') return [`unreachable: ${seen.reason}`];
  const problems: string[] = [];
  if (expect.kind === 'page' && seen.status !== 200) {
    problems.push(`expected 200, got ${seen.status}`);
  }
  if (expect.kind === 'redirect') {
    if (seen.status < 300 || seen.status > 399) {
      problems.push(`expected 3xx to ${expect.to}, got ${seen.status}`);
    } else if (seen.location !== expect.to) {
      problems.push(`expected Location ${expect.to}, got ${seen.location ?? 'none'}`);
    }
  }
  if (seen.html) problems.push(...seen.blankHeaders.map((name) => `missing ${name}`));
  return problems;
}

async function check(probe: Probe, run: SmokeRun): Promise<Failure | null> {
  const url = new URL(probe.path, run.origin);
  let seen: Observation;
  try {
    const response = await run.fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(requestTimeoutMs) });
    seen = observe(response, url);
    await response.body?.cancel();
  } catch (error) {
    seen = { kind: 'unreachable', reason: reasonOf(error) };
  }
  const problems = judge(probe.expect, seen);
  return problems.length === 0 ? null : { probe, problems };
}

export async function smoke(probes: readonly Probe[], run: SmokeRun): Promise<Failure[]> {
  let pending = probes;
  let failures: Failure[] = [];
  for (const [index, wait] of retryWaitsMs.entries()) {
    await run.sleep(wait);
    failures = (await Promise.all(pending.map((probe) => check(probe, run)))).filter((failure) => failure !== null);
    run.log(
      `attempt ${index + 1}/${retryWaitsMs.length} ${probes.length - failures.length} passed ${failures.length} failing`,
    );
    if (failures.length === 0) return [];
    pending = failures.map((failure) => failure.probe);
  }
  return failures;
}

if (import.meta.main) {
  const baseline = await readBaseline();
  const probes = probesFor(baseline);
  process.stdout.write(`baseline ${baseline.length}\nprobes ${probes.length}\n`);

  const failures = await smoke(probes, {
    origin: productionOrigin,
    fetch,
    sleep,
    log: (line) => process.stdout.write(`${line}\n`),
  });
  for (const failure of failures) {
    process.stderr.write(`${failure.probe.path} ${failure.problems.join('; ')}\n`);
  }
  if (failures.length > 0 || probes.length === 0) process.exit(1);
}
