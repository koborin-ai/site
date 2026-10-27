import { readdir } from 'node:fs/promises';
import path from 'node:path';

export function toUrl(relativePath: string): string | null {
  const normalized = relativePath.split(path.sep).join('/');
  if (normalized.startsWith('_astro/')) return null;
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) {
    return `/${normalized.slice(0, -'index.html'.length)}`;
  }
  return `/${normalized}`;
}

async function walk(directory: string, dist: string, urls: string[]): Promise<void> {
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

export async function listRoutes(distDir: string): Promise<string[]> {
  const dist = path.resolve(distDir);
  const urls: string[] = [];
  await walk(dist, dist, urls);
  return [...new Set(urls)].toSorted();
}

if (import.meta.main) {
  const urls = await listRoutes(process.argv[2] ?? 'dist');
  process.stdout.write(`${urls.join('\n')}\n`);
}
