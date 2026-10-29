import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Locale } from '../lib/docs';
import type { Talk } from '../lib/catalog';
import HomePage from './HomePage.astro';
import ListView from './ListView.astro';
import QuietList from './QuietList.astro';
import TalkList from './TalkList.astro';

const origin = 'https://koborin.ai';

const oracle = [
  {
    href: 'https://speakerdeck.com/coborinai/type-safe-iac-for-dart',
    event: { en: 'FlutterGakkai (10th)', ja: '第10回 FlutterGakkai' },
    meta: { en: 'Jul · 56 people · Slides', ja: '07月 · 56 人 · スライド' },
    attendees: 56,
  },
  {
    href: 'https://youtu.be/AakdczWQLzY?si=aiuon32lYmJ93TR6',
    event: { en: 'Google I/O Extended Tokyo 2025', ja: 'Google I/O Extended Tokyo 2025' },
    meta: { en: 'Jul · 434 people · Video', ja: '07月 · 434 人 · 動画' },
    attendees: 434,
  },
  {
    href: 'https://www.youtube.com/live/bLub7ytpKBA?si=rkyc3Ca76CVDn8Wa&t=518',
    event: { en: 'FlutterGakkai (7th)', ja: 'FlutterGakkai（第7回）' },
    meta: { en: 'Feb · 191 people · Video', ja: '02月 · 191 人 · 動画' },
    attendees: 191,
  },
  {
    href: 'https://gdg-tokyo.connpass.com/event/337045/',
    event: { en: 'Genkit Hands-on (Organizer)', ja: 'Genkit ハンズオン（運営）' },
    meta: { en: 'Dec · 45 people · Event', ja: '12月 · 45 人 · イベント' },
    attendees: 45,
  },
  {
    href: 'https://docs.google.com/presentation/d/10F2hjzJhdInSuhDQ8G_B2raGz79mzTRIcWU_59Zh5Y8/edit?usp=sharing',
    event: { en: 'GDG DevFest Tokyo 2024', ja: 'GDG DevFest Tokyo 2024' },
    meta: { en: 'Nov · 369 people · Slides', ja: '11月 · 369 人 · スライド' },
    attendees: 369,
  },
  {
    event: { en: 'TECH+ Seminar', ja: 'TECH+ セミナー' },
    meta: { en: 'Jun · 246 people', ja: '06月 · 246 人' },
    attendees: 246,
  },
  {
    href: 'https://cloud-ace.jp/event/240619_map-the-way-tokyo/',
    event: { en: 'Map The Way Tokyo', ja: 'Map The Way Tokyo' },
    meta: { en: 'Jun · 75 people · Event', ja: '06月 · 75 人 · イベント' },
    attendees: 75,
  },
  {
    event: { en: 'Retail DX', ja: 'リテールDX' },
    meta: { en: 'Apr · 138 people', ja: '04月 · 138 人' },
    attendees: 138,
  },
  {
    event: { en: 'Google Cloud RetailTech Recap Seminar', ja: 'Google Cloud リテールテック振り返りセミナー' },
    meta: { en: 'Apr · 51 people', ja: '04月 · 51 人' },
    attendees: 51,
  },
  {
    event: { en: 'RetailTech JAPAN', ja: 'リテールテックJAPAN' },
    meta: { en: 'Mar · 429 people', ja: '03月 · 429 人' },
    attendees: 429,
  },
  {
    href: 'https://github.com/nozomi-koborinai/gdg-tokyo-monthly-online-tech-talks-firebase',
    event: { en: 'GDG Tokyo Monthly Online Tech Talks', ja: 'GDG Tokyo Monthly Online Tech Talks' },
    meta: { en: 'Feb · 200 people · Repo', ja: '02月 · 200 人 · リポジトリ' },
    attendees: 200,
  },
  {
    event: { en: 'Cloud Ace Webinar', ja: 'Cloud Ace ウェビナー' },
    meta: { en: 'Dec · 61 people', ja: '12月 · 61 人' },
    attendees: 61,
  },
] as const;

const homeRows: Record<Locale, readonly { event: string; meta: string }[]> = {
  en: [
    { event: 'FlutterGakkai (10th)', meta: '2026/07 · Slides' },
    { event: 'Google I/O Extended Tokyo 2025', meta: '2025/07 · Video' },
    { event: 'FlutterGakkai (7th)', meta: '2025/02 · Video' },
    { event: 'GDG DevFest Tokyo 2024', meta: '2024/11 · Slides' },
  ],
  ja: [
    { event: '第10回 FlutterGakkai', meta: '2026/07 · スライド' },
    { event: 'Google I/O Extended Tokyo 2025', meta: '2025/07 · 動画' },
    { event: 'FlutterGakkai（第7回）', meta: '2025/02 · 動画' },
    { event: 'GDG DevFest Tokyo 2024', meta: '2024/11 · スライド' },
  ],
};

function linkedHref(rowHtml: string): string | undefined {
  const raw = rowHtml.match(/<a class="row" href="([^"]*)"/)?.[1];
  return raw?.replaceAll('&amp;', '&');
}

function listItems(html: string): { event: string; meta: string; html: string }[] {
  return [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => {
    const body = match[1] ?? '';
    const event = body.match(/<span class="sub">([^<]*)<\/span>/)?.[1] ?? '';
    const meta = body.match(/<span class="meta">([^<]*)<\/span>/)?.[1] ?? '';
    return { event, meta, html: body };
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

const sample: Talk = {
  date: '2020/09',
  year: 2020,
  event: { en: 'Sample Night', ja: 'Sample Night' },
  title: { en: 'A short note', ja: 'A short note' },
  onHome: false,
};

describe('talk meta line', () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create({ astroConfig: { site: origin } });
  });

  describe.each(['en', 'ja'] as const)('%s talks list', (locale) => {
    it('shows month, audience, and destination on each event row', async () => {
      const prefix = locale === 'ja' ? '/ja' : '';
      const html = await container.renderToString(ListView, {
        props: { kind: 'talks', locale },
        request: new Request(`${origin}${prefix}/talks/`),
      });
      const rows = listItems(html);
      expect(rows).toHaveLength(oracle.length);
      expect(html.match(/<a class="row"/g)).toHaveLength(7);

      for (const row of oracle) {
        const matches = rows.filter((item) => item.event === row.event[locale]);
        expect(matches, row.event[locale]).toHaveLength(1);
        expect(matches[0]?.meta).toBe(row.meta[locale]);
        expect(linkedHref(matches[0]?.html ?? '')).toBe('href' in row ? row.href : undefined);
      }
    });
  });

  describe.each(['en', 'ja'] as const)('%s home', (locale) => {
    it('shows date and destination without a count', async () => {
      const prefix = locale === 'ja' ? '/ja' : '';
      const html = await container.renderToString(HomePage, {
        props: { locale },
        request: new Request(`${origin}${prefix}/`),
      });
      const slice = homeTalksSlice(html, locale);

      expect(listItems(slice).map(({ event, meta }) => ({ event, meta }))).toEqual(homeRows[locale]);
      for (const row of oracle) {
        expect(slice).not.toMatch(new RegExp(`(^|\\D)${row.attendees}(\\D|$)`));
      }
    });
  });

  it('leaves writing rows with a bare date', async () => {
    const html = await container.renderToString(QuietList, {
      props: { items: [{ title: 'Newer', href: '/life/newer/', date: '09/12' }] },
    });
    expect(listItems(html).map((item) => item.meta)).toEqual(['09/12']);
  });

  it('shows only the month when a talk has no link and no audience', async () => {
    const html = await container.renderToString(TalkList, {
      props: { talks: [sample], locale: 'en', where: 'list' },
    });
    expect(listItems(html).map((item) => item.meta)).toEqual(['Sep']);
    expect(html).not.toContain('<a class="row"');
  });

  it('shows the destination without an audience', async () => {
    const html = await container.renderToString(TalkList, {
      props: { talks: [{ ...sample, link: { kind: 'video', href: 'https://example.com/v' } }], locale: 'ja', where: 'list' },
    });
    expect(listItems(html).map((item) => item.meta)).toEqual(['09月 · 動画']);
  });
});
