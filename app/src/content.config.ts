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
        publishedAt: z.coerce.date().optional(),
        engagement: z.boolean().optional(),
        draft: z.boolean().optional().default(false),
        lastUpdated: z.boolean().optional(),
      })
      .strict(),
  }),
};
