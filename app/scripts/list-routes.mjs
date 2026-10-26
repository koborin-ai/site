import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function toUrl(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  if (normalized.startsWith('_astro/')) return null;
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) {
    return `/${normalized.slice(0, -'index.html'.length)}`;
  }
  return `/${normalized}`;
}

async function walk(directory, dist, urls) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, dist, urls);
      continue;
    }
    const url = toUrl(path.relative(dist, fullPath));
    if (url) urls.push(url);
  }
}

export async function listRoutes(distDir) {
  const dist = path.resolve(distDir);
  const urls = [];
  await walk(dist, dist, urls);
  return [...new Set(urls)].toSorted();
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  const urls = await listRoutes(process.argv[2] ?? 'dist');
  process.stdout.write(`${urls.join('\n')}\n`);
}
