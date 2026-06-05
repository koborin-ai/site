import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

const SITE_URL = 'https://koborin.ai';

/** RSS feed for the daily koborin.ai/stars newsletter (Japanese). */
export async function GET(context: APIContext) {
  const docs = await getCollection('docs', ({ data }) => !data.draft);

  const editions = docs.filter(
    (doc) => doc.id.startsWith('stars/') && doc.id !== 'stars/index',
  );

  const sorted = editions.sort((a, b) => {
    const da = a.data.publishedAt?.getTime() ?? 0;
    const db = b.data.publishedAt?.getTime() ?? 0;
    return db - da;
  });

  return rss({
    title: 'koborin.ai/stars',
    description: 'Star した OSS の毎日のパーソナル・ニュースレター',
    site: context.site ?? SITE_URL,
    items: sorted.map((edition) => ({
      title: edition.data.title,
      description: edition.data.description ?? '',
      pubDate: edition.data.publishedAt ?? new Date(),
      link: `${SITE_URL}/${edition.id}/`,
    })),
  });
}
