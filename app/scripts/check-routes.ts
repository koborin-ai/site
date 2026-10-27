import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRoutes } from './list-routes.ts';

const allowedDropPrefix = '/pagefind/';

export const allowedAdditions = [
  '/blog/',
  '/ja/blog/',
  '/talks/',
  '/ja/talks/',
  '/about/',
  '/ja/about/',
] as const;

export type RouteDiff = {
  droppedSearch: string[];
  missing: string[];
  generated: string[];
  unexpected: string[];
};

export function diffRoutes(
  baseline: readonly string[],
  actual: readonly string[],
  allowed: readonly string[] = allowedAdditions,
): RouteDiff {
  const actualSet = new Set(actual);
  const baselineSet = new Set(baseline);
  const allowedSet = new Set(allowed);
  const droppedSearch = baseline.filter((url) => !actualSet.has(url) && url.startsWith(allowedDropPrefix));
  const missing = baseline.filter((url) => !actualSet.has(url) && !url.startsWith(allowedDropPrefix));
  const generated = actual.filter((url) => !baselineSet.has(url) && url.startsWith('/og/') && url.endsWith('.webp'));
  const generatedSet = new Set(generated);
  const unexpected = actual.filter((url) => !baselineSet.has(url) && !generatedSet.has(url) && !allowedSet.has(url));
  return { droppedSearch, missing, generated, unexpected };
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

if (import.meta.main) {
  const baseline = (await readFile(path.join(scriptDir, 'routes-baseline.txt'), 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const actual = await listRoutes(path.join(scriptDir, '..', 'dist'));
  const result = diffRoutes(baseline, actual);

  process.stdout.write(
    [
      `baseline ${baseline.length}`,
      `actual ${actual.length}`,
      `dropped pagefind ${result.droppedSearch.length}`,
      `generated og webp ${result.generated.length}`,
      `missing ${result.missing.length}`,
      `added ${result.unexpected.length}`,
    ].join('\n') + '\n',
  );

  if (result.missing.length > 0) {
    process.stderr.write(`missing urls:\n${result.missing.join('\n')}\n`);
  }
  if (result.unexpected.length > 0) {
    process.stderr.write(`added urls:\n${result.unexpected.join('\n')}\n`);
  }

  if (result.missing.length > 0 || result.unexpected.length > 0) {
    process.exit(1);
  }
}
