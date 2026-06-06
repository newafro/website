// Wix CDN asset parsing for the parity audit.
//
// Wix serves media from `static.wixstatic.com` (and friends) as transformed
// URLs that embed the *source* asset GUID plus a per-render transform. To
// compare what the .net Wix site actually uses against the .com Astro rebuild
// we must compare the SOURCE asset, not the transformed URL — two different
// crops of the same hero are the same source asset, and a re-encode at lower
// resolution is a quality regression, not a "missing" asset.
//
// Source URL shapes seen on Wix:
//   https://static.wixstatic.com/media/<guid>~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_85/<file>.jpg
//   https://static.wixstatic.com/media/<guid>.jpg/v1/fill/w_640,.../<file>.jpg
//   https://static.wixstatic.com/media/<guid>~mv2.png
// where <guid> looks like `a1b2c3_<32hex>~mv2` or `nsplsh_<...>`.

const WIX_HOST_RE = /(^|\.)wixstatic\.com$/i;

/** Extract the source media GUID (the stable identity of a Wix asset). */
export function wixMediaGuid(url) {
  try {
    const u = new URL(url);
    if (!WIX_HOST_RE.test(u.hostname)) return null;
    // /media/<guid>(~mv2)?.<ext>(/v1/...)?
    const m = u.pathname.match(/\/media\/([^/]+?)(\.(?:jpe?g|png|gif|webp|avif|svg))?(?:\/v1\/.*)?$/i);
    if (!m) return null;
    // Strip the ~mv2 marker so jpg/png re-encodes of one source collapse together.
    return m[1].replace(/~mv2$/i, '');
  } catch {
    return null;
  }
}

/** Parse the intrinsic source dimensions Wix advertises in the URL, if any. */
export function wixIntrinsicSize(url) {
  // Wix encodes the ORIGINAL size in the path as `.../<guid>~mv2.jpg` is opaque,
  // but the rendered transform carries `w_<W>,h_<H>` which is the requested
  // (delivered) size — the best lower bound we have without fetching bytes.
  const fill = url.match(/\/v1\/.*?\bw_(\d+),h_(\d+)/i);
  if (fill) return { width: Number(fill[1]), height: Number(fill[2]), from: 'transform' };
  return null;
}

// Hosts/paths that are telemetry or analytics, never real page assets.
const JUNK_HOST_RE = /(^|\.)(frog\.wix\.com|panorama\.wixapps|google-analytics\.com|googletagmanager\.com|analytics\.|sentry\.|hotjar\.)/i;
const JUNK_PATH_RE = /\/(panorama|bt\?|bulklog|pixel|beacon|collect)\b/i;

/** Drop tracking pixels, analytics beacons, and non-media noise. */
export function isJunkAsset(url) {
  try {
    const u = new URL(url);
    if (JUNK_HOST_RE.test(u.hostname)) return true;
    if (JUNK_PATH_RE.test(u.pathname + u.search)) return true;
    return false;
  } catch {
    return true;
  }
}

/** A real media URL worth probing: Wix media/video CDN or an image/video extension. */
export function looksLikeMedia(url) {
  if (isJunkAsset(url)) return false;
  try {
    const u = new URL(url);
    if (/(static|video)\.wixstatic\.com$/i.test(u.hostname)) return true;
    return /\.(jpe?g|png|gif|webp|avif|mp4|webm|mov)(\?|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** True if this URL is a Wix-hosted asset at all. */
export function isWixAsset(url) {
  try {
    return WIX_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Canonical identity for ANY asset URL (Wix or otherwise) so the same asset
 * referenced two ways compares equal. For Wix: the source GUID. For others
 * (e.g. .com `/uploads/...`): host + pathname basename without a cache-buster.
 */
export function assetIdentity(url) {
  const guid = wixMediaGuid(url);
  if (guid) return { kind: 'wix', id: guid, url };
  try {
    const u = new URL(url, 'https://newafro.com');
    const base = u.pathname.split('/').pop() || u.pathname;
    return { kind: 'file', id: base.toLowerCase(), url };
  } catch {
    return { kind: 'raw', id: String(url), url };
  }
}
