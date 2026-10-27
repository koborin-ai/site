import { localeOf, slugParam, type Locale } from './docs';

export type OgCardPath = `/og/${string}.webp`;

export interface OgCard {
  readonly title: string;
  readonly locale: Locale;
  readonly publishedAt: Date;
}

export interface OgSource {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly publishedAt?: Date;
    readonly ogImage?: string;
  };
}

export function articleCard(entry: OgSource): { readonly path: OgCardPath; readonly card: OgCard } | undefined {
  const { publishedAt, title } = entry.data;
  const slug = slugParam(entry.id);
  if (!publishedAt || slug === undefined) return undefined;
  return {
    path: `/og/${slug}.webp`,
    card: { title, locale: localeOf(entry.id), publishedAt },
  };
}

export function ogImageFor(entry: OgSource): string | undefined {
  return articleCard(entry)?.path ?? entry.data.ogImage;
}
