import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchSiteIcon, siteHostname } from '../src/lib/site-icon.ts';

const contentDir = path.resolve(import.meta.dirname, '../src/content');
const outFile = path.resolve(import.meta.dirname, '../src/data/site-icons.json');

async function mdxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(full);
    return entry.name.endsWith('.mdx') ? [full] : [];
  }));
  return nested.flat();
}

async function pages(): Promise<Map<string, string>> {
  const files = await mdxFiles(contentDir);
  const found = new Map<string, string>();
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/<RichLinkCard\b[\s\S]*?\bhref=(["'])(https?:\/\/[^"']+)\1/g)) {
      const host = siteHostname(match[2]);
      if (!found.has(host)) found.set(host, match[2]);
    }
  }
  return found;
}

async function main(): Promise<void> {
  const pagesByHost = await pages();
  const icons: Record<string, string> = {};
  const queue = [...pagesByHost.entries()].toSorted(([a], [b]) => a.localeCompare(b));
  async function worker(): Promise<void> {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      const [host, pageUrl] = next;
      const icon = await fetchSiteIcon(pageUrl);
      if (icon) icons[host] = icon;
      else console.log(`no icon for ${host}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));
  const sorted = Object.fromEntries(Object.entries(icons).toSorted(([a], [b]) => a.localeCompare(b)));
  await writeFile(outFile, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`wrote ${Object.keys(sorted).length} of ${pagesByHost.size} icons`);
}

await main();
