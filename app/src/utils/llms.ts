import { getCollection } from 'astro:content';
import { categoryOf, localeOf, publicPath } from '../lib/docs';

export type Lang = 'en' | 'ja';
export type Category = 'tech' | 'life' | 'all';

const SITE_URL = 'https://koborin.ai';

/** Subset of a docs collection entry that llms.txt rendering depends on. */
export interface LlmsEntry {
  id: string;
  body?: string;
  data: { title: string };
}

/**
 * Renders llms.txt content for the specified language and category.
 * Includes article body (Markdown) for each entry.
 */
export function renderLlmsContent(
  entries: readonly LlmsEntry[],
  lang: Lang,
  category: Category
): string {
  const filtered = entries.filter((entry) => {
    if (localeOf(entry.id) !== lang) return false;
    if (category === 'all') return true;
    return categoryOf(entry.id) === category;
  });

  const rendered = filtered.map((entry) => {
    const url = new URL(publicPath(entry.id), SITE_URL).href;
    return `## ${entry.data.title}\nURL: ${url}\n\n${entry.body}`;
  });

  const langLabel = lang.toUpperCase();
  const categoryLabel = category !== 'all' ? ` / ${category}` : '';
  const today = new Date().toISOString().slice(0, 10);
  const header = `# koborin.ai - ${langLabel}${categoryLabel}\n> Last updated: ${today}\n`;

  return header + '\n' + rendered.join('\n---\n\n');
}

/**
 * Loads published docs and renders llms.txt content for them.
 */
export async function getLlmsContent(
  lang: Lang,
  category: Category
): Promise<string> {
  const docs = await getCollection('docs', ({ data }) => !data.draft);
  return renderLlmsContent(docs, lang, category);
}

/**
 * Creates a plain text Response with UTF-8 encoding.
 */
export function textResponse(body: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
