import { isAboutId, isHomeId } from './catalog';
import { localeOf, slugParam, type Locale } from './docs';

export const OG_SIZE = { width: 1200, height: 630 } as const;

export type OgCardPath = `/og/${string}.webp`;

export type OgImageHref = OgCardPath | `${OgCardPath}?v=${number}`;

export type OgCard =
  | {
      readonly kind: 'article';
      readonly title: string;
      readonly locale: Locale;
      readonly publishedAt: Date;
    }
  | {
      readonly kind: 'site';
      readonly tagline?: 'Personal site and technical proving ground';
    };

type SiteOgCard = Extract<OgCard, { kind: 'site' }>;

export interface OgCardRoute {
  readonly slug: string;
  readonly path: OgCardPath;
  readonly card: OgCard;
}

export interface OgSource {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly publishedAt?: Date;
  };
}

interface SiteCard {
  readonly path: OgCardPath;
  readonly version: number;
  readonly card: SiteOgCard;
}

/** X and Slack cache a card by its URL, so bump `version` whenever a card here is drawn differently. */
const SITE_CARDS = {
  home: {
    path: '/og/koborin-ai-hero.webp',
    version: 2,
    card: { kind: 'site', tagline: 'Personal site and technical proving ground' },
  },
  fallback: {
    path: '/og/index.webp',
    version: 2,
    card: { kind: 'site' },
  },
} as const satisfies Record<'home' | 'fallback', SiteCard>;

function route(path: OgCardPath, card: OgCard): OgCardRoute {
  return { slug: path.slice('/og/'.length, -'.webp'.length), path, card };
}

function articleCard(entry: OgSource): OgCardRoute | undefined {
  const { publishedAt, title } = entry.data;
  const slug = slugParam(entry.id);
  if (!publishedAt || slug === undefined) return undefined;
  return route(`/og/${slug}.webp`, { kind: 'article', title, locale: localeOf(entry.id), publishedAt });
}

export function ogCards(docs: readonly OgSource[]): OgCardRoute[] {
  return [
    ...docs.flatMap((doc) => articleCard(doc) ?? []),
    ...Object.values(SITE_CARDS).map(({ path, card }) => route(path, card)),
  ];
}

export function ogImageFor(entry: OgSource | undefined): OgImageHref {
  const article = entry && articleCard(entry);
  if (article) return article.path;
  const site = entry && (isHomeId(entry.id) || isAboutId(entry.id)) ? SITE_CARDS.home : SITE_CARDS.fallback;
  return `${site.path}?v=${site.version}`;
}
