# New Afro Release Handoff

Use this as the short handoff for the first designer and the person finishing
the CMS login setup.

## Current Public URLs

```text
Production: https://newafro.com
Preview:    https://preview.newafro.com
CMS login:  https://login.newafro.com
```

`preview.newafro.com` and `login.newafro.com` are live over HTTPS. Both
`login.newafro.com/` and `login.newafro.com/admin/` open the preview CMS route.
The CMS screen loads, but saving content is blocked until the OAuth proxy is
deployed on Render, its GitHub OAuth secrets exist, and
`decap-oauth.newafro.com` DNS is live.

Current evidence to verify before onboarding: the preview release marker must
match `staging`, browser smoke must pass for preview/admin/login, and the
Preview Review Readiness workflow should report that visual review is ready
while CMS saving is blocked:
`https://github.com/newafro/website/actions/workflows/preview-review-readiness.yml`.

The stricter CMS Onboarding Readiness workflow should remain blocked until
OAuth login/save is actually ready:
`https://github.com/newafro/website/actions/workflows/first-designer-readiness.yml`.

The OAuth repo should have a green latest Validate OAuth Proxy run on `main`:
`https://github.com/newafro/decap-oauth/actions/workflows/validate.yml`.
That validation now includes the Render Blueprint contract: `decap-oauth.newafro.com`
custom domain, `/healthz` health check, and deploys only after checks pass.

The OAuth live-readiness and operator preflight still fail because
`decap-oauth.newafro.com` has no DNS, the OAuth repo does not yet have
`GITHUB_OAUTH_ID` / `GITHUB_OAUTH_SECRET` secrets, and Render reports
`x-render-routing: no-server` on the likely default service URL:
`https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml`.

The OAuth setup/status tooling checks real 1Password sign-in with `op whoami`.
If it says 1Password is not signed in, that is an operator setup detail, not a
designer blocker. OAuth values can also be set directly as GitHub/Render
secrets.

## Track A: Designer Review Can Start Now

The designer can review the preview site before CMS login is ready.
Use `docs/operations/preview-only-review.md` for the detailed no-login
checklist.

1. Open `https://preview.newafro.com` on desktop and phone.
2. Review home, menu, archive, events, projects, community, and agency.
3. Put screenshots into Figma with the review date, for example
   `[date] Preview Review`.
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

Use these direct operator links when finishing the setup:

```text
GitHub OAuth app: https://github.com/settings/applications/new
OAuth repo secrets: https://github.com/newafro/decap-oauth/settings/secrets/actions
Render deploy: https://render.com/deploy?repo=https://github.com/newafro/decap-oauth
OAuth setup status: https://github.com/newafro/decap-oauth/actions/workflows/setup-status.yml
Deploy-config preflight: https://github.com/newafro/decap-oauth/actions/workflows/deploy-config-preflight.yml
Render/Namecheap runbook: https://github.com/newafro/decap-oauth/blob/main/docs/render-namecheap-runbook.md
```

Use the setup status first when coordinating with someone logged in to Render
or Namecheap. It is informational and can be green while still listing current
blockers. Use live readiness and operator access as the strict gates before
CMS login/save. If the setup status says 1Password is not signed in, sign in
with `op signin` or use the manual GitHub/Render secret path.

Preferred guided command from the OAuth repo:

```bash
GITHUB_OAUTH_ID=[from GitHub OAuth app] \
GITHUB_OAUTH_SECRET=[from GitHub OAuth app] \
npm run setup:operator
```

After Render shows the exact custom-domain target, rerun:

```bash
npm run check:render-blueprint
RENDER_CUSTOM_DOMAIN_TARGET=[exact Render DNS target] npm run setup:operator
```

The command creates or reads the exact `New Afro Decap OAuth` 1Password item,
syncs the OAuth repo GitHub Actions secrets, and validates the Namecheap record
when the Render target is available. It does not deploy Render or edit
Namecheap DNS.

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
exposing the OAuth secret. Read the workflow summary before changing
Namecheap; it repeats the GitHub OAuth callback and the exact CNAME record
generated from the Render target.

After the OAuth repo secrets and Namecheap DNS are in place, run the live OAuth
readiness and operator access preflight from GitHub:

```text
https://github.com/newafro/decap-oauth/actions/workflows/live-readiness.yml
https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml
```

Both should pass before attempting the first real CMS login/save test.

## After DNS Is Added

Run these checks from the website repo:

```bash
npm run status:release
./scripts/check-pages-readiness.sh
npm run check:preview-release
npm run check:cms-readiness
npm run smoke:public
```

`npm run status:release` is the quickest whole-handoff status command. Before
OAuth is live, it should say `Preview/design review: READY` and
`CMS login/save: BLOCKED`. After OAuth is live, rerun it with
`STRICT_RELEASE=1 npm run status:release` before moving this staging candidate
out of draft.

Run this from the OAuth repo:

```bash
npm run check:live
```

The first real designer CMS test starts only after those checks pass.

## First CMS Save Test

1. Open `https://login.newafro.com`.
   `https://login.newafro.com/admin/` is also valid if someone bookmarks the
   editor path directly.
2. Sign in with GitHub.
3. Open `Journal`, `Events`, and `Artists`.
4. Create a draft post named `CMS test - delete after onboarding`.
5. Add one sentence and keep `Draft` enabled.
6. Save it.
7. Confirm the draft appears in the CMS list.
8. Delete it or leave it clearly marked as a draft.

Stop if GitHub login fails, preview does not update, or the designer is asked
to understand branches, pull requests, or deploy internals.
