import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const oneDayMs = 24 * 60 * 60 * 1000;

// The pushed hero-removal commit is recognized by its subject. A squash merge
// replaces that subject, so the pull request body also carries this trailer.
const ignoredUpdatedDateMarkers = [
  'Updated-Date: ignore',
  'drop article heroes and serve generated cards',
];

export function commitSuppliesUpdatedDate(message: string): boolean {
  return ignoredUpdatedDateMarkers.every((marker) => !message.includes(marker));
}

export function gitLastUpdated(filePath: string): Date | undefined {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', filePath], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    if (!iso) return undefined;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}

export function shouldShowUpdated(publishedAt: Date | undefined, updatedAt: Date | undefined): boolean {
  if (!updatedAt) return false;
  if (!publishedAt) return true;
  return Math.abs(updatedAt.getTime() - publishedAt.getTime()) >= oneDayMs;
}
