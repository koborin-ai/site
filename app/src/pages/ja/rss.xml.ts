import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

const SITE_URL = 'https://koborin.ai';

/**
 * Generates RSS feed for Japanese articles.
 * Includes ja/tech/ and ja/life/ categories, excludes ja/about-me/.
 */
export async function GET(context: APIContext) {
  const docs = await getCollection('docs', ({ data }) => !data.draft);

  // Filter Japanese articles (starting with ja/) and blog categories only
  const articles = docs.filter((doc) => {
    const isJapanese = doc.id.startsWith('ja/');
    const path = doc.id.replace(/^ja\//, '');
    const isBlogCategory = path.startsWith('tech/') || path.startsWith('life/');
    return isJapanese && isBlogCategory;
  });

  // Sort by publishedAt date (newest first)
  const sortedArticles = articles.sort((a, b) => {
    const dateA = a.data.publishedAt?.getTime() ?? 0;
    const dateB = b.data.publishedAt?.getTime() ?? 0;
    return dateB - dateA;
  });

  return rss({
    title: 'koborin.ai',
    description: 'Personal site + technical garden (日本語)',
    site: context.site ?? SITE_URL,
    items: sortedArticles.map((article) => ({
      title: article.data.title,
      description: article.data.description ?? '',
      pubDate: article.data.publishedAt ?? new Date(),
      link: `${SITE_URL}/${article.slug}/`,
    })),
  });
}

