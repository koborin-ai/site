import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { categoryOf, localeOf, publicPath } from '../lib/docs';

const SITE_URL = 'https://koborin.ai';

/**
 * Generates RSS feed for English articles.
 * Includes tech/ and life/ articles, served under /blog/.
 */
export async function GET(context: APIContext) {
  const docs = await getCollection('docs', ({ data }) => !data.draft);

  const articles = docs.filter(
    (doc) => localeOf(doc.id) === 'en' && categoryOf(doc.id) !== undefined,
  );

  // Sort by publishedAt date (newest first)
  const sortedArticles = articles.toSorted((a, b) => {
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
      link: new URL(publicPath(article.id), SITE_URL).href,
    })),
  });
}

