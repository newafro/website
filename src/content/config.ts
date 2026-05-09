import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    author: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    hero_image: z.string().optional(),
    hero_alt: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    hero_image: z.string().optional(),
    order: z.number().default(0),
  }),
});

export const collections = { blog, pages };
