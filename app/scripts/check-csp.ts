import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(scriptDir, '..', 'dist');
const headersPath = path.join(scriptDir, '..', 'public', '_headers');

const executableTypes = new Set(['module', 'text/javascript', 'application/javascript']);

export function inlineScriptBodies(html: string): string[] {
  const bodies: string[] = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
    if (type && !executableTypes.has(type)) continue;
    if (body.length === 0) continue;
    bodies.push(body);
  }
  return bodies;
}

export function scriptHash(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('base64');
}

export function policyHashes(headers: string): string[] {
  const line = headers
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.toLowerCase().startsWith('content-security-policy:'));
  if (!line) return [];
  return [...line.matchAll(/sha256-([A-Za-z0-9+/=]+)/g)].map((match) => match[1] ?? '');
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

async function main(): Promise<void> {
  const headers = await readFile(headersPath, 'utf8');
  const allowed = new Set(policyHashes(headers));
  const found = new Map<string, string>();

  for (const file of await htmlFiles(distDir)) {
    const html = await readFile(file, 'utf8');
    for (const body of inlineScriptBodies(html)) {
      const hash = scriptHash(body);
      if (!found.has(hash)) found.set(hash, path.relative(distDir, file));
    }
  }

  const missing = [...found.entries()].filter(([hash]) => !allowed.has(hash));
  const unused = [...allowed].filter((hash) => !found.has(hash));

  process.stdout.write(`inline scripts ${found.size}\npolicy hashes ${allowed.size}\n`);
  for (const [hash, file] of found) {
    process.stdout.write(`sha256-${hash} ${file}\n`);
  }

  if (missing.length > 0) {
    process.stderr.write(`missing hashes:\n${missing.map(([hash, file]) => `${hash} ${file}`).join('\n')}\n`);
  }
  if (unused.length > 0) {
    process.stderr.write(`unused hashes:\n${unused.join('\n')}\n`);
  }
  if (missing.length > 0 || unused.length > 0 || allowed.size === 0) {
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
