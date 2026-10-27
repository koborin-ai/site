import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const oneDayMs = 24 * 60 * 60 * 1000;

const ignoredUpdatedDateMarkers = [
  'Updated-Date: ignore',
  'drop article heroes and serve generated cards',
];

export function commitSuppliesUpdatedDate(message: string): boolean {
  return ignoredUpdatedDateMarkers.every((marker) => !message.includes(marker));
}

export function gitLastUpdated(filePath: string): Date | undefined {
  try {
    const raw = execFileSync('git', ['log', '--format=%cI%x1f%B%x1e', '--', filePath], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    for (const record of raw.split('\x1e')) {
      if (!record.trim()) continue;
      const separator = record.indexOf('\x1f');
      const iso = (separator === -1 ? record : record.slice(0, separator)).trim();
      const message = separator === -1 ? '' : record.slice(separator + 1);
      if (!iso || !commitSuppliesUpdatedDate(message)) continue;
      const date = new Date(iso);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function shouldShowUpdated(publishedAt: Date | undefined, updatedAt: Date | undefined): boolean {
  if (!updatedAt) return false;
  if (!publishedAt) return true;
  return Math.abs(updatedAt.getTime() - publishedAt.getTime()) >= oneDayMs;
}
