// Report artifact writers for the parity audit.
// Emits the human-readable index.html, the keystone image-assets-needed.csv,
// machine-readable JSON, a pasteable summary.md, and a run-over-run delta.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const ASSET_COLUMNS = [
  'Page', 'Section', 'Source Wix Asset', 'Current .com Asset',
  'Problem', 'fix_class', 'Needed From Team', 'Priority', 'Notes',
];

export function assetRowsToCsv(rows) {
  const head = ASSET_COLUMNS.join(',');
  const body = rows.map((r) => ASSET_COLUMNS.map((c) => csvCell(r[c])).join(',')).join('\n');
  return head + '\n' + body + '\n';
}

/** Per-page status from its findings. */
export function pageStatus(p) {
  if (p.error) return 'Error';
  const highAssets = (p.assetRows || []).filter((r) => r.Priority === 'High').length;
  const structHigh = (p.structure?.diffs || []).filter((d) => d.severity === 'High').length;
  if (p.error || structHigh >= 2) return 'Structural Mismatch';
  if (highAssets >= 1) return 'Missing Assets';
  const cov = p.text?.bodyTokenCoverage;
  const copyGap = cov != null && cov < 0.5; // .com dropped/replaced much of .net's body copy
  const issues = (p.text?.missingHeadingsCtas?.length || 0) + (p.structure?.diffs?.length || 0) + (p.assetRows?.length || 0);
  if (issues > 0 || copyGap) return 'Needs Review';
  return 'Good';
}

export async function writeReport(outDir, run, prev) {
  await mkdir(path.join(outDir, 'screenshots'), { recursive: true });

  const allRows = run.pages.flatMap((p) => p.assetRows || []);
  await writeFile(path.join(outDir, 'image-assets-needed.csv'), assetRowsToCsv(allRows));
  await writeFile(path.join(outDir, 'page-map.json'), JSON.stringify(run.pageMap, null, 2));
  await writeFile(path.join(outDir, 'text-diffs.json'), JSON.stringify(run.pages.map((p) => ({ page: p.key, ...p.text })), null, 2));
  await writeFile(path.join(outDir, 'structure-diffs.json'), JSON.stringify(run.pages.map((p) => ({ page: p.key, ...p.structure })), null, 2));

  const summary = renderSummary(run, prev);
  await writeFile(path.join(outDir, 'summary.md'), summary);
  await writeFile(path.join(outDir, 'index.html'), renderHtml(run));
  await writeFile(path.join(outDir, 'run.json'), JSON.stringify({ at: run.at, pages: run.pages.map((p) => ({ key: p.key, status: pageStatus(p), highAssets: (p.assetRows || []).filter((r) => r.Priority === 'High').length })) }, null, 2));
  return { summary, assetCount: allRows.length };
}

export async function loadPrevRun(latestDir) {
  try { return JSON.parse(await readFile(path.join(latestDir, 'run.json'), 'utf8')); }
  catch { return null; }
}

function renderSummary(run, prev) {
  const lines = [`# NewAfro parity audit — ${run.at}`, ''];
  const byStatus = {};
  for (const p of run.pages) { const s = pageStatus(p); byStatus[s] = (byStatus[s] || 0) + 1; }
  lines.push('Pages: ' + Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', '), '');
  const highTotal = run.pages.reduce((n, p) => n + (p.assetRows || []).filter((r) => r.Priority === 'High').length, 0);
  lines.push(`High-priority asset gaps: ${highTotal}`, '');

  const ranked = [...run.pages].sort((a, b) => (b.assetRows?.length || 0) - (a.assetRows?.length || 0));
  lines.push('## Furthest from .net');
  for (const p of ranked.slice(0, 5)) lines.push(`- ${p.key} — ${pageStatus(p)} (${(p.assetRows || []).length} asset rows, ${(p.structure?.diffs || []).length} structure diffs)`);
  lines.push('', '## Closest to .net');
  for (const p of ranked.slice(-3).reverse()) lines.push(`- ${p.key} — ${pageStatus(p)}`);

  if (prev) {
    lines.push('', '## Delta vs previous run');
    const prevMap = Object.fromEntries(prev.pages.map((p) => [p.key, p]));
    for (const p of run.pages) {
      const before = prevMap[p.key];
      const now = (p.assetRows || []).filter((r) => r.Priority === 'High').length;
      if (before && before.highAssets !== now) {
        lines.push(`- ${p.key}: high-priority gaps ${before.highAssets} → ${now} ${now < before.highAssets ? '✅' : '⚠️'}`);
      }
    }
  }
  lines.push('', '_Full report: open index.html. Team punch list: image-assets-needed.csv._');
  return lines.join('\n');
}

function renderHtml(run) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const badge = { Good: '#1a7f37', 'Needs Review': '#9a6700', 'Missing Assets': '#bc4c00', 'Structural Mismatch': '#cf222e', Error: '#82071e' };
  const cards = run.pages.map((p) => {
    const st = pageStatus(p);
    const issues = [
      ...(p.structure?.diffs || []).map((d) => d.msg),
      ...(p.text?.missingHeadingsCtas || []).slice(0, 3).map((t) => `Missing copy: "${t}"`),
      ...(p.text?.suspiciousReplacementText || []).map((t) => `Suspicious text: "${t}"`),
    ].slice(0, 5);
    const shots = (p.screenshots || []).map((s) => `<a href="screenshots/${esc(s)}">${esc(s.replace(/\.png$/, ''))}</a>`).join(' · ');
    const rows = (p.assetRows || []).slice(0, 30).map((r) =>
      `<tr><td>${esc(r.Section)}</td><td>${esc(r.Problem)}</td><td>${esc(r.fix_class)}</td><td>${esc(r.Priority)}</td><td>${esc(r['Needed From Team'])}</td></tr>`).join('');
    return `<section class="card">
      <h2>${esc(p.key)} <span class="badge" style="background:${badge[st] || '#555'}">${esc(st)}</span></h2>
      <div class="urls">${esc(p.netUrl || '')} ↔ ${esc(p.comUrl || '')}</div>
      ${p.error ? `<p class="err">${esc(p.error)}</p>` : ''}
      ${issues.length ? `<ul>${issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p>No top issues.</p>'}
      <div class="shots">${shots}</div>
      ${rows ? `<table><thead><tr><th>Section</th><th>Problem</th><th>Fix class</th><th>Priority</th><th>Needed from team</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
    </section>`;
  }).join('\n');
  return `<!doctype html><meta charset=utf8><title>NewAfro parity — ${esc(run.at)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:2rem;max-width:1100px}h1{margin-bottom:.2rem}
.card{border:1px solid #ddd;border-radius:10px;padding:1rem 1.2rem;margin:1rem 0}
.badge{color:#fff;padding:2px 8px;border-radius:20px;font-size:12px;vertical-align:middle}
.urls{color:#666;font-size:13px;margin:.2rem 0 .6rem}.err{color:#cf222e}
table{border-collapse:collapse;width:100%;margin-top:.6rem;font-size:13px}
td,th{border:1px solid #eee;padding:4px 8px;text-align:left}.shots a{font-size:13px;margin-right:.4rem}</style>
<h1>NewAfro Wix→Astro parity</h1><p>${esc(run.at)} · newafro.net (source) ↔ newafro.com (current) · ${run.pages.length} pages</p>
${cards}`;
}
