import { getCollection } from 'astro:content';

export type Lang = 'en' | 'ja';
export type Category = 'tech' | 'life' | 'about-me' | 'all';

const SITE_URL = 'https://koborin.ai';

/**
 * Generates llms.txt content for the specified language and category.
 * Includes article body (Markdown) for each entry.
 */
export async function getLlmsContent(
  lang: Lang,
  category: Category
): Promise<string> {
  const docs = await getCollection('docs', ({ data }) => !data.draft);

  const isJa = lang === 'ja';
  const filtered = docs.filter((doc) => {
    const matchLang = isJa
      ? doc.id.startsWith('ja/')
      : !doc.id.startsWith('ja/');
    if (!matchLang) return false;
    if (category === 'all') return true;
    // Extract category from path: "tech/foo" or "ja/tech/foo"
    const path = isJa ? doc.id.replace(/^ja\//, '') : doc.id;
    return path.startsWith(`${category}/`);
  });

  const entries = filtered.map((doc) => {
    const url = `${SITE_URL}/${doc.slug}/`;
    return `## ${doc.data.title}\nURL: ${url}\n\n${doc.body}`;
  });

  const langLabel = lang.toUpperCase();
  const categoryLabel = category !== 'all' ? ` / ${category}` : '';
  const today = new Date().toISOString().slice(0, 10);
  const header = `# koborin.ai - ${langLabel}${categoryLabel}\n> Last updated: ${today}\n`;

  return header + '\n' + entries.join('\n---\n\n');
}

/**
 * Creates a plain text Response with UTF-8 encoding.
 */
export function textResponse(body: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

