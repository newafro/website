# newafro.net

Static site for [newafro.net](https://newafro.net) — Astro + Decap CMS, deployed to GitHub Pages.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static build → dist/
npm run preview  # preview built site
```

Requires Node 20+.

## Structure

```
public/admin/      Decap CMS (config.yml + index.html)
public/uploads/    CMS-managed images
src/content/       blog posts + page content (markdown)
src/pages/         routes
src/components/    Header, Footer, Hero, BlogCard, ...
src/layouts/       BaseLayout, PageLayout, BlogPost
src/styles/        design tokens + global styles
```

## Edit content

- Editors: open `/admin/` (after OAuth proxy is configured) and edit through the CMS UI.
- Developers: edit markdown under `src/content/` and push to `main`.

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml` which builds Astro and publishes to GitHub Pages.

The site builds for the GitHub Pages subpath by default. To build for the apex domain:

```bash
DEPLOY_TARGET=apex npm run build
```
