import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const collections = {
  docs: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
    schema: z
      .object({
        title: z.string(),
        description: z.string(),
        ogImage: z.string().optional(),
        publishedAt: z.coerce.date().optional(),
        engagement: z.boolean().optional(),
        draft: z.boolean().optional().default(false),
        lastUpdated: z.boolean().optional(),
      })
      .refine((data) => !(data.publishedAt && data.ogImage), {
        path: ['ogImage'],
        message: 'Articles get a generated card at /og/<page path>.webp. Remove ogImage.',
      }),
  }),
};
