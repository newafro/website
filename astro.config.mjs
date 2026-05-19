// @ts-check
import { defineConfig } from 'astro/config';

// Default builds serve the production custom domain from the root path.
// Use DEPLOY_TARGET=subpath only for the legacy https://newafro.github.io/website/ preview.
const DEPLOY_TARGET = process.env.DEPLOY_TARGET ?? 'apex';
const isApex = DEPLOY_TARGET === 'apex';
const siteUrl = process.env.SITE_URL ?? (isApex ? 'https://newafro.com' : 'https://newafro.github.io');

export default defineConfig({
  site: siteUrl,
  base: isApex ? '/' : '/website/',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
