import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type RedirectRule = {
  readonly from: string;
  readonly to: string;
  readonly status: number;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const defaultRedirectsPath = path.join(scriptDir, '..', 'public', '_redirects');

export function parseRedirects(source: string): RedirectRule[] {
  const rules: RedirectRule[] = [];
  for (const [index, raw] of source.split('\n').entries()) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2 || parts.length > 3) {
      throw new Error(`_redirects:${index + 1}: invalid rule "${line}"`);
    }
    const [from, to, rawStatus] = parts;
    const status = rawStatus === undefined ? 302 : Number(rawStatus);
    if (!Number.isInteger(status) || status < 300 || status > 399) {
      throw new Error(`_redirects:${index + 1}: invalid status "${rawStatus ?? ''}"`);
    }
    rules.push({ from: from ?? '', to: to ?? '', status });
  }
  return rules;
}

export async function readRedirects(filePath: string = defaultRedirectsPath): Promise<RedirectRule[]> {
  return parseRedirects(await readFile(filePath, 'utf8'));
}
