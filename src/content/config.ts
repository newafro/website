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

const events = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date_label: z.string(),
    start_date: z.coerce.date(),
    location: z.string(),
    city: z.string().optional(),
    status: z.enum(['open', 'learn_more', 'closed', 'sold_out', 'cancelled']).default('learn_more'),
    cta_label: z.string().optional(),
    cta_url: z.string().optional(),
    hero_image: z.string().optional(),
    hero_alt: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    body_ready: z.boolean().default(false),
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

const artists = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    role: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    disciplines: z.array(z.string()).default([]),
    portrait: z.string().optional(),
    portrait_alt: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    short_bio: z.string(),
    website: z.string().optional(),
    instagram: z.string().optional(),
    featured: z.boolean().default(true),
    order: z.number().default(0),
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

export const collections = { blog, events, artists, pages };
