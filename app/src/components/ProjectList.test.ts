import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import HomePage from './HomePage.astro';
import ProjectList from './ProjectList.astro';

const githubPrefix = 'M12 .5a11.5';

const rows = [
  {
    name: 'TerraDart',
    href: 'https://terradart.dev/',
    description: {
      en: 'Type-safe IaC for Dart.',
      ja: 'Dart のためのタイプセーフな IaC。',
    },
  },
  {
    name: 'contextlint',
    href: 'https://contextlint.dev/',
    description: {
      en: 'A semantic linter for AI-era Markdown.',
      ja: 'AI 時代の Markdown のためのセマンティックリンター。',
    },
  },
  {
    name: 'jev-spec',
    href: 'https://github.com/nozomi-koborinai/jev-spec',
    description: {
      en: 'Catch spec drift on every commit.',
      ja: '仕様書とコードのずれを、コミットのたびに検出する。',
    },
  },
] as const;

function stripCid(html: string): string {
  return html.replace(/\sdata-astro-cid-[\w-]+(?:="[^"]*")?/g, '');
}

function listItems(html: string): string[] {
  return [...stripCid(html).matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map((match) => match[0]);
}

function visibleText(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function accessibleName(anchor: string): string {
  const withoutHidden = anchor.replace(
    /<([a-zA-Z][\w:-]*)\b[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g,
    '',
  );
  return visibleText(withoutHidden);
}

describe('ProjectList', () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it.each(['en', 'ja'] as const)('renders building rows in %s', async (locale) => {
    const html = stripCid(await container.renderToString(ProjectList, { props: { locale } }));
    const items = listItems(html);
    expect(items).toHaveLength(rows.length);

    for (const [index, expected] of rows.entries()) {
      const row = items[index] ?? '';
      const anchors = [...row.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map((match) => match[0]);
      expect(anchors, expected.name).toHaveLength(1);
      const anchor = anchors[0] ?? '';
      const href = anchor.match(/\bhref="([^"]*)"/)?.[1];
      expect(href).toBe(expected.href);

      const visible = visibleText(anchor);
      expect(visible === `${expected.name} ↗` || visible === `${expected.name}↗`, visible).toBe(true);
      expect(accessibleName(anchor)).toBe(expected.name);

      const description = expected.description[locale];
      expect(row).toContain(description);
      expect(anchor).not.toContain(description);

      if (expected.name === 'TerraDart') {
        expect(row).toContain('fill="#4DD0FE"');
        expect(row).not.toContain(githubPrefix);
      } else if (expected.name === 'contextlint') {
        expect(row).toContain('fill="#0040ff"');
        expect(row).not.toContain(githubPrefix);
      } else {
        expect(row.split(githubPrefix)).toHaveLength(2);
      }
    }

    expect(html).not.toContain('Site ↗');
    expect(html).not.toContain('GitHub ↗');
    expect(html).not.toContain('サイト ↗');
    expect(html).not.toContain('class="ph"');
  });
});

const origin = 'https://koborin.ai';

const projectHrefs = [
  'https://terradart.dev/',
  'https://contextlint.dev/',
  'https://github.com/nozomi-koborinai/jev-spec',
] as const;

function buildingSlice(html: string, locale: 'en' | 'ja'): string {
  const heading = locale === 'en' ? 'Building' : '作っているもの';
  const start = html.indexOf(heading);
  if (start < 0) return '';
  const rest = html.slice(start);
  const next = rest.indexOf('<h2');
  return next < 0 ? rest : rest.slice(0, next);
}

describe('home Building section', () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create({ astroConfig: { site: origin } });
  });

  it.each(['en', 'ja'] as const)('links the three projects and GitHub from the %s home', async (locale) => {
    const prefix = locale === 'ja' ? '/ja' : '';
    const html = await container.renderToString(HomePage, {
      props: { locale },
      request: new Request(`${origin}${prefix}/`),
    });
    const slice = buildingSlice(html, locale);
    const items = listItems(slice);
    expect(items).toHaveLength(3);

    for (const [index, href] of projectHrefs.entries()) {
      const row = items[index] ?? '';
      expect(row).toContain(rows[index]?.name);
      expect(row).toContain(`href="${href}"`);
    }

    const mores = [...slice.matchAll(/<a\b[^>]*\bclass="more"[^>]*>[\s\S]*?<\/a>/g)].map((match) => match[0]);
    expect(mores).toHaveLength(1);
    const more = mores[0] ?? '';
    expect(more).toContain('href="https://github.com/nozomi-koborinai?tab=repositories"');
    expect(more).toContain('target="_blank"');
    expect(more).toContain('rel="noopener noreferrer"');
    expect(visibleText(more)).toBe(locale === 'en' ? 'More on GitHub ↗' : 'ほかは GitHub で ↗');
    expect(slice).not.toContain('gcp-cost-mcp-server');
    expect(slice).not.toContain('ableton-osc-mcp');
  });
});
