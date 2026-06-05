// In-page extraction for the parity audit.
//
// `extractInPage` runs INSIDE the browser context (via page.evaluate), so it
// must be fully self-contained — no imports, no Node APIs. It pulls everything
// DOM-visible: normalized text, headings, CTAs, and every image/background/video
// candidate, including the Wix traps that naive `img[src]` scraping misses
// (srcset, <picture>, CSS background-image, video posters, lazy currentSrc).

export function extractInPage() {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const seen = new Set();
  const media = [];
  const push = (url, kind, where) => {
    if (!url) return;
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    let abs;
    try { abs = new URL(url, location.href).href; } catch { return; }
    const key = kind + '|' + abs;
    if (seen.has(key)) return;
    seen.add(key);
    media.push({ url: abs, kind, where });
  };

  // <img>: src, currentSrc (post-srcset resolution), and every srcset candidate.
  for (const img of document.querySelectorAll('img')) {
    push(img.currentSrc || img.src, 'img', sectionOf(img));
    push(img.getAttribute('src'), 'img', sectionOf(img));
    const ss = img.getAttribute('srcset');
    if (ss) ss.split(',').forEach((c) => push(c.trim().split(/\s+/)[0], 'img-srcset', sectionOf(img)));
  }
  // <picture><source srcset>
  for (const s of document.querySelectorAll('picture source')) {
    const ss = s.getAttribute('srcset');
    if (ss) ss.split(',').forEach((c) => push(c.trim().split(/\s+/)[0], 'picture', sectionOf(s)));
  }
  // CSS background-image on every element (Wix loves these for heroes).
  for (const el of document.querySelectorAll('*')) {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const m = bg.match(/url\((['"]?)(.*?)\1\)/g) || [];
      m.forEach((u) => push(u.replace(/url\((['"]?)(.*?)\1\)/, '$2'), 'bg', sectionOf(el)));
    }
  }
  // <video> poster + sources
  for (const v of document.querySelectorAll('video')) {
    push(v.getAttribute('poster'), 'video-poster', sectionOf(v));
    push(v.currentSrc || v.src, 'video', sectionOf(v));
    for (const sc of v.querySelectorAll('source')) push(sc.getAttribute('src'), 'video', sectionOf(v));
  }

  // Best-effort section label: nearest landmark/section id/aria-label/heading.
  function sectionOf(el) {
    let n = el;
    for (let i = 0; i < 8 && n; i++, n = n.parentElement) {
      const tag = n.tagName ? n.tagName.toLowerCase() : '';
      const aria = n.getAttribute && (n.getAttribute('aria-label') || n.getAttribute('data-testid'));
      if (aria) return norm(aria).slice(0, 40);
      if (['header', 'nav', 'footer', 'main', 'section', 'article'].includes(tag)) {
        const h = n.querySelector && n.querySelector('h1,h2,h3');
        if (h) return norm(h.textContent).slice(0, 40);
        if (n.id) return tag + '#' + n.id;
        return tag;
      }
    }
    return 'unknown';
  }

  // Headings: real <h1-3> AND ARIA headings — Wix renders headings as
  // role="heading" divs/spans, so h-tag-only extraction misses them entirely.
  const headingEls = new Set([
    ...document.querySelectorAll('h1,h2,h3'),
    ...document.querySelectorAll('[role="heading"]'),
  ]);
  const headings = [...headingEls]
    .map((h) => {
      const tag = h.tagName.toLowerCase();
      const level = /^h[1-3]$/.test(tag)
        ? tag
        : 'h' + (h.getAttribute('aria-level') || '2');
      return { level, text: norm(h.textContent), source: /^h[1-3]$/.test(tag) ? 'tag' : 'aria' };
    })
    .filter((h) => h.text && h.text.length <= 200);

  // Wix fallback: when a page has no/few semantic headings, treat large-font
  // short text (not nav links) as pseudo-headings so .net's visually-styled
  // titles still participate in the text-parity diff.
  if (headings.length < 3) {
    const known = new Set(headings.map((h) => h.text.toLowerCase()));
    const big = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('nav, header [role=navigation]')) continue;
      if (['A', 'BUTTON', 'SCRIPT', 'STYLE'].includes(el.tagName)) continue;
      const onlyText = el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3;
      if (!onlyText) continue;
      const t = norm(el.textContent);
      if (!t || t.length < 3 || t.length > 80) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (fs < 28) continue;
      if (known.has(t.toLowerCase())) continue;
      known.add(t.toLowerCase());
      big.push({ level: fs >= 60 ? 'h1' : 'h2', text: t, source: 'font', fontSize: Math.round(fs) });
    }
    big.sort((a, b) => b.fontSize - a.fontSize);
    headings.push(...big.slice(0, 12));
  }

  const ctas = [...document.querySelectorAll('a,button')]
    .map((a) => ({ text: norm(a.textContent), href: a.getAttribute('href') || '' }))
    .filter((a) => a.text && a.text.length <= 60);

  // Semantic structure fingerprint (NOT DOM tree — Wix classnames are random).
  const structure = {
    hasNav: !!document.querySelector('nav, header [role=navigation], header nav'),
    hasFooter: !!document.querySelector('footer'),
    sectionCount: document.querySelectorAll('section, main > div').length,
    headingCount: headings.length,
    imageCount: document.querySelectorAll('img').length,
    videoCount: document.querySelectorAll('video').length,
    gridCount: [...document.querySelectorAll('*')].filter((el) => {
      const d = getComputedStyle(el).display;
      return d === 'grid' || d === 'flex';
    }).length,
    firstHeading: headings[0] ? headings[0].text : '',
  };

  return {
    title: document.title,
    text: norm(document.body ? document.body.innerText : ''),
    headings,
    ctas,
    media,
    structure,
  };
}
