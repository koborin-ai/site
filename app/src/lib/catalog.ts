import { categoryOf, localeOf, publicPath, type Locale } from './docs';

export const homeLimit = 4;

export const bio = {
  en: {
    before: "Software engineer. I build developer tools in the open, and right now that's ",
    after: '.',
  },
  ja: {
    before: 'ソフトウェアエンジニア。開発者向けのツールを公開しながら作っていて、いまは ',
    after: ' に取り組んでいます。',
  },
} as const;

export const book = {
  title: 'Mastering Genkit: Go Edition',
  href: 'https://www.amazon.com/dp/B0G4HKJRPB',
  note: {
    en: 'Co-authored with Xavier Portilla.',
    ja: 'Xavier Portilla 氏との共著。',
  },
} as const;

export const sections = {
  building: { en: 'Building', ja: '作っているもの' },
  writing: { en: 'Writing', ja: '記事' },
  talks: { en: 'Talks', ja: '登壇' },
} as const;

export const linkLabel = {
  site: { en: 'Site ↗', ja: 'サイト ↗' },
  github: { en: 'GitHub ↗', ja: 'GitHub ↗' },
  all: { en: 'All →', ja: 'すべて →' },
} as const;

export const keptLabel = {
  en: 'Kept from the previous home',
  ja: '以前のホームから残している内容',
} as const;

export const listMeta = {
  writing: {
    en: { title: 'Writing', description: 'Published articles.' },
    ja: { title: '記事', description: '公開している記事。' },
  },
  talks: {
    en: { title: 'Talks', description: 'Talks and events.' },
    ja: { title: '登壇', description: '登壇とイベント。' },
  },
} as const;

export type ListKind = 'writing' | 'talks';

export interface Project {
  name: string;
  href: string;
  kind: 'site' | 'github';
  mark?: 'contextlint';
  description: Record<Locale, string>;
}

export const projects: readonly Project[] = [
  {
    name: 'TerraDart',
    href: 'https://terradart.dev/',
    kind: 'site',
    description: {
      en: 'Type-safe IaC for Dart.',
      ja: 'Dart のためのタイプセーフな IaC。',
    },
  },
  {
    name: 'contextlint',
    href: 'https://contextlint.dev/',
    kind: 'site',
    mark: 'contextlint',
    description: {
      en: 'A semantic linter for AI-era Markdown.',
      ja: 'AI 時代の Markdown のためのセマンティックリンター。',
    },
  },
  {
    name: 'gcp-cost-mcp-server',
    href: 'https://github.com/nozomi-koborinai/gcp-cost-mcp-server',
    kind: 'github',
    description: {
      en: 'An MCP server that lets AI assistants like Claude or Cursor estimate GCP running costs — instead of manually using the Google Cloud Pricing Calculator.',
      ja: 'Claude や Cursor などの AI アシスタントから、Google Cloud Pricing Calculator を手動で触る代わりに GCP のランニングコストを見積もれる MCP サーバー。',
    },
  },
  {
    name: 'ableton-osc-mcp',
    href: 'https://github.com/nozomi-koborinai/ableton-osc-mcp',
    kind: 'github',
    description: {
      en: 'An MCP (Model Context Protocol) server that lets AI assistants like Claude or Cursor drive Ableton Live 11+ via AbletonOSC.',
      ja: 'Claude や Cursor などの AI アシスタントから、AbletonOSC 経由で Ableton Live 11+ を操作できる MCP (Model Context Protocol) サーバー。',
    },
  },
  {
    name: 'jev-spec',
    href: 'https://github.com/nozomi-koborinai/jev-spec',
    kind: 'github',
    description: {
      en: 'Catch spec drift on every commit.',
      ja: '仕様書とコードのずれを、コミットのたびに検出する。',
    },
  },
];

export interface Talk {
  date: string;
  year: number;
  event: Record<Locale, string>;
  title: Record<Locale, string>;
  href?: string;
}

function talk(
  date: string,
  event: Record<Locale, string>,
  title: Record<Locale, string>,
  href?: string,
): Talk {
  return {
    date,
    year: Number(date.slice(0, 4)),
    event,
    title,
    ...(href ? { href } : {}),
  };
}

export const talks: readonly Talk[] = [
  talk(
    '2026/07',
    { en: 'FlutterGakkai (10th)', ja: '第10回 FlutterGakkai' },
    { en: 'Trying Type-safe IaC with Dart', ja: 'Dart で試す Type-safe IaC' },
    'https://speakerdeck.com/coborinai/type-safe-iac-for-dart',
  ),
  talk(
    '2025/07',
    { en: 'Google I/O Extended Tokyo 2025', ja: 'Google I/O Extended Tokyo 2025' },
    {
      en: 'Dart client for Genkit: Official Client for Using Genkit from Flutter',
      ja: 'Dart client for Genkit: Flutter から Genkit を使うための公式クライアント開発',
    },
    'https://youtu.be/AakdczWQLzY?si=aiuon32lYmJ93TR6',
  ),
  talk(
    '2025/02',
    { en: 'FlutterGakkai (7th)', ja: 'FlutterGakkai（第7回）' },
    {
      en: 'Accelerating Generative AI App Development with Flutter × Firebase Genkit',
      ja: 'Flutter × Firebase Genkit で加速する生成 AI アプリ開発',
    },
    'https://www.youtube.com/live/bLub7ytpKBA?si=rkyc3Ca76CVDn8Wa&t=518',
  ),
  talk(
    '2024/12',
    { en: 'Genkit Hands-on (Organizer)', ja: 'Genkit ハンズオン（運営）' },
    { en: 'Technical supporter', ja: 'テクニカルサポーターとして参加' },
  ),
  talk(
    '2024/11',
    { en: 'GDG DevFest Tokyo 2024', ja: 'GDG DevFest Tokyo 2024' },
    {
      en: 'Orchestrating Firebase and AI: Genkit Architecture Example',
      ja: 'Orchestrating Firebase and AI: Genkit architecture example',
    },
  ),
  talk(
    '2024/06',
    { en: 'TECH+ Seminar', ja: 'TECH+ セミナー' },
    {
      en: 'Revolutionizing Logistics with Google Maps Platform',
      ja: 'Google Maps Platform で物流業界を革新！効率化とコスト削減を実現',
    },
  ),
  talk(
    '2024/06',
    { en: 'Map The Way Tokyo', ja: 'Map The Way Tokyo' },
    {
      en: 'Retail DX Strategy for Competitive Advantage',
      ja: '競争力を高めるリテール DX 戦略',
    },
  ),
  talk(
    '2024/04',
    { en: 'Retail DX', ja: 'リテールDX' },
    {
      en: 'Retail DX Strategy for Competitive Advantage',
      ja: '競争力を高めるリテール DX 戦略',
    },
  ),
  talk(
    '2024/04',
    { en: 'Google Cloud RetailTech Recap Seminar', ja: 'Google Cloud リテールテック振り返りセミナー' },
    {
      en: 'Integrating Google Maps, Firebase, and PaLM',
      ja: 'Google Maps・Firebase・PaLM の技術統合',
    },
  ),
  talk(
    '2024/03',
    { en: 'RetailTech JAPAN', ja: 'リテールテックJAPAN' },
    {
      en: 'Enhancing Development Efficiency with Google Maps, Firebase, and PaLM Integration',
      ja: 'Google Maps・Firebase・PaLM の技術統合による開発効率と柔軟性の向上',
    },
  ),
  talk(
    '2024/02',
    { en: 'GDG Tokyo Monthly Online Tech Talks', ja: 'GDG Tokyo Monthly Online Tech Talks' },
    {
      en: 'IaC and CI/CD Pipeline Construction in Firebase',
      ja: 'Firebase における IaC と CI/CD パイプライン構築のすゝめ',
    },
  ),
  talk(
    '2023/12',
    { en: 'Cloud Ace Webinar', ja: 'Cloud Ace ウェビナー' },
    {
      en: 'Rapid Development of a Healthy Review App with Firebase × Google Maps API',
      ja: 'Firebase × Google Maps API で健全なクチコミアプリを爆速開発！',
    },
  ),
];

export interface PostSource {
  id: string;
  data: {
    title: string;
    publishedAt?: Date;
    draft?: boolean;
  };
}

export interface PostItem {
  title: string;
  href: string;
  publishedAt: Date;
  year: number;
  dateLabel: string;
}

export function writingPosts(docs: readonly PostSource[], locale: Locale): PostItem[] {
  return docs
    .filter((doc) => localeOf(doc.id) === locale)
    .filter((doc) => categoryOf(doc.id) !== undefined)
    .filter((doc) => doc.data.publishedAt instanceof Date && doc.data.draft !== true)
    .map((doc) => {
      const publishedAt = doc.data.publishedAt as Date;
      return {
        title: doc.data.title,
        href: publicPath(doc.id),
        publishedAt,
        year: publishedAt.getUTCFullYear(),
        dateLabel: publishedAt.toISOString().slice(0, 10),
      };
    })
    .toSorted((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.href.localeCompare(b.href));
}

export function groupByYear<T extends { year: number }>(items: readonly T[]): { year: number; items: T[] }[] {
  const groups: { year: number; items: T[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.year === item.year) last.items.push(item);
    else groups.push({ year: item.year, items: [item] });
  }
  return groups;
}

export function listHref(kind: ListKind, locale: Locale): string {
  const slug = kind === 'writing' ? 'blog' : 'talks';
  return locale === 'ja' ? `/ja/${slug}/` : `/${slug}/`;
}

export function listHreflang(kind: ListKind, origin: string): { hreflang: string; href: string }[] {
  const en = new URL(listHref(kind, 'en'), origin).href;
  const ja = new URL(listHref(kind, 'ja'), origin).href;
  return [
    { hreflang: 'en', href: en },
    { hreflang: 'ja', href: ja },
    { hreflang: 'x-default', href: en },
  ];
}

export function isHomeId(id: string): boolean {
  return id === 'index' || id === 'ja' || id === 'ja/index';
}
