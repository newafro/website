# Wix parity remaining assets and decisions

Generated after the local parity fix pass on 2026-06-06.

Reference reports:

- Desktop local fix audit: `reports/wix-parity/latest/fix-desktop/index.html`
- Mobile local fix audit: `reports/wix-parity/latest/fix-mobile/index.html`
- Original desktop/mobile triangulation: `reports/wix-parity/latest/triangulation-summary.md`

## Fixed by Codex in this pass

- Footer no longer displays the broken newsletter message.
- Footer social links are visible again.
- Community renders the full 16-logo partner grid from existing New Afro assets.
- Community uses square source portraits for the artists where matching local Wix-derived images already existed.
- Archive and Behind-the-Scenes now share a denser timeline with the existing local archive image library.
- Archive and Behind-the-Scenes now include the local archive video-backed hero, so the page no longer misses the video structure entirely.
- About now uses the Wix-style `About us` structure, warmer editorial copy rhythm, and higher-quality local versions of the storefront images.
- Contact no longer presents the form as broken. The form validates an email and opens a prefilled message to `hello@newafro.net`.
- Contact uses the higher-quality storefront image background instead of the small scraped version.
- Agency keeps `THE AGENCY` on one desktop line, matching the Wix heading structure more closely.
- Home now uses the public Wix hero video source `e7ed0d_1969e2b866d64f56878e425bbe127234` and a matching local poster frame.
- Home hero copy now follows the `.net` structure: large `New Afro` title and `The Cultural and Creative Agency` subtitle.

## Still needed from the team or designer

### Home

- Confirm the restored `.net` light studio/bookshelf hero is the intended final production direction.
- Confirm whether the homepage should keep the current `.com` browser title/tagline copy (`Where art connects cultures.`) or fully adopt the `.net` wording everywhere.

### Community

- High-resolution square artist portraits. The local files now match the correct crops, but several are only 303px and the audit flags them as lower-resolution than Wix.
- Missing or higher-resolution portraits for the remaining Wix image IDs still reported as no comparable asset.
- Confirm partner names and order. The full visual grid is restored, but alt labels should be checked by the team.

### Archive / Behind-the-Scenes

- Original high-resolution archive gallery assets. Many local files are correct but lower-resolution than Wix.
- Confirm archive copy and dates for the newly exposed timeline entries. The current copy is conservative and based on visible Wix/page context, but editorial review is still needed.
- Confirm whether `/archive` and `/behind-the-scenes` should be identical aliases or whether one route should redirect to the other.
- Supply any missing HERITAGE video/source material if the current `archive-hero.mp4` is not the intended Wix video.

### About / Agency / Contact

- Confirm the final team emails and roles, especially Ken's email/role spelling.
- Confirm whether About should keep the current Wix-like small circular team portraits or switch to the newer high-resolution portrait set.
- Confirm whether Contact should remain a mailto form or connect to a real form provider.
- Confirm whether the public contact email should be `hello@newafro.net`, `cheria@newafro.net`, or a future `newafro.com` address.

### Global

- Confirm newsletter destination. Current static fallback opens an email draft to `cheria@newafro.net`; a real mailing-list endpoint is still needed for production-grade signup.
- Confirm social URLs for Facebook and X before production.
