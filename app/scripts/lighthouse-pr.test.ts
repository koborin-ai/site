import { describe, expect, it } from 'vitest';
import { readBaseline } from './check-routes.ts';
import { judgeLighthouse, lighthousePaths } from './lighthouse-pr.ts';
import type { LighthouseAttempt, LighthousePath } from './lighthouse-pr.ts';

const architecture = '/tech/koborin-ai-architecture/';

function passingAttempts(): LighthouseAttempt[] {
  return lighthousePaths.flatMap((path): LighthouseAttempt[] => [
    { path, formFactor: 'desktop', scores: { performance: 0.95, accessibility: 1, 'best-practices': 1, seo: 0.97 } },
    { path, formFactor: 'mobile', scores: { performance: 0.9, accessibility: 1, 'best-practices': 1, seo: 1 } },
  ]);
}

function withAttempt(
  path: LighthousePath,
  formFactor: 'desktop' | 'mobile',
  attempt: LighthouseAttempt | null,
): LighthouseAttempt[] {
  return passingAttempts().flatMap((entry) =>
    entry.path === path && entry.formFactor === formFactor ? (attempt === null ? [] : [attempt]) : [entry],
  );
}

describe('judgeLighthouse', () => {
  it('exits 0 with every row passing when each floor is met, mobile performance at exactly 0.9', () => {
    const judgement = judgeLighthouse(passingAttempts());

    expect(judgement.exitCode).toBe(0);
    expect(judgement.missing).toEqual([]);
    expect(judgement.rows).toHaveLength(lighthousePaths.length * 5);
    expect(judgement.rows.every((row) => row.pass)).toBe(true);
    expect(judgement.summary.split('\n')[0]).toBe(
      'Scores are report-only. required-checks fails only when a report is missing.',
    );
  });

  it('reports a numeric miss as a failed row and still exits 0', () => {
    const judgement = judgeLighthouse(
      withAttempt('/', 'desktop', {
        path: '/',
        formFactor: 'desktop',
        scores: { performance: 0.949, accessibility: 1, 'best-practices': 1, seo: 1 },
      }),
    );

    expect(judgement.exitCode).toBe(0);
    expect(judgement.rows.filter((row) => !row.pass)).toEqual([
      { path: '/', formFactor: 'desktop', category: 'performance', minimum: 0.95, actual: 0.949, pass: false },
    ]);
    expect(judgement.summary).toContain('| / | desktop | performance | 0.95 | 0.949 | below |');
  });

  it('treats a null score as a missing report and exits 1', () => {
    const judgement = judgeLighthouse(
      withAttempt('/', 'desktop', {
        path: '/',
        formFactor: 'desktop',
        scores: { performance: null, accessibility: 1, 'best-practices': 1, seo: 1 },
      }),
    );

    expect(judgement.exitCode).toBe(1);
    expect(judgement.missing).toEqual([
      { path: '/', formFactor: 'desktop', category: 'performance', reason: 'no score' },
    ]);
  });

  it('exits 1 on an error attempt and still scores the other pages', () => {
    const judgement = judgeLighthouse(
      withAttempt('/ja/', 'desktop', { path: '/ja/', formFactor: 'desktop', error: 'main document status 404' }),
    );

    expect(judgement.exitCode).toBe(1);
    expect(judgement.missing.map((cell) => [cell.path, cell.formFactor, cell.reason])).toEqual(
      Array.from({ length: 4 }, () => ['/ja/', 'desktop', 'main document status 404']),
    );
    expect(judgement.rows.some((row) => row.path === '/ja/' && row.formFactor === 'mobile')).toBe(true);
    expect(judgement.rows.some((row) => row.path === architecture)).toBe(true);
  });

  it('exits 1 when a page has no attempt at all', () => {
    const attempts = passingAttempts().filter((attempt) => attempt.path !== architecture);

    const judgement = judgeLighthouse(attempts);

    expect(judgement.exitCode).toBe(1);
    expect(judgement.missing).toHaveLength(5);
    expect(judgement.missing.every((cell) => cell.path === architecture && cell.reason === 'no attempt')).toBe(true);
  });

  it('ignores mobile categories other than performance', () => {
    const judgement = judgeLighthouse(
      withAttempt('/', 'mobile', {
        path: '/',
        formFactor: 'mobile',
        scores: { performance: 0.92, accessibility: 0.4, 'best-practices': 0.4, seo: 0.4 },
      }),
    );

    expect(judgement.exitCode).toBe(0);
    expect(judgement.rows.filter((row) => row.formFactor === 'mobile').map((row) => row.category)).toEqual(
      Array.from({ length: lighthousePaths.length }, () => 'performance'),
    );
    expect(judgement.summary).not.toContain('| mobile | accessibility');
  });

  it('throws on two attempts for the same page and form factor', () => {
    const attempts = passingAttempts();
    expect(() => judgeLighthouse([...attempts, attempts[0]])).toThrow('duplicate');
  });
});

describe('lighthousePaths', () => {
  it('lists only pages that routes-baseline.txt already promises', async () => {
    const baseline = await readBaseline();
    for (const path of lighthousePaths) expect(baseline).toContain(path);
  });
});
