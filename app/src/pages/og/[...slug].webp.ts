import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { articleCard, type OgCard } from '../../lib/og';
import { renderOgCard } from '../../lib/og-render';

export const getStaticPaths = (async () => {
  const docs = await getCollection('docs', (doc) => import.meta.env.DEV || !doc.data.draft);
  return docs.flatMap((doc) => {
    const article = articleCard(doc);
    if (!article) return [];
    const slug = article.path.slice('/og/'.length, -'.webp'.length);
    return [{ params: { slug }, props: { card: article.card } }];
  });
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ card: OgCard }> = async ({ props }) =>
  new Response(await renderOgCard(props.card), {
    headers: { 'Content-Type': 'image/webp' },
  });
