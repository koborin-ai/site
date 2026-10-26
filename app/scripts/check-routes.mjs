import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRoutes } from './list-routes.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const allowedDropPrefix = '/pagefind/';

const baseline = (await readFile(path.join(scriptDir, 'routes-baseline.txt'), 'utf8'))
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
const actual = await listRoutes(path.join(scriptDir, '..', 'dist'));
const actualSet = new Set(actual);
const baselineSet = new Set(baseline);

const droppedSearch = baseline.filter((url) => !actualSet.has(url) && url.startsWith(allowedDropPrefix));
const missing = baseline.filter((url) => !actualSet.has(url) && !url.startsWith(allowedDropPrefix));
const added = actual.filter((url) => !baselineSet.has(url));

process.stdout.write(
  [
    `baseline ${baseline.length}`,
    `actual ${actual.length}`,
    `dropped pagefind ${droppedSearch.length}`,
    `missing ${missing.length}`,
    `added ${added.length}`,
  ].join('\n') + '\n',
);

if (missing.length > 0) {
  process.stderr.write(`missing urls:\n${missing.join('\n')}\n`);
}
if (added.length > 0) {
  process.stderr.write(`added urls:\n${added.join('\n')}\n`);
}

if (missing.length > 0 || added.length > 0) {
  process.exit(1);
}
