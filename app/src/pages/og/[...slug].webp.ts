import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { ogCards, type OgCard } from '../../lib/og';
import { renderOgCard } from '../../lib/og-render';

export const getStaticPaths = (async () => {
  const docs = await getCollection('docs', (doc) => import.meta.env.DEV || !doc.data.draft);
  return ogCards(docs).map(({ slug, card }) => ({ params: { slug }, props: { card } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ card: OgCard }> = async ({ props }) =>
  new Response(await renderOgCard(props.card), {
    headers: { 'Content-Type': 'image/webp' },
  });
