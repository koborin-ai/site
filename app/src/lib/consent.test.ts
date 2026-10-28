import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../', import.meta.url);
const OWNED = ['cookie_consent', 'googletagmanager.com/gtag/js', 'ga-disable-'];

const sources = globSync(['**/*.ts', '**/*.astro'], { cwd: SRC })
  .filter((file) => !file.endsWith('.test.ts') && !file.startsWith('content/'))
  .map((file) => ({ file: `src/${file}`, text: readFileSync(new URL(file, SRC), 'utf8') }));

describe('analytics consent ownership', () => {
  it.each(OWNED)('only src/lib/consent.ts mentions %s', (literal) => {
    const owners = sources.filter(({ text }) => text.includes(literal)).map(({ file }) => file);
    expect(owners).toEqual(['src/lib/consent.ts']);
  });
});
