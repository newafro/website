// Node-side browser driver for the parity audit.
//
// Drives real Chromium (Playwright) with the Wix-robustness the README of pain
// demands: a network listener records EVERY image/video response (catching lazy
// + CSS-background + carousel assets the DOM may not expose yet), then we
// step-scroll the whole page with settle waits to trigger Wix's scroll-driven
// rendering, nudge the mobile menu open, and finally run the in-page extractor.

import { chromium } from 'playwright';
import { extractInPage } from './capture.mjs';

export async function launch() {
  return chromium.launch({ headless: true });
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 1000, isMobile: false, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2, hasTouch: true },
};

/**
 * Capture one URL at one viewport. Never throws: on failure returns
 * { ok:false, error }. Screenshot is written to `screenshotPath` if given.
 */
export async function capturePage(browser, url, viewportName, screenshotPath) {
  const vp = VIEWPORTS[viewportName];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    deviceScaleFactor: vp.deviceScaleFactor,
    hasTouch: !!vp.hasTouch,
    userAgent:
      'Mozilla/5.0 (newafro-parity-audit; read-only) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();
  const networkMedia = new Map(); // url -> {status, contentType}

  page.on('response', (res) => {
    try {
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      const u = res.url();
      if (ct.startsWith('image/') || ct.startsWith('video/')) {
        networkMedia.set(u, { status: res.status(), contentType: ct });
      }
    } catch { /* ignore */ }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    await stepScroll(page);
    // Nudge a mobile/hamburger menu so nav links/assets render.
    if (vp.isMobile) await tryOpenMenu(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);

    const extracted = await page.evaluate(extractInPage);

    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 30000 }).catch(() => {});
    }

    // Merge network-observed media in (the lazy/bg/carousel catch).
    const domUrls = new Set(extracted.media.map((m) => m.url));
    for (const [u, meta] of networkMedia) {
      if (!domUrls.has(u)) extracted.media.push({ url: u, kind: 'network', where: 'network', ...meta });
    }

    return { ok: true, url, viewport: viewportName, finalUrl: page.url(), ...extracted, networkMediaCount: networkMedia.size };
  } catch (error) {
    return { ok: false, url, viewport: viewportName, error: String(error && error.message ? error.message : error) };
  } finally {
    await context.close().catch(() => {});
  }
}

async function stepScroll(page) {
  try {
    const step = await page.evaluate(() => window.innerHeight * 0.8);
    const total = await page.evaluate(() => document.body.scrollHeight);
    let y = 0;
    const maxSteps = 40;
    for (let i = 0; i < maxSteps && y < total + step; i++) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(450); // settle: let lazy images + animations fire
      y += step;
      const grown = await page.evaluate(() => document.body.scrollHeight);
      if (grown > total + step && i > 2) break; // infinite-scroll guard
    }
  } catch { /* best effort */ }
}

async function tryOpenMenu(page) {
  const candidates = [
    '[aria-label*="menu" i]', '[aria-label*="open" i]', 'button[class*="menu" i]',
    'button[class*="burger" i]', '[data-testid*="menu" i]', 'header button',
  ];
  for (const sel of candidates) {
    try {
      const el = await page.$(sel);
      if (el) { await el.click({ timeout: 1500 }); await page.waitForTimeout(600); return; }
    } catch { /* try next */ }
  }
}

export { VIEWPORTS };
