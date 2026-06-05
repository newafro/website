#!/usr/bin/env node
// NewAfro Wix→Astro parity audit (deterministic core).
//
//   npm run audit:wix-parity                 # all mapped pages, desktop+mobile
//   AUDIT_PAGES=home,events npm run audit:wix-parity
//   AUDIT_VIEWPORTS=desktop npm run audit:wix-parity
//
// Read-only against live newafro.net (source of truth) and newafro.com (current).
// Never deploys, never edits the site. Emits reports/wix-parity/{latest,<ts>}/.

import { mkdir, readdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, capturePage } from './lib/parity/browser.mjs';
import { isWixAsset, wixMediaGuid, assetIdentity, wixIntrinsicSize, looksLikeMedia } from './lib/parity/wix-asset.mjs';
import { probeImage, classify, hamming } from './lib/parity/phash.mjs';
import { diffText } from './lib/parity/text.mjs';
import { diffStructure } from './lib/parity/structure.mjs';
import { writeReport, loadPrevRun, pageStatus } from './lib/parity/report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NET = (process.env.NET_BASE || 'https://www.newafro.net').replace(/\/$/, '');
const COM = (process.env.COM_BASE || 'https://newafro.com').replace(/\/$/, '');

// Curated map — .net slugs VERIFIED by crawling newafro.net's live nav
// (Wix uses non-obvious slugs: THE AGENCY=/general-1, PROJECTS=/single-project,
// Contact=/contact-7, THE ARCHIVE=/behind-the-scenes). net path ↔ com path.
const PAGE_MAP = {
  home: { net: '/', com: '/' },
  agency: { net: '/general-1', com: '/agency/' },
  community: { net: '/community', com: '/community/' },
  archive: { net: '/behind-the-scenes', com: '/archive/' },
  'behind-the-scenes': { net: '/behind-the-scenes', com: '/behind-the-scenes/' },
  projects: { net: '/single-project', com: '/projects/' },
  events: { net: '/events', com: '/events/' },
  contact: { net: '/contact-7', com: '/contact/' },
  about: { net: '/about', com: '/about/' },
  'artist-inquiries': { net: '/general-8', com: '/artist-inquiries/' },
  // NOTE: .com /team has no distinct .net source (team lives under THE AGENCY);
  // omitted from the default map rather than graded against a wrong page.
};

const VIEWPORTS = (process.env.AUDIT_VIEWPORTS || 'desktop,mobile').split(',').map((s) => s.trim()).filter(Boolean);
const PAGES = (process.env.AUDIT_PAGES ? process.env.AUDIT_PAGES.split(',').map((s) => s.trim()) : Object.keys(PAGE_MAP)).filter((k) => PAGE_MAP[k]);

async function pool(items, size, fn) {
  const out = []; let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers);
  return out;
}

// Significant visual assets only: drop svgs/icons/tiny transforms, dedupe identity.
function significantAssets(media) {
  // Exclude raw 'video' — videos can't be perceptual-hashed and fetching their
  // bodies is wasteful; their presence/absence is reported via the structure
  // diff instead. video-poster (an image) stays.
  const VISUAL = new Set(['img', 'bg', 'picture', 'network', 'video-poster']);
  const byId = new Map();
  for (const m of media || []) {
    if (!VISUAL.has(m.kind)) continue;
    if (/\.svg(\?|$)/i.test(m.url)) continue;
    if (!looksLikeMedia(m.url)) continue; // drop telemetry beacons / non-media
    const sz = wixIntrinsicSize(m.url);
    if (sz && sz.width && sz.width < 120) continue; // icon-sized transform
    const id = assetIdentity(m.url).id;
    const prev = byId.get(id);
    const score = (sz ? sz.width * (sz.height || 1) : 0) + (m.kind === 'bg' || m.kind === 'video' ? 1e7 : 0);
    if (!prev || score > prev.score) byId.set(id, { ...m, score, intrinsic: sz });
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, 20);
}

async function matchAssets(pageKey, netCap, comCap) {
  const netAssets = significantAssets(netCap.media);
  const comAssets = significantAssets(comCap.media);
  const netProbes = await pool(netAssets, 5, (a) => probeImage(a.url));
  const comProbes = await pool(comAssets, 5, (a) => probeImage(a.url));

  const rows = [];
  for (let i = 0; i < netAssets.length; i++) {
    const na = netAssets[i], np = netProbes[i];
    if (!np || !np.ok || !np.phash) continue;
    // Nearest .com asset by perceptual distance (NOT by verdict rank — picking
    // the most-similar image is the whole point; ranking by verdict inverts it).
    let bestProbe = null, bestDist = Infinity;
    for (let j = 0; j < comAssets.length; j++) {
      const cp = comProbes[j];
      if (!cp || !cp.ok || !cp.phash) continue;
      const d = hamming(np.phash, cp.phash);
      if (d < bestDist) { bestDist = d; bestProbe = { ca: comAssets[j], cp }; }
    }
    const verdict = bestProbe ? classify(np, bestProbe.cp) : classify(np, null);
    if (verdict.verdict === 'identical') continue; // no action needed
    // Only name a .com asset when it's a genuine match. For 'different'/'missing'
    // the nearest-by-phash is NOT a real correspondence — naming it misleads.
    const isRealMatch = ['reencoded', 'lower-res', 'wrong-crop'].includes(verdict.verdict);
    const comCell = isRealMatch && bestProbe
      ? `${shortUrl(bestProbe.ca.url)}${bestProbe.cp.width ? ` (${bestProbe.cp.width}×${bestProbe.cp.height})` : ''}`
      : '— no comparable asset on .com —';
    const guid = wixMediaGuid(na.url);
    rows.push({
      Page: pageKey,
      Section: na.where || 'unknown',
      'Source Wix Asset': (guid ? `wix:${guid}` : shortUrl(na.url)) + (np.width ? ` (${np.width}×${np.height})` : ''),
      'Current .com Asset': comCell,
      Problem: verdict.problem,
      fix_class: fixClass(verdict.verdict, na),
      'Needed From Team': neededFromTeam(verdict.verdict),
      Priority: priorityFor(verdict.verdict, na, pageKey),
      Notes: `kind=${na.kind}`,
    });
  }
  return rows;
}

const shortUrl = (u) => { try { return new URL(u).pathname; } catch { return u; } };

// A Wix "page not found" capture must NOT be graded as a real comparison.
function is404(cap) {
  if (!cap || !cap.ok) return false;
  const t = `${cap.title || ''} ${cap.text || ''}`.toLowerCase();
  return /page not found|page isn.?t available|error 404|\b404\b/.test(t) && (cap.text || '').length < 600;
}
function fixClass(verdict, na) {
  if (verdict === 'reencoded' || verdict === 'lower-res') return 'mechanical';
  if (verdict === 'wrong-crop') return na.kind === 'bg' ? 'needs-judgment' : 'mechanical';
  return 'needs-asset'; // missing / different
}
function neededFromTeam(verdict) {
  return { missing: 'Provide original high-res asset', different: 'Confirm correct asset or supply original', 'wrong-crop': 'Confirm intended crop / supply original', 'lower-res': 'Supply higher-resolution source', reencoded: '(none — mechanical)', unknown: 'Verify source asset' }[verdict] || 'Review';
}
function priorityFor(verdict, na, pageKey) {
  const heroish = na.kind === 'bg' || na.kind === 'video' || na.kind === 'video-poster' || (na.intrinsic && na.intrinsic.width >= 1200);
  if (verdict === 'missing' || verdict === 'different') return heroish ? 'High' : 'Medium';
  if (verdict === 'wrong-crop' || verdict === 'lower-res') return heroish ? 'High' : 'Medium';
  return 'Low';
}

async function auditPage(browser, key, outDir) {
  const map = PAGE_MAP[key];
  const netUrl = NET + map.net, comUrl = COM + map.com;
  const result = { key, netUrl, comUrl, screenshots: [], assetRows: [] };
  let netCap = null, comCap = null;

  for (const vp of VIEWPORTS) {
    const netShot = `${key}-net-${vp}.png`, comShot = `${key}-com-${vp}.png`;
    const nc = await capturePage(browser, netUrl, vp, path.join(outDir, 'screenshots', netShot));
    const cc = await capturePage(browser, comUrl, vp, path.join(outDir, 'screenshots', comShot));
    if (nc.ok) result.screenshots.push(netShot);
    if (cc.ok) result.screenshots.push(comShot);
    if (vp === VIEWPORTS[0]) { netCap = nc; comCap = cc; }
  }
  if (!netCap || !netCap.ok) { result.error = `.net capture failed: ${netCap?.error || 'unknown'}`; return result; }
  if (!comCap || !comCap.ok) { result.error = `.com capture failed: ${comCap?.error || 'unknown'}`; return result; }
  if (is404(netCap)) { result.error = `.net reference is a Wix 404 (${netUrl}) — wrong/changed slug; no valid comparison`; return result; }
  if (is404(comCap)) { result.error = `.com page is a 404 (${comUrl})`; return result; }

  result.text = diffText(netCap, comCap);
  result.structure = diffStructure(netCap, comCap);
  result.assetRows = await matchAssets(key, netCap, comCap);
  // structure-derived asset row: missing video/section as a High punch-list item
  for (const d of result.structure.diffs) {
    if (d.severity === 'High' && /video|section/i.test(d.msg)) {
      result.assetRows.unshift({ Page: key, Section: 'structure', 'Source Wix Asset': '—', 'Current .com Asset': '—', Problem: d.msg, fix_class: 'needs-judgment', 'Needed From Team': 'Decide: rebuild section / supply media', Priority: 'High', Notes: 'structure' });
    }
  }
  return result;
}

async function discover(browser) {
  // Unmatched .com routes (enumerate src/pages) + .net nav targets from home.
  let comRoutes = [];
  try {
    const files = await readdir(path.join(ROOT, 'src', 'pages'));
    comRoutes = files.filter((f) => f.endsWith('.astro')).map((f) => '/' + f.replace(/\.astro$/, '').replace(/index/, '') );
  } catch { /* ignore */ }
  const mappedCom = new Set(Object.values(PAGE_MAP).map((m) => m.com.replace(/\/$/, '') || '/'));
  const unmatchedCom = comRoutes.filter((r) => !mappedCom.has(r.replace(/\/$/, '') || '/'));

  let netNav = [];
  try {
    const home = await capturePage(browser, NET + '/', 'desktop');
    if (home.ok) netNav = [...new Set(home.ctas.map((c) => c.href).filter((h) => h && h.startsWith('/')))];
  } catch { /* ignore */ }
  const mappedNet = new Set(Object.values(PAGE_MAP).map((m) => m.net));
  const unmatchedNet = netNav.filter((h) => !mappedNet.has(h.replace(/\/$/, '')) && !mappedNet.has(h));

  return { mapped: PAGE_MAP, unmatchedComRoutes: unmatchedCom, unmatchedNetNav: unmatchedNet };
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(ROOT, 'reports', 'wix-parity');
  // AUDIT_OUT_SUBDIR keeps viewport passes separate: latest/desktop, latest/mobile.
  const subdir = (process.env.AUDIT_OUT_SUBDIR || '').replace(/[^a-z0-9_-]/gi, '');
  const outDir = subdir ? path.join(base, stamp, subdir) : path.join(base, stamp);
  const latestDir = subdir ? path.join(base, 'latest', subdir) : path.join(base, 'latest');
  await mkdir(path.join(outDir, 'screenshots'), { recursive: true });

  const prev = await loadPrevRun(latestDir);
  const browser = await launch();
  const pages = [];
  try {
    for (const key of PAGES) {
      process.stderr.write(`[audit] ${key} …\n`);
      try { pages.push(await auditPage(browser, key, outDir)); }
      catch (e) { pages.push({ key, error: String(e?.message || e), assetRows: [], screenshots: [] }); }
    }
    var pageMap = await discover(browser);
  } finally {
    await browser.close().catch(() => {});
  }

  const run = { at: stamp, net: NET, com: COM, pages, pageMap };
  const { assetCount } = await writeReport(outDir, run, prev);

  // refresh latest/ (or latest/<subdir> for a viewport-scoped pass)
  await mkdir(latestDir, { recursive: true });
  await cp(outDir, latestDir, { recursive: true });

  process.stderr.write(`\n[audit] done${subdir ? ` (${subdir})` : ''}. ${pages.length} pages, ${assetCount} asset rows.\n`);
  for (const p of pages) process.stderr.write(`  ${pageStatus(p).padEnd(20)} ${p.key}\n`);
  process.stderr.write(`\nReport: ${path.relative(ROOT, outDir)}/index.html  (also ${path.relative(ROOT, latestDir)}/)\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
