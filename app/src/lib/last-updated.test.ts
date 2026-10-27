import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { commitSuppliesUpdatedDate, gitLastUpdated, shouldShowUpdated } from './last-updated';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const mcpArticle = fileURLToPath(new URL('../content/docs/tech/mcp-deep-dive.mdx', import.meta.url));

const published = new Date('2026-01-02T00:00:00.000Z');

describe('shouldShowUpdated', () => {
  it('hides an update on the same day as publication', () => {
    const updated = new Date(published.getTime() + 23 * 60 * 60 * 1000);
    expect(shouldShowUpdated(published, updated)).toBe(false);
  });

  it('shows an update once a full day has passed', () => {
    const updated = new Date(published.getTime() + 24 * 60 * 60 * 1000);
    expect(shouldShowUpdated(published, updated)).toBe(true);
  });

  it('shows the updated date when there is no published date', () => {
    expect(shouldShowUpdated(undefined, published)).toBe(true);
  });

  it('hides the updated date when git has no timestamp', () => {
    expect(shouldShowUpdated(published, undefined)).toBe(false);
  });
});

describe('commitSuppliesUpdatedDate', () => {
  it('keeps an ordinary edit', () => {
    expect(commitSuppliesUpdatedDate('feat: site-wide image quality overhaul\n\nBody.')).toBe(true);
  });

  it('skips a commit whose message carries Updated-Date: ignore', () => {
    const message = 'feat(app): drop article heroes\n\nUpdated-Date: ignore\n';
    expect(commitSuppliesUpdatedDate(message)).toBe(false);
  });

  it('skips the hero-removal commit by its subject', () => {
    const message = 'feat(app): drop article heroes and serve generated cards\n\nRemoves the cover.\n';
    expect(commitSuppliesUpdatedDate(message)).toBe(false);
  });
});

describe('gitLastUpdated', () => {
  it('uses the newest commit that still supplies an updated date', () => {
    const updated = gitLastUpdated(mcpArticle);
    expect(updated?.toISOString()).toBe(newestSupplyingCommit(mcpArticle));
  });
});

function newestSupplyingCommit(filePath: string): string {
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
    return new Date(iso).toISOString();
  }
  throw new Error(`no supplying commit for ${filePath}`);
}
