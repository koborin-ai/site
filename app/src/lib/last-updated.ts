import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const oneDayMs = 24 * 60 * 60 * 1000;

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
