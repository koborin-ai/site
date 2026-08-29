import { describe, expect, it } from 'vitest';
import { renderLlmsContent, textResponse } from './llms';
import type { LlmsEntry } from './llms';

const entries: LlmsEntry[] = [
  { id: 'tech/astro', body: 'English tech body', data: { title: 'Astro' } },
  { id: 'life/coffee', body: 'English life body', data: { title: 'Coffee' } },
  { id: 'about-me/index', body: 'English about', data: { title: 'About' } },
  { id: 'ja/tech/astro', body: '日本語の本文', data: { title: 'Astro (JA)' } },
  { id: 'ja/life/coffee', body: '日本語の生活', data: { title: 'Coffee (JA)' } },
];

describe('renderLlmsContent', () => {
  it('keeps only English entries for the en language', () => {
    const output = renderLlmsContent(entries, 'en', 'all');

    expect(output).toContain('## Astro');
    expect(output).toContain('## About');
    expect(output).not.toContain('## Astro (JA)');
  });

  it('keeps only Japanese entries for the ja language', () => {
    const output = renderLlmsContent(entries, 'ja', 'all');

    expect(output).toContain('## Astro (JA)');
    expect(output).toContain('## Coffee (JA)');
    expect(output).not.toContain('## About');
  });

  it('narrows to a single category in both languages', () => {
    expect(renderLlmsContent(entries, 'en', 'tech')).not.toContain('## Coffee');
    expect(renderLlmsContent(entries, 'ja', 'tech')).not.toContain(
      '## Coffee (JA)'
    );
    expect(renderLlmsContent(entries, 'ja', 'life')).toContain('## Coffee (JA)');
  });

  it('renders a header, absolute URLs and separated bodies', () => {
    const output = renderLlmsContent(entries, 'en', 'tech');

    expect(output).toMatch(
      /^# koborin\.ai - EN \/ tech\n> Last updated: \d{4}-\d{2}-\d{2}\n\n/
    );
    expect(output).toContain('URL: https://koborin.ai/tech/astro/');
    expect(output).toContain('English tech body');
  });

  it('separates multiple entries with a horizontal rule', () => {
    const output = renderLlmsContent(entries, 'en', 'all');

    expect(output.split('\n---\n\n')).toHaveLength(3);
  });

  it('drops the category label when rendering everything', () => {
    expect(renderLlmsContent(entries, 'ja', 'all')).toMatch(
      /^# koborin\.ai - JA\n/
    );
  });
});

describe('textResponse', () => {
  it('serves UTF-8 plain text', async () => {
    const response = textResponse('本文');

    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8'
    );
    await expect(response.text()).resolves.toBe('本文');
  });
});
