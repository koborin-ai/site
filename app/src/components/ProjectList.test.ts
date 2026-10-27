import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
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
    name: 'gcp-cost-mcp-server',
    href: 'https://github.com/nozomi-koborinai/gcp-cost-mcp-server',
    description: {
      en: 'An MCP server that lets AI assistants estimate GCP running costs.',
      ja: 'AI アシスタントから GCP のランニングコストを見積もれる MCP サーバー。',
    },
  },
  {
    name: 'ableton-osc-mcp',
    href: 'https://github.com/nozomi-koborinai/ableton-osc-mcp',
    description: {
      en: 'An MCP server that drives Ableton Live via AbletonOSC.',
      ja: 'AbletonOSC 経由で Ableton Live を操作できる MCP サーバー。',
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
