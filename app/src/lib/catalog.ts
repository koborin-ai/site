import { categoryOf, localeOf, publicPath, type Locale } from './docs';

export const homeLimit = 4;

export const bio = {
  en: {
    before: "Software engineer. I build developer tools in the open, and right now that's ",
    after: '.',
  },
  ja: {
    before: 'ソフトウェアエンジニア。開発者向けのツールを公開しながら作っていて、いまは',
    after: 'に取り組んでいます。',
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
  building: { en: 'More on GitHub ↗', ja: 'ほかは GitHub で ↗' },
  writing: { en: 'All writing →', ja: '記事をすべて →' },
  talks: { en: 'All talks →', ja: '登壇をすべて →' },
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

export type BrandMark = 'terradart' | 'contextlint';

export interface Project {
  name: string;
  href: string;
  mark?: BrandMark;
  description: Record<Locale, string>;
}

export const projects: readonly Project[] = [
  {
    name: 'TerraDart',
    href: 'https://terradart.dev/',
    mark: 'terradart',
    description: {
      en: 'Type-safe IaC for Dart.',
      ja: 'Dart のためのタイプセーフな IaC。',
    },
  },
  {
    name: 'contextlint',
    href: 'https://contextlint.dev/',
    mark: 'contextlint',
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
];

export interface Talk {
  date: string;
  year: number;
  event: Record<Locale, string>;
  title: Record<Locale, string>;
  href?: string;
  attendees?: number;
  onHome: boolean;
}

function talk(input: {
  date: string;
  event: Record<Locale, string>;
  title: Record<Locale, string>;
  href?: string;
  onHome?: boolean;
  attendees?: number;
}): Talk {
  const { date, event, title, href, onHome = true, attendees } = input;
  if (attendees !== undefined && (!Number.isInteger(attendees) || attendees < 1)) {
    throw new Error(`${date}: attendee count must be a positive integer`);
  }
  return {
    date,
    year: Number(date.slice(0, 4)),
    event,
    title,
    onHome,
    ...(href ? { href } : {}),
    ...(attendees !== undefined ? { attendees } : {}),
  };
}

export const talks: readonly Talk[] = [
  talk({
    date: '2026/07',
    event: { en: 'FlutterGakkai (10th)', ja: '第10回 FlutterGakkai' },
    title: { en: 'Trying Type-safe IaC with Dart', ja: 'Dart で試す Type-safe IaC' },
    href: 'https://speakerdeck.com/coborinai/type-safe-iac-for-dart',
    attendees: 56,
  }),
  talk({
    date: '2025/07',
    event: { en: 'Google I/O Extended Tokyo 2025', ja: 'Google I/O Extended Tokyo 2025' },
    title: {
      en: 'Dart client for Genkit: Official Client for Using Genkit from Flutter',
      ja: 'Dart client for Genkit: Flutter から Genkit を使うための公式クライアント開発',
    },
    href: 'https://youtu.be/AakdczWQLzY?si=aiuon32lYmJ93TR6',
    attendees: 434,
  }),
  talk({
    date: '2025/02',
    event: { en: 'FlutterGakkai (7th)', ja: 'FlutterGakkai（第7回）' },
    title: {
      en: 'Accelerating Generative AI App Development with Flutter × Firebase Genkit',
      ja: 'Flutter × Firebase Genkit で加速する生成 AI アプリ開発',
    },
    href: 'https://www.youtube.com/live/bLub7ytpKBA?si=rkyc3Ca76CVDn8Wa&t=518',
    attendees: 191,
  }),
  talk({
    date: '2024/12',
    event: { en: 'Genkit Hands-on (Organizer)', ja: 'Genkit ハンズオン（運営）' },
    title: { en: 'Technical supporter', ja: 'テクニカルサポーターとして参加' },
    href: 'https://gdg-tokyo.connpass.com/event/337045/',
    onHome: false,
    attendees: 45,
  }),
  talk({
    date: '2024/11',
    event: { en: 'GDG DevFest Tokyo 2024', ja: 'GDG DevFest Tokyo 2024' },
    title: {
      en: 'Orchestrating Firebase and AI: Genkit Architecture Example',
      ja: 'Orchestrating Firebase and AI: Genkit architecture example',
    },
    href: 'https://docs.google.com/presentation/d/10F2hjzJhdInSuhDQ8G_B2raGz79mzTRIcWU_59Zh5Y8/edit?usp=sharing',
    attendees: 369,
  }),
  talk({
    date: '2024/06',
    event: { en: 'TECH+ Seminar', ja: 'TECH+ セミナー' },
    title: {
      en: 'Revolutionizing Logistics with Google Maps Platform',
      ja: 'Google Maps Platform で物流業界を革新！効率化とコスト削減を実現',
    },
    attendees: 246,
  }),
  talk({
    date: '2024/06',
    event: { en: 'Map The Way Tokyo', ja: 'Map The Way Tokyo' },
    title: {
      en: 'Retail DX Strategy for Competitive Advantage',
      ja: '競争力を高めるリテール DX 戦略',
    },
    href: 'https://cloud-ace.jp/event/240619_map-the-way-tokyo/',
    attendees: 75,
  }),
  talk({
    date: '2024/04',
    event: { en: 'Retail DX', ja: 'リテールDX' },
    title: {
      en: 'Retail DX Strategy for Competitive Advantage',
      ja: '競争力を高めるリテール DX 戦略',
    },
    attendees: 138,
  }),
  talk({
    date: '2024/04',
    event: { en: 'Google Cloud RetailTech Recap Seminar', ja: 'Google Cloud リテールテック振り返りセミナー' },
    title: {
      en: 'Integrating Google Maps, Firebase, and PaLM',
      ja: 'Google Maps・Firebase・PaLM の技術統合',
    },
    attendees: 51,
  }),
  talk({
    date: '2024/03',
    event: { en: 'RetailTech JAPAN', ja: 'リテールテックJAPAN' },
    title: {
      en: 'Enhancing Development Efficiency with Google Maps, Firebase, and PaLM Integration',
      ja: 'Google Maps・Firebase・PaLM の技術統合による開発効率と柔軟性の向上',
    },
    attendees: 429,
  }),
  talk({
    date: '2024/02',
    event: { en: 'GDG Tokyo Monthly Online Tech Talks', ja: 'GDG Tokyo Monthly Online Tech Talks' },
    title: {
      en: 'IaC and CI/CD Pipeline Construction in Firebase',
      ja: 'Firebase における IaC と CI/CD パイプライン構築のすゝめ',
    },
    href: 'https://github.com/nozomi-koborinai/gdg-tokyo-monthly-online-tech-talks-firebase',
    attendees: 200,
  }),
  talk({
    date: '2023/12',
    event: { en: 'Cloud Ace Webinar', ja: 'Cloud Ace ウェビナー' },
    title: {
      en: 'Rapid Development of a Healthy Review App with Firebase × Google Maps API',
      ja: 'Firebase × Google Maps API で健全なクチコミアプリを爆速開発！',
    },
    attendees: 61,
  }),
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
  monthDay: string;
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
        dateLabel: formatPostDate(publishedAt, 'home'),
        monthDay: formatPostDate(publishedAt, 'list'),
      };
    })
    .toSorted((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.href.localeCompare(b.href));
}

export function homeTalks(): readonly Talk[] {
  return talks.filter((item) => item.onHome).slice(0, homeLimit);
}

export function formatPostDate(publishedAt: Date, where: 'home' | 'list'): string {
  const [year, month, day] = publishedAt.toISOString().slice(0, 10).split('-');
  return where === 'home' ? `${year}/${month}/${day}` : `${month}/${day}`;
}

export function formatTalkDate(date: string, where: 'home' | 'list', locale: Locale): string {
  if (where === 'home') return date;
  if (locale === 'ja') return `${date.slice(5)}月`;
  const month = Number(date.slice(5, 7));
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
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

export function isAboutId(id: string): boolean {
  return id === 'about' || id === 'ja/about';
}
