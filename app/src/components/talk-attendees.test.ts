import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Locale } from '../lib/docs';
import type { Talk } from '../lib/catalog';
import HomePage from './HomePage.astro';
import ListView from './ListView.astro';
import TalkList from './TalkList.astro';

const origin = 'https://koborin.ai';

const oracle = [
  {
    listDate: '07月',
    event: { en: 'FlutterGakkai (10th)', ja: '第10回 FlutterGakkai' },
    attendees: 56,
  },
  {
    listDate: '07月',
    event: { en: 'Google I/O Extended Tokyo 2025', ja: 'Google I/O Extended Tokyo 2025' },
    attendees: 434,
  },
  {
    listDate: '02月',
    event: { en: 'FlutterGakkai (7th)', ja: 'FlutterGakkai（第7回）' },
    attendees: 191,
  },
  {
    listDate: '12月',
    event: { en: 'Genkit Hands-on (Organizer)', ja: 'Genkit ハンズオン（運営）' },
    attendees: 45,
  },
  {
    listDate: '11月',
    event: { en: 'GDG DevFest Tokyo 2024', ja: 'GDG DevFest Tokyo 2024' },
    attendees: 369,
  },
  {
    listDate: '06月',
    event: { en: 'TECH+ Seminar', ja: 'TECH+ セミナー' },
    attendees: 246,
  },
  {
    listDate: '06月',
    event: { en: 'Map The Way Tokyo', ja: 'Map The Way Tokyo' },
    attendees: 75,
  },
  {
    listDate: '04月',
    event: { en: 'Retail DX', ja: 'リテールDX' },
    attendees: 138,
  },
  {
    listDate: '04月',
    event: { en: 'Google Cloud RetailTech Recap Seminar', ja: 'Google Cloud リテールテック振り返りセミナー' },
    attendees: 51,
  },
  {
    listDate: '03月',
    event: { en: 'RetailTech JAPAN', ja: 'リテールテックJAPAN' },
    attendees: 429,
  },
  {
    listDate: '02月',
    event: { en: 'GDG Tokyo Monthly Online Tech Talks', ja: 'GDG Tokyo Monthly Online Tech Talks' },
    attendees: 200,
  },
  {
    listDate: '12月',
    event: { en: 'Cloud Ace Webinar', ja: 'Cloud Ace ウェビナー' },
    attendees: 61,
  },
] as const;

const homeEvents: Record<Locale, readonly string[]> = {
  en: [
    'FlutterGakkai (10th)',
    'Google I/O Extended Tokyo 2025',
    'FlutterGakkai (7th)',
    'GDG DevFest Tokyo 2024',
  ],
  ja: [
    '第10回 FlutterGakkai',
    'Google I/O Extended Tokyo 2025',
    'FlutterGakkai（第7回）',
    'GDG DevFest Tokyo 2024',
  ],
};

function countLabel(locale: Locale, count: number): string {
  return locale === 'en' ? `${count} people` : `${count} 人`;
}

function listItems(html: string): { event: string; text: string }[] {
  return [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => {
    const body = match[1] ?? '';
    const event = body.match(/<span class="sub">([^<]*)<\/span>/)?.[1] ?? '';
    const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return { event, text };
  });
}

function homeTalksSlice(html: string, locale: Locale): string {
  const heading = locale === 'en'
    ? '<h2 class="section-label">Talks</h2>'
    : '<h2 class="section-label">登壇</h2>';
  const start = html.indexOf(heading);
  if (start < 0) return '';
  const rest = html.slice(start);
  const end = rest.indexOf('</section>');
  return end < 0 ? '' : rest.slice(0, end);
}

describe('talk attendee counts', () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create({ astroConfig: { site: origin } });
  });

  describe.each(['en', 'ja'] as const)('%s talks list', (locale) => {
    it('shows the count from the old table on each event row', async () => {
      const prefix = locale === 'ja' ? '/ja' : '';
      const html = await container.renderToString(ListView, {
        props: { kind: 'talks', locale },
        request: new Request(`${origin}${prefix}/talks/`),
      });
      const rows = listItems(html);
      expect(rows).toHaveLength(oracle.length);

      for (const row of oracle) {
        const matches = rows.filter((item) => item.event === row.event[locale]);
        expect(matches, row.event[locale]).toHaveLength(1);
        const text = matches[0]?.text ?? '';
        expect(text).toContain(row.listDate);
        expect(text.endsWith(` ${countLabel(locale, row.attendees)}`), text).toBe(true);
      }
    });
  });

  describe.each(['en', 'ja'] as const)('%s home', (locale) => {
    it('lists the home talks without a count', async () => {
      const prefix = locale === 'ja' ? '/ja' : '';
      const html = await container.renderToString(HomePage, {
        props: { locale },
        request: new Request(`${origin}${prefix}/`),
      });
      const slice = homeTalksSlice(html, locale);

      for (const event of homeEvents[locale]) {
        expect(slice).toContain(event);
      }
      expect(slice).toContain('2026/07');
      expect(slice).not.toContain('Genkit Hands-on');
      expect(slice).not.toContain('Genkit ハンズオン');
      expect(slice).not.toContain('talk-count');
      for (const row of oracle) {
        expect(slice).not.toMatch(new RegExp(`(^|\\D)${row.attendees}(\\D|$)`));
      }
    });
  });

  it('leaves the writing list without a count', async () => {
    const html = await container.renderToString(ListView, {
      props: { kind: 'writing', locale: 'en' },
      request: new Request(`${origin}/blog/`),
    });
    expect(html).toContain('Writing');
    expect(html).not.toContain('talk-count');
  });

  it('omits the count when a talk has no attendees key', async () => {
    const talk: Talk = {
      date: '2020/09',
      year: 2020,
      event: { en: 'Sample Night', ja: 'Sample Night' },
      title: { en: 'A short note', ja: 'A short note' },
      onHome: false,
    };
    const html = await container.renderToString(TalkList, {
      props: { talks: [talk], locale: 'en' },
    });
    expect(html).toContain('09月');
    expect(html).toContain('Sample Night');
    expect(html).not.toContain('talk-count');
    expect(html).not.toContain('people');
    expect(html).not.toContain('人');
  });
});
