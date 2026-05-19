// @ts-check
import { defineConfig } from 'astro/config';

// DEPLOY_TARGET=apex serves the production custom domain from the root path.
// Default serves local/subpath previews from https://newafro.github.io/website/.
const DEPLOY_TARGET = process.env.DEPLOY_TARGET ?? 'subpath';
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
