# newafro.com

Static site for [newafro.com](https://newafro.com) — Astro + Decap CMS, deployed to GitHub Pages.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # production static build → dist/
npm run preview  # preview built site
```

Requires Node 20+.

## Structure

```
public/admin/      Decap CMS configuration
public/uploads/    CMS-managed images
src/content/       blog posts + page content (markdown)
src/pages/         routes, including the /admin/ studio entry
src/components/    Header, Footer, Hero, BlogCard, ...
src/layouts/       BaseLayout, PageLayout, BlogPost
src/styles/        design tokens + global styles
```

## Edit content

- Editors: open `/admin/` (after OAuth proxy is configured) and edit through the CMS UI.
- Developers: edit markdown under `src/content/` and push to `main`.

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds Astro for `https://newafro.com` and publishes to GitHub Pages.

Local/default builds also use the apex/root domain shape. To build the legacy GitHub Pages subpath preview explicitly:

```bash
DEPLOY_TARGET=subpath SITE_URL=https://newafro.github.io npm run build
```
