#!/usr/bin/env node
// Capture a browser-viewable visual reference pack for the live Wix site.
//
// Default: main public pages only.
//   npm run capture:wix-reference
//
// Full sitemap mode:
//   npm run capture:wix-reference:all

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NET_BASE = (process.env.NET_BASE || 'https://www.newafro.net').replace(/\/$/, '');
const OUT_DIR = path.resolve(ROOT, process.env.REFERENCE_OUT || 'public/reference/newafro-net');
const SCOPE = process.env.REFERENCE_SCOPE || 'pages';
const LIMIT = Number(process.env.REFERENCE_LIMIT || 0);
const CAPTURED_AT = new Date().toISOString();

const STATIC_PAGES = [
  { key: 'home', category: 'Main pages', title: 'Home', path: '/' },
  { key: 'agency', category: 'Main pages', title: 'The Agency', path: '/general-1' },
  { key: 'community', category: 'Main pages', title: 'Community', path: '/community' },
  { key: 'archive', category: 'Main pages', title: 'The Archive', path: '/behind-the-scenes' },
  { key: 'projects', category: 'Main pages', title: 'Projects', path: '/single-project' },
  { key: 'events', category: 'Main pages', title: 'Events', path: '/events' },
  { key: 'showroom', category: 'Main pages', title: 'Showroom', path: '/showroom' },
  { key: 'about', category: 'Main pages', title: 'About', path: '/about' },
  { key: 'artist-inquiries', category: 'Main pages', title: 'Artist Inquiries', path: '/general-8' },
  { key: 'career', category: 'Main pages', title: 'Career', path: '/career' },
  { key: 'contact', category: 'Main pages', title: 'Contact', path: '/contact-7' },
  { key: 'privacy-policy', category: 'Main pages', title: 'Privacy Policy', path: '/privacy-policy' },
  { key: 'terms-and-conditions', category: 'Main pages', title: 'Terms and Conditions', path: '/terms-and-conditions' },
];

const SITEMAP_INDEX = `${NET_BASE}/sitemap.xml`;

const VIEWPORTS = [
  { key: 'desktop', label: 'Desktop 1440px', width: 1440, height: 1000, mobile: false },
  { key: 'mobile', label: 'Mobile 390px', width: 390, height: 844, mobile: true },
];

function slugify(value) {
  return String(value || 'page')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'home';
}

function categoryFor(url) {
  const { pathname } = new URL(url);
  if (pathname.startsWith('/post/')) return 'Blog posts';
  if (pathname.startsWith('/event-details-registration/')) return 'Event pages';
  if (pathname.startsWith('/artists/')) return 'Artist pages';
  if (pathname.startsWith('/artworks-')) return 'Artwork pages';
  return 'Main pages';
}

function titleFor(url) {
  const { pathname } = new URL(url);
  if (pathname === '/' || pathname === '') return 'Home';
  const last = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) || 'page');
  return last
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

async function fetchXml(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'newafro-reference-capture' },
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  return response.text();
}

function locsFromXml(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

async function sitemapEntries() {
  const index = await fetchXml(SITEMAP_INDEX);
  const sitemapUrls = locsFromXml(index).filter((url) => url.endsWith('-sitemap.xml') || url.endsWith('pages-sitemap.xml'));
  const urls = [];
  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchXml(sitemapUrl);
    urls.push(...locsFromXml(xml).filter((url) => url.startsWith(NET_BASE)));
  }

  const seen = new Set();
  return urls
    .filter((url) => {
      const clean = url.replace(/\/$/, '') || NET_BASE;
      if (seen.has(clean)) return false;
      seen.add(clean);
      return true;
    })
    .map((url) => ({
      key: slugify(new URL(url).pathname || 'home'),
      category: categoryFor(url),
      title: titleFor(url),
      url,
    }));
}

async function entriesToCapture() {
  if (SCOPE === 'all') {
    const entries = await sitemapEntries();
    return LIMIT > 0 ? entries.slice(0, LIMIT) : entries;
  }

  const entries = STATIC_PAGES.map((page) => ({
    ...page,
    url: NET_BASE + page.path,
  }));
  return LIMIT > 0 ? entries.slice(0, LIMIT) : entries;
}

async function dismissCookies(page) {
  try {
    const wixAccept = page.locator('.consent-banner-root button').filter({ hasText: /^Accept$/i }).first();
    if (await wixAccept.isVisible({ timeout: 1200 })) {
      await wixAccept.click({ timeout: 1800 });
      await page.waitForTimeout(500);
      return;
    }
  } catch {
    // Continue with generic candidates.
  }

  const candidates = [
    page.getByRole('button', { name: /^Accept$/i }),
    page.getByRole('button', { name: /accept/i }),
    page.getByText(/^Accept$/i),
  ];

  for (const locator of candidates) {
    try {
      if (await locator.first().isVisible({ timeout: 900 })) {
        await locator.first().click({ timeout: 1500 });
        await page.waitForTimeout(400);
        return;
      }
    } catch {
      // Try next candidate.
    }
  }
}

async function removeCookieBanner(page) {
  await page.evaluate(() => {
    document
      .querySelectorAll('.consent-banner-root, .consent-banner-root-container, [class*="consent-banner"]')
      .forEach((element) => element.remove());
  }).catch(() => {});
}

async function waitForFontsAndMedia(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
    await Promise.all(
      [...document.images]
        .filter((image) => !image.complete)
        .slice(0, 50)
        .map((image) => new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 1800);
        }))
    );
  }).catch(() => {});
}

async function stepScroll(page) {
  const height = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  const viewport = page.viewportSize()?.height || 900;
  const step = Math.floor(viewport * 0.8);
  const maxSteps = 36;

  for (let y = 0, i = 0; y < height && i < maxSteps; y += step, i += 1) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(280);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
}

async function captureOne(context, entry, viewport) {
  const page = await context.newPage();
  const file = `${entry.key}-${viewport.key}.jpg`;
  const screenshotPath = path.join(OUT_DIR, 'screenshots', file);

  try {
    await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissCookies(page);
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    await waitForFontsAndMedia(page);
    await stepScroll(page);
    await waitForFontsAndMedia(page);
    await removeCookieBanner(page);

    await page.screenshot({
      path: screenshotPath,
      type: 'jpeg',
      quality: 78,
      fullPage: true,
      timeout: 45000,
    });

    const meta = await page.evaluate(() => ({
      finalUrl: location.href,
      title: document.title,
      width: window.innerWidth,
      height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      textSample: document.body?.innerText?.slice(0, 700) || '',
    }));

    return {
      viewport: viewport.key,
      ok: true,
      file: `screenshots/${file}`,
      ...meta,
    };
  } catch (error) {
    return {
      viewport: viewport.key,
      ok: false,
      error: error?.message || String(error),
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function captureAll(entries) {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
        deviceScaleFactor: 1,
        userAgent: `Mozilla/5.0 (newafro-reference-pack; ${viewport.key}) AppleWebKit/537.36 Chrome/120 Safari/537.36`,
      });

      for (const [index, entry] of entries.entries()) {
        process.stderr.write(`[reference] ${viewport.key} ${String(index + 1).padStart(2, '0')}/${entries.length} ${entry.title}\n`);
        const existing = results.find((item) => item.key === entry.key);
        const pageResult = existing || { ...entry, captures: [] };
        pageResult.captures.push(await captureOne(context, entry, viewport));
        if (!existing) results.push(pageResult);
      }

      await context.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return results;
}

function grouped(results) {
  const groups = new Map();
  for (const result of results) {
    if (!groups.has(result.category)) groups.set(result.category, []);
    groups.get(result.category).push(result);
  }
  return [...groups.entries()];
}

function renderHtml(results) {
  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const nav = grouped(results).map(([category, pages]) =>
    `<a href="#${slugify(category)}">${esc(category)} <span>${pages.length}</span></a>`
  ).join('');

  const sections = grouped(results).map(([category, pages]) => `
    <section id="${slugify(category)}">
      <h2>${esc(category)}</h2>
      <div class="pages">
        ${pages.map((page) => `
          <article class="page-card">
            <header>
              <div>
                <p class="eyebrow">${esc(page.key)}</p>
                <h3>${esc(page.title)}</h3>
              </div>
              <a class="source" href="${esc(page.url)}">Open Wix source</a>
            </header>
            <div class="shots">
              ${VIEWPORTS.map((viewport) => {
                const shot = page.captures.find((capture) => capture.viewport === viewport.key);
                if (!shot?.ok) {
                  return `<div class="shot broken"><strong>${esc(viewport.label)}</strong><p>${esc(shot?.error || 'Capture failed')}</p></div>`;
                }
                return `<a class="shot" href="${esc(shot.file)}">
                  <strong>${esc(viewport.label)}</strong>
                  <img src="${esc(shot.file)}" alt="${esc(page.title)} ${esc(viewport.label)} full-page screenshot" loading="lazy">
                  <span>${esc(shot.height)}px tall · open full image</span>
                </a>`;
              }).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>New Afro Wix reference pack</title>
  <style>
    :root { color-scheme: light; --ink:#161616; --muted:#666; --line:#dedbd1; --paper:#f7f2e8; --panel:#fffdf8; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--paper); color: var(--ink); }
    .shell { display: grid; grid-template-columns: 230px minmax(0, 1fr); min-height: 100vh; }
    aside { position: sticky; top: 0; height: 100vh; padding: 24px 18px; border-right: 1px solid var(--line); background: #2d1a08; color: #fff7eb; }
    aside h1 { margin: 0 0 8px; font: 400 28px/1.05 Georgia, serif; }
    aside p { color: #e4d2bd; font-size: 13px; margin: 0 0 18px; }
    nav { display: grid; gap: 8px; }
    nav a { color: inherit; text-decoration: none; display: flex; justify-content: space-between; border: 1px solid rgba(255,255,255,.18); padding: 8px 10px; border-radius: 6px; }
    main { padding: 32px; max-width: 1440px; width: 100%; }
    .intro { margin-bottom: 28px; max-width: 820px; }
    .intro h2 { margin: 0 0 8px; font: italic 400 54px/1 Georgia, serif; }
    .intro p { margin: 0; color: var(--muted); }
    section { margin: 0 0 42px; }
    section > h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid var(--line); padding-bottom: 8px; color: #6c4c2d; }
    .pages { display: grid; gap: 24px; }
    .page-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; }
    .page-card header { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 14px; }
    .eyebrow { margin: 0 0 2px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    h3 { margin: 0; font-size: 24px; }
    .source { color: #5d3412; text-decoration: underline; white-space: nowrap; }
    .shots { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 390px); gap: 16px; align-items: start; }
    .shot { display: grid; gap: 8px; color: inherit; text-decoration: none; }
    .shot strong { font-size: 13px; color: #563a20; }
    .shot span, .shot p { color: var(--muted); font-size: 12px; margin: 0; }
    .shot img { width: 100%; display: block; border: 1px solid var(--line); background: #fff; object-fit: cover; object-position: top; max-height: 720px; }
    .shot.broken { border: 1px dashed #b85c38; padding: 12px; min-height: 160px; }
    footer { color: var(--muted); padding: 24px 0 8px; border-top: 1px solid var(--line); }
    @media (max-width: 900px) {
      .shell { display: block; }
      aside { position: static; height: auto; }
      main { padding: 20px; }
      .shots { grid-template-columns: 1fr; }
      .page-card header { display: block; }
      .source { display: inline-block; margin-top: 8px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <h1>New Afro Wix Reference</h1>
      <p>Source screenshots from ${esc(NET_BASE)}. Captured ${esc(CAPTURED_AT)}.</p>
      <nav>${nav}</nav>
    </aside>
    <main>
      <div class="intro">
        <h2>Visual source of truth</h2>
        <p>This is a static screenshot pack for design review. Open any image to inspect the full-page reference. It captures Wix as rendered in Chromium after cookie dismissal, lazy-load scrolling, and font/media waits.</p>
      </div>
      ${sections}
      <footer>
        Scope: ${esc(SCOPE)} · Pages: ${results.length} · Viewports: ${VIEWPORTS.map((v) => esc(v.key)).join(', ')}
      </footer>
    </main>
  </div>
</body>
</html>`;
}

async function main() {
  const entries = await entriesToCapture();
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(path.join(OUT_DIR, 'screenshots'), { recursive: true });

  process.stderr.write(`[reference] capturing ${entries.length} pages from ${NET_BASE} (scope=${SCOPE})\n`);
  const results = await captureAll(entries);
  const manifest = {
    source: NET_BASE,
    capturedAt: CAPTURED_AT,
    scope: SCOPE,
    pageCount: results.length,
    viewports: VIEWPORTS,
    pages: results,
  };

  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(OUT_DIR, 'gallery.html'), renderHtml(results));

  const failures = results.flatMap((page) => page.captures.filter((capture) => !capture.ok).map((capture) => `${page.key}/${capture.viewport}: ${capture.error}`));
  process.stderr.write(`[reference] wrote ${path.relative(ROOT, OUT_DIR)}/gallery.html\n`);
  if (failures.length) {
    process.stderr.write(`[reference] ${failures.length} capture failures:\n`);
    for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
