// @ts-check
import { defineConfig } from 'astro/config';

// DEPLOY_TARGET=apex once newafro.net DNS points at GitHub Pages.
// Default serves from https://newafro.github.io/website/.
const DEPLOY_TARGET = process.env.DEPLOY_TARGET ?? 'subpath';
const isApex = DEPLOY_TARGET === 'apex';

export default defineConfig({
  site: isApex ? 'https://newafro.net' : 'https://newafro.github.io',
  base: isApex ? '/' : '/website/',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
