#!/usr/bin/env node
// Build a side-by-side visual parity review from the Wix reference pack.
//
// Default compares the captured newafro.net reference against preview.newafro.com:
//   npm run capture:parity-review
//
// To compare production instead:
//   COM_BASE=https://newafro.com npm run capture:parity-review

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NET_REFERENCE_DIR = path.resolve(ROOT, process.env.NET_REFERENCE_DIR || 'public/reference/newafro-net');
const NET_MANIFEST = path.join(NET_REFERENCE_DIR, 'manifest.json');
const OUT_DIR = path.resolve(ROOT, process.env.PARITY_OUT || 'public/reference/parity-review');
const COM_BASE = (process.env.COM_BASE || 'https://preview.newafro.com').replace(/\/$/, '');
const CAPTURED_AT = new Date().toISOString();
const LIMIT = Number(process.env.PARITY_LIMIT || 0);

const VIEWPORTS = [
  { key: 'desktop', label: 'Desktop 1440px', width: 1440, height: 1000, mobile: false },
  { key: 'mobile', label: 'Mobile 390px', width: 390, height: 844, mobile: true },
];

const MAIN_ROUTE_MAP = new Map([
  ['/', '/'],
  ['/career', '/career/'],
  ['/about', '/about/'],
  ['/general-1', '/agency/'],
  ['/general-8', '/artist-inquiries/'],
  ['/terms-and-conditions', '/terms-and-conditions/'],
  ['/community', '/community/'],
  ['/showroom', '/showroom/'],
  ['/single-project', '/projects/'],
  ['/events', '/events/'],
  ['/behind-the-scenes', '/archive/'],
  ['/contact-7', '/contact/'],
  ['/privacy-policy', '/privacy-policy/'],
]);

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

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizePathname(pathname) {
  const clean = pathname.replace(/\/$/, '') || '/';
  return clean;
}

function mappedComPath(netUrl) {
  const pathname = normalizePathname(new URL(netUrl).pathname);
  if (MAIN_ROUTE_MAP.has(pathname)) return MAIN_ROUTE_MAP.get(pathname);
  if (pathname.startsWith('/post/')) return `${pathname}/`;
  if (pathname.startsWith('/event-details-registration/')) return `${pathname}/`;
  if (pathname.startsWith('/artists/')) return `${pathname}/`;
  if (pathname.startsWith('/artworks-')) return `${pathname}/`;
  return `${pathname}/`;
}

function isNotFound(capture) {
  if (!capture?.ok) return false;
  const text = `${capture.title || ''}\n${capture.textSample || ''}`.toLowerCase();
  return capture.status === 404 || /page not found|this page wandered off|404/.test(text);
}

async function dismissCookies(page) {
  const candidates = [
    page.locator('.consent-banner-root button').filter({ hasText: /^Accept$/i }).first(),
    page.getByRole('button', { name: /^Accept$/i }).first(),
    page.getByRole('button', { name: /accept/i }).first(),
  ];

  for (const locator of candidates) {
    try {
      if (await locator.isVisible({ timeout: 900 })) {
        await locator.click({ timeout: 1500 });
        await page.waitForTimeout(350);
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
        .slice(0, 70)
        .map((image) => new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 1800);
        }))
    );
  }).catch(() => {});
}

async function stepScroll(page) {
  const viewport = page.viewportSize()?.height || 900;
  const step = Math.floor(viewport * 0.8);
  const maxSteps = 38;

  for (let i = 0; i < maxSteps; i += 1) {
    const { y, height } = await page.evaluate((scrollY) => {
      window.scrollTo(0, scrollY);
      return {
        y: window.scrollY,
        height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      };
    }, i * step);
    await page.waitForTimeout(260);
    if (y + viewport >= height - 4) break;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
}

async function captureComPage(context, entry, viewport) {
  const page = await context.newPage();
  const file = `${entry.key}-${viewport.key}.jpg`;
  const screenshotPath = path.join(OUT_DIR, 'com-screenshots', file);

  try {
    const response = await page.goto(entry.comUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
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
      textSample: document.body?.innerText?.slice(0, 900) || '',
      h1: document.querySelector('h1')?.textContent?.trim() || '',
    }));

    return {
      viewport: viewport.key,
      ok: true,
      status: response?.status() || 0,
      file: `com-screenshots/${file}`,
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

function cropTop(png, height) {
  if (png.height === height) return png;
  const out = new PNG({ width: png.width, height });
  for (let y = 0; y < height; y += 1) {
    const start = y * png.width * 4;
    png.data.copy(out.data, start, start, start + png.width * 4);
  }
  return out;
}

async function imageDiff(netFile, comFile) {
  try {
    const width = 320;
    const maxHeight = 2400;
    const netBuffer = await sharp(netFile).resize({ width }).png().toBuffer();
    const comBuffer = await sharp(comFile).resize({ width }).png().toBuffer();
    let netPng = PNG.sync.read(netBuffer);
    let comPng = PNG.sync.read(comBuffer);
    const height = Math.min(netPng.height, comPng.height, maxHeight);
    if (height <= 0) return null;
    netPng = cropTop(netPng, height);
    comPng = cropTop(comPng, height);
    const diff = new PNG({ width, height });
    const changed = pixelmatch(netPng.data, comPng.data, diff.data, width, height, { threshold: 0.18 });
    return {
      comparedWidth: width,
      comparedHeight: height,
      changedPixels: changed,
      diffPct: Math.round((changed / (width * height)) * 1000) / 10,
    };
  } catch {
    return null;
  }
}

function textOverlap(netText, comText) {
  const tokenize = (text) => new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9à-ÿ]+/gi, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3)
  );
  const net = tokenize(netText);
  const com = tokenize(comText);
  if (!net.size) return null;
  let shared = 0;
  for (const token of net) if (com.has(token)) shared += 1;
  return Math.round((shared / net.size) * 1000) / 10;
}

function issueFor(page, netCapture, comCapture, diff) {
  const heightDeltaPct = netCapture?.height && comCapture?.height
    ? Math.round(((comCapture.height - netCapture.height) / netCapture.height) * 1000) / 10
    : null;
  const overlap = textOverlap(netCapture?.textSample, comCapture?.textSample);
  const notFound = isNotFound(comCapture);

  if (!comCapture?.ok) {
    return {
      severity: 'Launch blocker',
      fixType: 'Codex can fix route',
      issue: 'Preview page failed to capture.',
      suggestedFix: 'Check route/build output, then create or repair the page route.',
      heightDeltaPct,
      textOverlapPct: overlap,
    };
  }

  if (notFound) {
    const futureProfile = page.category === 'Artist pages' || page.category === 'Artwork pages';
    return {
      severity: futureProfile ? 'Important' : 'Launch blocker',
      fixType: futureProfile ? 'Needs product/content decision' : 'Codex can fix route',
      issue: 'Wix URL has no matching preview page; preview resolves to a 404/not-found page.',
      suggestedFix: futureProfile
        ? 'Decide whether artist/artwork profile pages are in scope now. If yes, build a profile template and content collection; if no, mark as intentionally deferred.'
        : 'Add the mapped route or correct the slug mapping so this Wix page has a preview equivalent.',
      heightDeltaPct,
      textOverlapPct: overlap,
    };
  }

  const diffPct = diff?.diffPct ?? null;
  const absHeight = Math.abs(heightDeltaPct ?? 0);
  const lowText = overlap != null && overlap < 35;
  const highVisual = diffPct != null && diffPct >= 45;
  const mediumVisual = diffPct != null && diffPct >= 25;
  const highHeight = absHeight >= 45;
  const mediumHeight = absHeight >= 20;

  if (highHeight || highVisual || lowText) {
    return {
      severity: 'Important',
      fixType: page.category === 'Main pages' ? 'Codex can fix layout' : 'Needs content/template review',
      issue: [
        highVisual ? `High visual difference (${diffPct}%).` : '',
        highHeight ? `Page length differs by ${heightDeltaPct}%.` : '',
        lowText ? `Low visible text overlap (${overlap}%).` : '',
      ].filter(Boolean).join(' '),
      suggestedFix: page.category === 'Main pages'
        ? 'Review the side-by-side screenshot and rebuild missing/incorrect sections, spacing, media crops, typography, and footer/header treatment.'
        : 'Check whether the preview template/content matches the Wix source; update CMS content, page template, or intentionally defer missing legacy entries.',
      heightDeltaPct,
      textOverlapPct: overlap,
    };
  }

  if (mediumHeight || mediumVisual) {
    return {
      severity: 'Polish',
      fixType: 'Codex can fix visual polish',
      issue: [
        mediumVisual ? `Moderate visual difference (${diffPct}%).` : '',
        mediumHeight ? `Page length differs by ${heightDeltaPct}%.` : '',
      ].filter(Boolean).join(' '),
      suggestedFix: 'Review spacing, image crop, text scale, and section rhythm against the reference.',
      heightDeltaPct,
      textOverlapPct: overlap,
    };
  }

  return {
    severity: 'Review',
    fixType: 'Human verify',
    issue: diffPct == null ? 'Captured, but no image-diff score was available.' : `Low measured visual difference (${diffPct}%).`,
    suggestedFix: 'Quick human pass only; fix if the side-by-side reveals a meaningful issue.',
    heightDeltaPct,
    textOverlapPct: overlap,
  };
}

async function captureCom(manifest) {
  const browser = await chromium.launch({ headless: true });
  const sourcePages = LIMIT > 0 ? manifest.pages.slice(0, LIMIT) : manifest.pages;
  const pages = sourcePages.map((page) => ({
    key: page.key,
    category: page.category,
    title: page.title,
    netUrl: page.url,
    comPath: mappedComPath(page.url),
    captures: page.captures,
  }));

  try {
    for (const page of pages) {
      page.comUrl = COM_BASE + page.comPath;
    }

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
        deviceScaleFactor: 1,
        userAgent: `Mozilla/5.0 (newafro-parity-review; ${viewport.key}) AppleWebKit/537.36 Chrome/120 Safari/537.36`,
      });

      for (const [index, page] of pages.entries()) {
        process.stderr.write(`[parity] ${viewport.key} ${String(index + 1).padStart(2, '0')}/${pages.length} ${page.title}\n`);
        page.comCaptures ||= [];
        page.comCaptures.push(await captureComPage(context, page, viewport));
      }

      await context.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return pages;
}

async function buildRegister(pages) {
  const rows = [];

  for (const page of pages) {
    page.review = [];
    for (const viewport of VIEWPORTS) {
      const netCapture = page.captures.find((capture) => capture.viewport === viewport.key);
      const comCapture = page.comCaptures.find((capture) => capture.viewport === viewport.key);
      const netFile = netCapture?.ok ? path.join(NET_REFERENCE_DIR, netCapture.file) : '';
      const comFile = comCapture?.ok ? path.join(OUT_DIR, comCapture.file) : '';
      const diff = netFile && comFile ? await imageDiff(netFile, comFile) : null;
      const issue = issueFor(page, netCapture, comCapture, diff);
      const row = {
        id: `${page.key}-${viewport.key}`,
        page: page.title,
        page_key: page.key,
        category: page.category,
        viewport: viewport.key,
        severity: issue.severity,
        fix_type: issue.fixType,
        issue: issue.issue,
        suggested_fix: issue.suggestedFix,
        net_url: page.netUrl,
        com_url: page.comUrl,
        com_status: comCapture?.status || '',
        net_height: netCapture?.height || '',
        com_height: comCapture?.height || '',
        height_delta_pct: issue.heightDeltaPct ?? '',
        visual_diff_pct: diff?.diffPct ?? '',
        text_overlap_pct: issue.textOverlapPct ?? '',
        net_screenshot: netCapture?.file ? `../newafro-net/${netCapture.file}` : '',
        com_screenshot: comCapture?.file || '',
        status: 'Open',
        owner: '',
        decision: '',
      };
      rows.push(row);
      page.review.push(row);
    }
  }

  return rows.sort((a, b) => {
    const rank = { 'Launch blocker': 0, Important: 1, Polish: 2, Review: 3 };
    return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)
      || a.category.localeCompare(b.category)
      || a.page.localeCompare(b.page)
      || a.viewport.localeCompare(b.viewport);
  });
}

function rowsToCsv(rows) {
  const columns = [
    'id', 'page', 'page_key', 'category', 'viewport', 'severity', 'fix_type',
    'issue', 'suggested_fix', 'net_url', 'com_url', 'com_status',
    'net_height', 'com_height', 'height_delta_pct', 'visual_diff_pct',
    'text_overlap_pct', 'net_screenshot', 'com_screenshot', 'status', 'owner', 'decision',
  ];
  return `${columns.join(',')}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')).join('\n')}\n`;
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    acc[row[key]] = (acc[row[key]] || 0) + 1;
    return acc;
  }, {});
}

function renderHtml(manifest, pages, rows) {
  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const grouped = new Map();
  for (const page of pages) {
    if (!grouped.has(page.category)) grouped.set(page.category, []);
    grouped.get(page.category).push(page);
  }

  const severityCounts = countBy(rows, 'severity');
  const categoryNav = [...grouped.entries()].map(([category, categoryPages]) =>
    `<a href="#${slugify(category)}">${esc(category)} <span>${categoryPages.length}</span></a>`
  ).join('');

  const rowById = Object.fromEntries(rows.map((row) => [row.id, row]));
  const summaryRows = rows.slice(0, 40).map((row) => `
    <tr>
      <td><span class="severity ${slugify(row.severity)}">${esc(row.severity)}</span></td>
      <td>${esc(row.category)}</td>
      <td>${esc(row.page)}</td>
      <td>${esc(row.viewport)}</td>
      <td>${esc(row.issue)}</td>
      <td>${esc(row.fix_type)}</td>
    </tr>
  `).join('');

  const sections = [...grouped.entries()].map(([category, categoryPages]) => `
    <section id="${slugify(category)}">
      <h2>${esc(category)}</h2>
      ${categoryPages.map((page) => `
        <article class="page-card">
          <header>
            <div>
              <p class="eyebrow">${esc(page.key)}</p>
              <h3>${esc(page.title)}</h3>
              <p class="urls"><a href="${esc(page.netUrl)}">Wix source</a> → <a href="${esc(page.comUrl)}">Preview target</a></p>
            </div>
          </header>
          ${VIEWPORTS.map((viewport) => {
            const net = page.captures.find((capture) => capture.viewport === viewport.key);
            const com = page.comCaptures.find((capture) => capture.viewport === viewport.key);
            const row = rowById[`${page.key}-${viewport.key}`];
            return `<div class="pair">
              <div class="pair-head">
                <strong>${esc(viewport.label)}</strong>
                <span class="severity ${slugify(row.severity)}">${esc(row.severity)}</span>
                <span>${esc(row.issue)}</span>
              </div>
              <div class="shots">
                <a class="shot" href="../newafro-net/${esc(net?.file || '')}">
                  <strong>.net reference</strong>
                  ${net?.file ? `<img src="../newafro-net/${esc(net.file)}" alt="${esc(page.title)} .net ${esc(viewport.key)}">` : '<p>No .net screenshot.</p>'}
                  <span>${esc(net?.height || '')}px tall</span>
                </a>
                <a class="shot" href="${esc(com?.file || '')}">
                  <strong>.com / preview</strong>
                  ${com?.file ? `<img src="${esc(com.file)}" alt="${esc(page.title)} preview ${esc(viewport.key)}">` : `<p>${esc(com?.error || 'No preview screenshot.')}</p>`}
                  <span>${esc(com?.height || '')}px tall · status ${esc(com?.status || '')}</span>
                </a>
              </div>
              <details>
                <summary>Fix register row</summary>
                <dl>
                  <dt>Fix type</dt><dd>${esc(row.fix_type)}</dd>
                  <dt>Suggested fix</dt><dd>${esc(row.suggested_fix)}</dd>
                  <dt>Visual diff</dt><dd>${esc(row.visual_diff_pct)}%</dd>
                  <dt>Height delta</dt><dd>${esc(row.height_delta_pct)}%</dd>
                  <dt>Text overlap</dt><dd>${esc(row.text_overlap_pct)}%</dd>
                </dl>
              </details>
            </div>`;
          }).join('')}
        </article>
      `).join('')}
    </section>
  `).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>New Afro parity review</title>
  <style>
    :root { color-scheme: light; --ink:#17120d; --muted:#6c6257; --line:#ddd4c8; --paper:#f7f2e8; --panel:#fffdf8; --brown:#321b08; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--paper); color: var(--ink); }
    .shell { display: grid; grid-template-columns: 250px minmax(0, 1fr); min-height: 100vh; }
    aside { position: sticky; top: 0; height: 100vh; overflow: auto; padding: 24px 18px; border-right: 1px solid var(--line); background: var(--brown); color: #fff7eb; }
    aside h1 { margin: 0 0 8px; font: 400 28px/1.05 Georgia, serif; }
    aside p { color: #e4d2bd; font-size: 13px; margin: 0 0 18px; }
    nav { display: grid; gap: 8px; margin-top: 18px; }
    nav a, .download { color: inherit; text-decoration: none; display: flex; justify-content: space-between; border: 1px solid rgba(255,255,255,.18); padding: 8px 10px; border-radius: 6px; }
    .download { display: block; margin: 16px 0; text-align: center; background: #fff7eb; color: var(--brown); font-weight: 700; }
    main { padding: 32px; max-width: 1680px; width: 100%; }
    .intro { margin-bottom: 28px; max-width: 980px; }
    .intro h2 { margin: 0 0 8px; font: italic 400 54px/1 Georgia, serif; }
    .intro p { margin: 0 0 10px; color: var(--muted); }
    .counts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .counts span, .severity { border-radius: 999px; padding: 3px 9px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .counts span { background: #eee2d3; }
    .launch-blocker { background:#731b16; color:#fff; }
    .important { background:#a34712; color:#fff; }
    .polish { background:#b18400; color:#fff; }
    .review { background:#d8d2c5; color:#2c261e; }
    section { margin: 0 0 42px; }
    section > h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid var(--line); padding-bottom: 8px; color: #6c4c2d; }
    .page-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; margin: 0 0 24px; }
    .page-card header { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 14px; }
    .eyebrow { margin: 0 0 2px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    h3 { margin: 0; font-size: 24px; }
    .urls { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
    a { color: #5d3412; }
    .pair { border-top: 1px solid var(--line); padding-top: 14px; margin-top: 14px; }
    .pair-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
    .shots { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .shot { display: grid; gap: 8px; color: inherit; text-decoration: none; min-width: 0; }
    .shot strong { font-size: 13px; color: #563a20; }
    .shot span, .shot p, details { color: var(--muted); font-size: 12px; margin: 0; }
    .shot img { width: 100%; display: block; border: 1px solid var(--line); background: #fff; object-fit: cover; object-position: top; max-height: 760px; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); margin: 18px 0 32px; font-size: 13px; }
    th, td { border: 1px solid var(--line); padding: 7px 8px; text-align: left; vertical-align: top; }
    th:first-child, td:first-child { min-width: 118px; }
    th { background: #eadfce; }
    details { margin-top: 8px; }
    dl { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 4px 12px; }
    dt { font-weight: 700; color: #4f3928; }
    dd { margin: 0; }
    @media (max-width: 980px) {
      .shell { display: block; }
      aside { position: static; height: auto; }
      main { padding: 20px; }
      .shots { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <h1>New Afro Parity Review</h1>
      <p>.net reference versus ${esc(COM_BASE)}. Captured ${esc(CAPTURED_AT)}.</p>
      <a class="download" href="parity-fix-register.csv">Download fix register CSV</a>
      <nav>${categoryNav}</nav>
    </aside>
    <main>
      <div class="intro">
        <h2>Side-by-side fixes</h2>
        <p>This review turns the Wix screenshot source of truth into a fix backlog. The scores are mechanical signals, not taste judgments; use the screenshots to approve, reject, or refine each row.</p>
        <p>Reference: ${esc(manifest.source)} · Target: ${esc(COM_BASE)} · Pages: ${pages.length} · Screenshot pairs: ${rows.length}</p>
        <div class="counts">
          ${Object.entries(severityCounts).map(([severity, count]) => `<span class="${slugify(severity)}">${esc(severity)}: ${count}</span>`).join('')}
        </div>
      </div>
      <h2>Top register rows</h2>
      <table>
        <thead><tr><th>Severity</th><th>Category</th><th>Page</th><th>Viewport</th><th>Issue</th><th>Fix type</th></tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>
      ${sections}
    </main>
  </div>
</body>
</html>`;
}

async function main() {
  const manifest = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(NET_MANIFEST, 'utf8')));
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(path.join(OUT_DIR, 'com-screenshots'), { recursive: true });

  const comparedPages = LIMIT > 0 ? Math.min(LIMIT, manifest.pageCount) : manifest.pageCount;
  process.stderr.write(`[parity] comparing ${comparedPages} .net pages against ${COM_BASE}\n`);
  const pages = await captureCom(manifest);
  const rows = await buildRegister(pages);
  const output = {
    capturedAt: CAPTURED_AT,
    netReference: manifest.source,
    comBase: COM_BASE,
    pageCount: pages.length,
    screenshotPairs: rows.length,
    severityCounts: countBy(rows, 'severity'),
    pages,
    rows,
  };

  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(output, null, 2));
  await writeFile(path.join(OUT_DIR, 'parity-fix-register.csv'), rowsToCsv(rows));
  await writeFile(path.join(OUT_DIR, 'gallery.html'), renderHtml(manifest, pages, rows));

  process.stderr.write(`[parity] wrote ${path.relative(ROOT, OUT_DIR)}/gallery.html\n`);
  process.stderr.write(`[parity] register rows: ${rows.length} (${Object.entries(output.severityCounts).map(([k, v]) => `${k}=${v}`).join(', ')})\n`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
