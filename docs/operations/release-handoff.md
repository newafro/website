# New Afro Release Handoff

Use this as the short handoff for the first designer and the person finishing
the CMS login setup.

## Current Public URLs

```text
Production: https://newafro.com
Preview:    https://preview.newafro.com
CMS login:  https://login.newafro.com
```

`preview.newafro.com` and `login.newafro.com` are live over HTTPS. The CMS
screen loads, but saving content is blocked until the OAuth proxy DNS is live.

## Track A: Designer Review Can Start Now

The designer can review the preview site before CMS login is ready.
Use `docs/operations/preview-only-review.md` for the detailed no-login
checklist.

1. Open `https://preview.newafro.com` on desktop and phone.
2. Review home, menu, archive, events, projects, community, and agency.
3. Put screenshots into Figma with the date, for example
   `2026-05-21 Preview Review`.
4. Mark each comment as one of:
   - `Fix before launch`
   - `Nice to improve`
   - `Missing asset`
   - `Approved`
5. Do not test CMS saving yet.

Useful feedback examples:

```text
Fix before launch: Archive first card crop feels too zoomed on mobile.
Missing asset: Event poster should use the original Galerie Zato flyer.
Approved: Home hero and menu feel close enough for launch.
```

## Track B: CMS Login Blocker

The remaining setup is the New Afro Decap OAuth proxy:

```text
https://decap-oauth.newafro.com
```

The OAuth proxy repo is:

```text
https://github.com/newafro/decap-oauth
```

Before changing Namecheap, the person with Render access should run this in the
OAuth repo with the exact custom-domain target shown by Render:

```bash
GITHUB_OAUTH_ID=[from GitHub OAuth app] \
GITHUB_OAUTH_SECRET=[from GitHub OAuth app] \
PUBLIC_URL=https://decap-oauth.newafro.com \
GITHUB_REPO_PRIVATE=0 \
RENDER_CUSTOM_DOMAIN_TARGET=[exact Render DNS target] \
npm run check:deploy-config
```

Then add the printed Namecheap record in the `newafro.com` Advanced DNS zone.
The host must be `decap-oauth`. The value must be the exact Render target. It
must not be `newafro.github.io` and must not include `https://`.

If the operator does not want OAuth secrets on a laptop, store
`GITHUB_OAUTH_ID` and `GITHUB_OAUTH_SECRET` as secrets in
`newafro/decap-oauth`, then run this GitHub Actions preflight with the exact
Render target as the input:

```text
https://github.com/newafro/decap-oauth/actions/workflows/deploy-config-preflight.yml
```

That workflow prints the same Namecheap `decap-oauth` CNAME value without
exposing the OAuth secret.

After the OAuth repo secrets and Namecheap DNS are in place, run the operator
access preflight from GitHub:

```text
https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml
```

It should pass before attempting the first real CMS login/save test.

## After DNS Is Added

Run these checks from the website repo:

```bash
./scripts/check-pages-readiness.sh
npm run check:cms-readiness
npm run smoke:public
```

Run this from the OAuth repo:

```bash
npm run check:live
```

The first real designer CMS test starts only after those checks pass.

## First CMS Save Test

1. Open `https://login.newafro.com`.
2. Sign in with GitHub.
3. Open `Journal`, `Events`, and `Artists`.
4. Create a draft post named `CMS test - delete after onboarding`.
5. Add one sentence and keep `Draft` enabled.
6. Save it.
7. Confirm the draft appears in the CMS list.
8. Delete it or leave it clearly marked as a draft.

Stop if GitHub login fails, preview does not update, or the designer is asked
to understand branches, pull requests, or deploy internals.
