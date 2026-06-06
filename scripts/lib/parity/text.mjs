// Text / heading / CTA parity diffing.
//
// Compares two captures (net = source of truth, com = current). Reports what is
// missing on .com, what .com adds, and flags placeholder/AI-ish replacement copy
// — a real risk when a rebuild fills gaps with generated filler.

const AI_ISH = [
  /lorem ipsum/i, /placeholder/i, /your (?:text|content|headline) here/i,
  /\bcoming soon\b/i, /sample text/i, /add your/i, /elevate your/i,
  /unlock the power/i, /in today'?s fast-paced/i, /seamless(?:ly)? (?:integrat|experienc)/i,
];

const tokens = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

/** Phrase-set from headings + CTAs (the high-signal copy units). */
function phrases(cap) {
  const out = new Set();
  for (const h of cap.headings || []) out.add(h.text.toLowerCase());
  for (const c of cap.ctas || []) if (c.text) out.add(c.text.toLowerCase());
  return out;
}

export function diffText(net, com) {
  const netP = phrases(net), comP = phrases(com);
  const missingOnCom = [...netP].filter((p) => !comP.has(p) && !nearMatch(p, comP));
  const extraOnCom = [...comP].filter((p) => !netP.has(p) && !nearMatch(p, netP));

  const aiOnCom = (com.text ? [com.text] : [])
    .concat((com.headings || []).map((h) => h.text), (com.ctas || []).map((c) => c.text))
    .filter((t) => AI_ISH.some((re) => re.test(t)));

  // Body-token coverage: how much of .net's words survive on .com.
  const netTok = new Set(tokens(net.text));
  const comTok = new Set(tokens(com.text));
  const covered = [...netTok].filter((t) => comTok.has(t)).length;
  const coverage = netTok.size ? +(covered / netTok.size).toFixed(2) : null;

  return {
    missingHeadingsCtas: missingOnCom,
    extraHeadingsCtas: extraOnCom,
    bodyTokenCoverage: coverage,
    netTextLen: (net.text || '').length,
    comTextLen: (com.text || '').length,
    suspiciousReplacementText: [...new Set(aiOnCom)].slice(0, 10),
  };
}

function nearMatch(p, set) {
  for (const q of set) {
    if (q.includes(p) || p.includes(q)) return true;
  }
  return false;
}
