// Perceptual hashing + asset classification for the parity audit.
//
// Dimension comparison alone is too weak: Wix re-encodes and re-crops the same
// source constantly. We fetch the actual bytes, compute a difference-hash
// (dHash), and use the Hamming distance plus the intrinsic resolution to say
// something the team can act on: is the .com asset the SAME image as .net, a
// re-encode, a worse crop, a lower-resolution copy, or a genuinely different /
// missing asset?

import sharp from 'sharp';

const FETCH_TIMEOUT_MS = 15000;

/** Fetch raw bytes politely; returns Buffer or null (never throws). */
export async function fetchBytes(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'newafro-parity-audit/1 (+read-only)' },
    });
    if (!res.ok) { clearTimeout(t); return null; }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct && !ct.startsWith('image/')) { clearTimeout(t); return null; } // don't pull video/other bodies
    const len = Number(res.headers.get('content-length') || 0);
    if (len > 12_000_000) { clearTimeout(t); return null; } // skip huge bodies
    const buf = Buffer.from(await res.arrayBuffer()); // abort timer still armed until here
    clearTimeout(t);
    return buf;
  } catch {
    return null;
  }
}

/** dHash: 9x8 grayscale → 64-bit row-difference hash, returned as 16-hex. */
export async function dHash(buf) {
  try {
    const w = 9, h = 8;
    const raw = await sharp(buf).grayscale().resize(w, h, { fit: 'fill' }).raw().toBuffer();
    let bits = '';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w - 1; x++) {
        const i = y * w + x;
        bits += raw[i] > raw[i + 1] ? '1' : '0';
      }
    }
    // 64 bits → 16 hex chars
    let hex = '';
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  }
}

export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/** Intrinsic dimensions + a phash, fetched from the live URL. */
export async function probeImage(url) {
  const buf = await fetchBytes(url);
  if (!buf) return { ok: false, url, bytes: 0 };
  let meta = {};
  try { meta = await sharp(buf).metadata(); } catch { /* non-image (svg/video poster edge) */ }
  return {
    ok: true,
    url,
    bytes: buf.length,
    width: meta.width || null,
    height: meta.height || null,
    format: meta.format || null,
    phash: await dHash(buf),
  };
}

/**
 * Classify a .com asset against the .net source it should match.
 * Returns one of: identical | reencoded | lower-res | wrong-crop | different | missing | unknown
 * plus a human Problem string and a default priority.
 */
export function classify(net, com) {
  if (!net || !net.ok) return { verdict: 'unknown', problem: 'Could not read .net source asset' };
  if (!com || !com.ok) return { verdict: 'missing', problem: 'No matching asset on .com (missing/broken)', priority: 'High' };

  const dist = hamming(net.phash, com.phash);
  const netPx = (net.width || 0) * (net.height || 0);
  const comPx = (com.width || 0) * (com.height || 0);
  const ratio = (n) => (n.width && n.height ? +(n.width / n.height).toFixed(3) : null);
  const arNet = ratio(net), arCom = ratio(com);
  const arDrift = arNet && arCom ? Math.abs(arNet - arCom) / arNet : 0;

  if (dist <= 10) {
    // Aspect-ratio drift = wrong crop, even at near-zero hash distance
    // (low-detail images can hash alike despite a different crop).
    if (arDrift > 0.08) {
      return { verdict: 'wrong-crop', problem: `Same source, different crop/aspect on .com (${arCom} vs ${arNet})`, priority: 'Medium' };
    }
    if (netPx && comPx && comPx < netPx * 0.6) {
      return { verdict: 'lower-res', problem: `Same image but lower resolution on .com (${com.width}×${com.height} vs ${net.width}×${net.height})`, priority: 'Medium' };
    }
    if (dist <= 2) return { verdict: 'identical', problem: 'Match', priority: 'Low' };
    return { verdict: 'reencoded', problem: 'Likely same image, re-encoded/recompressed on .com', priority: 'Low' };
  }
  return { verdict: 'different', problem: 'No matching .com asset found (missing or replaced vs .net)', priority: 'Medium' };
}
