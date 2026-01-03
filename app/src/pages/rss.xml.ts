import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

const SITE_URL = 'https://koborin.ai';

/**
 * Generates RSS feed for English articles.
 * Includes tech/ and life/ categories, excludes about-me/.
 */
export async function GET(context: APIContext) {
  const docs = await getCollection('docs', ({ data }) => !data.draft);

  // Filter English articles (not starting with ja/) and blog categories only
  const articles = docs.filter((doc) => {
    const isEnglish = !doc.id.startsWith('ja/');
    const isBlogCategory =
      doc.id.startsWith('tech/') || doc.id.startsWith('life/');
    return isEnglish && isBlogCategory;
  });

  // Sort by publishedAt date (newest first)
  const sortedArticles = articles.sort((a, b) => {
    const dateA = a.data.publishedAt?.getTime() ?? 0;
    const dateB = b.data.publishedAt?.getTime() ?? 0;
    return dateB - dateA;
  });

  return rss({
    title: 'koborin.ai',
    description: 'Personal site + technical garden',
    site: context.site ?? SITE_URL,
    items: sortedArticles.map((article) => ({
      title: article.data.title,
      description: article.data.description ?? '',
      pubDate: article.data.publishedAt ?? new Date(),
      link: `${SITE_URL}/${article.slug}/`,
    })),
  });
}

