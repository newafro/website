# New Afro Operations Index

Start here when handing the site to a designer, operator, or implementation
agent. The preview site is ready for visual review; CMS saving is still blocked
until the Decap OAuth proxy is deployed and DNS is published.

## Current Status

```text
Production: https://newafro.com
Preview:    https://preview.newafro.com
CMS login:  https://login.newafro.com
OAuth:      https://decap-oauth.newafro.com
```

- `newafro.com`, `preview.newafro.com`, and `login.newafro.com` are on GitHub
  Pages with approved HTTPS certificates and HTTPS enforcement.
- `login.newafro.com` and `login.newafro.com/admin/` open the preview CMS route.
- `decap-oauth.newafro.com` still needs the Render custom-domain CNAME in
  Namecheap before GitHub CMS login and saving can work.

Readiness evidence to check before onboarding:

- `preview.newafro.com/release.json` must match the current `staging` branch.
- The preview-review readiness workflow should pass when the designer can start
  visual review even if CMS saving is still blocked:
  `https://github.com/newafro/website/actions/workflows/preview-review-readiness.yml`.
- The stricter CMS Onboarding Readiness workflow should report
  `Preview-only review: READY` and `CMS login/save dry run: BLOCKED` until the
  OAuth proxy is live. It runs daily after the public CMS readiness monitor.
  The workflow file is still named `first-designer-readiness.yml` for link
  stability:
  `https://github.com/newafro/website/actions/workflows/first-designer-readiness.yml`.
- The public CMS readiness workflow should pass preview, login, CMS config, and
  release-marker checks, then block only on OAuth DNS until the OAuth proxy is
  live:
  `https://github.com/newafro/website/actions/workflows/cms-readiness-public.yml`.
- The friendly login redirect repo is deployed at commit `9fd5134`, so both
  `/` and `/admin/` are valid entry points for non-technical editors.
- `newafro/decap-oauth` should have a green latest Validate OAuth Proxy run on
  `main`:
  `https://github.com/newafro/decap-oauth/actions/workflows/validate.yml`.
- The OAuth Render Blueprint should pass `npm run check:render-blueprint`; it
  declares `decap-oauth.newafro.com`, uses `/healthz`, and waits for checks
  before auto-deploying.
- The deploy-config preflight now writes a GitHub Actions job summary with the
  exact OAuth callback and Namecheap CNAME generated from the Render target.
- The OAuth setup status workflow is informational and green; it gives the
  Render/Namecheap operator a single screen with the current DNS, secrets, and
  Render blockers:
  `https://github.com/newafro/decap-oauth/actions/workflows/setup-status.yml`.
  It now checks real 1Password sign-in with `op whoami`, so a locked or
  unsigned-in 1Password CLI is reported as a warning instead of a false pass.
- The live OAuth readiness monitor is pinned to Node 20 and runs from:
  `https://github.com/newafro/decap-oauth/actions/workflows/live-readiness.yml`.
- The OAuth operator preflight runs daily after the live readiness monitor and
  still fails on the external setup: missing `decap-oauth.newafro.com` DNS,
  missing OAuth repo secrets, and Render reporting `x-render-routing:
  no-server` on the likely default service URL:
  `https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml`.

## Use The Right Checklist

- [Release handoff](release-handoff.md): short operator summary for the current
  launch state and CMS blocker.
- [First designer kickoff](first-designer-kickoff.md): the short checklist to
  send to the first designer now.
- [Preview-only review](preview-only-review.md): use this now with the designer
  before CMS login is ready.
- [First designer test](first-designer-test.md): use this after OAuth passes,
  to prove login and one safe draft save.
- [Designer handover](designer-handover.md): explains the Figma, CMS, preview,
  and production approval workflow.
- [Staging preview](staging-preview.md): technical setup for preview, login,
  OAuth, DNS, and release flow.
- [Team access](team-access.md): access checklist for Gus, Maria, Cheria, Ken,
  or any future editor.
- [WhatsApp website assistant](whatsapp-website-assistant.md): parked design for
  the later Hermes-style feedback assistant.

## Next Operator Step

Finish the OAuth proxy setup in `newafro/decap-oauth`:

```text
https://github.com/newafro/decap-oauth/issues/1
```

Direct operator links:

```text
GitHub OAuth app: https://github.com/settings/applications/new
OAuth repo secrets: https://github.com/newafro/decap-oauth/settings/secrets/actions
Render deploy: https://render.com/deploy?repo=https://github.com/newafro/decap-oauth
OAuth setup status: https://github.com/newafro/decap-oauth/actions/workflows/setup-status.yml
Deploy-config preflight: https://github.com/newafro/decap-oauth/actions/workflows/deploy-config-preflight.yml
Render/Namecheap runbook: https://github.com/newafro/decap-oauth/blob/main/docs/render-namecheap-runbook.md
```

Preferred guided command from the OAuth repo:

```bash
GITHUB_OAUTH_ID=[from GitHub OAuth app] \
GITHUB_OAUTH_SECRET=[from GitHub OAuth app] \
npm run setup:operator
```

After Render shows the custom-domain DNS target, rerun:

```bash
npm run check:render-blueprint
RENDER_CUSTOM_DOMAIN_TARGET=[exact Render DNS target] npm run setup:operator
```

This creates or reads the exact `New Afro Decap OAuth` 1Password item, syncs
the OAuth repo GitHub Actions secrets, and validates the Render/Namecheap
target when the target is available. It does not deploy Render or edit
Namecheap DNS.

If OAuth secrets should stay out of local shells, add `GITHUB_OAUTH_ID` and
`GITHUB_OAUTH_SECRET` as GitHub Actions secrets in `newafro/decap-oauth`, then
run the deploy-config preflight with the exact Render custom-domain DNS target:

```text
https://github.com/newafro/decap-oauth/actions/workflows/deploy-config-preflight.yml
```

Read the workflow summary before changing Namecheap. It repeats the GitHub
OAuth callback and the exact `decap-oauth` CNAME value without printing OAuth
secret values.

After the Namecheap `decap-oauth` CNAME and OAuth repo secrets are in place,
run:

```text
https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml
```

The first designer can start [Preview-only review](preview-only-review.md)
now. Only start the first real CMS save test after that operator preflight,
live OAuth readiness, and `npm run check:cms-readiness` pass.

## Verification Commands

From the website repo:

```bash
npm run status:release
npm run check:preview-review
npm run check:first-designer
npm run check:content-assets
npm run check:preview-release
./scripts/check-pages-readiness.sh
npm run check:cms-readiness
npm run smoke:public
```

`npm run status:release` is the best one-command handoff view. It runs the
preview release marker, preview-only designer gate, browser smoke, public CMS
readiness, and CMS onboarding login/save gate. It exits green when
preview/design review is ready, while still printing `CMS login/save: BLOCKED`
until the OAuth proxy, repo secrets, and Render custom domain are finished. Use
`STRICT_RELEASE=1 npm run status:release` when the command should fail unless
CMS login/save is also ready.

`npm run check:preview-review` is the best first command before the visual
review. It checks the same preview, login, asset, CMS config, and GitHub Pages
evidence, but exits green when preview-only review is ready even if the OAuth
proxy is still blocking CMS save.

`npm run check:first-designer` is the stricter command before CMS onboarding.
It separates `Preview-only review: READY` from `CMS login/save dry run:
BLOCKED`, then exits red until CMS login/save is actually ready. It also runs
the local upload asset check so missing images or videos are caught before
review.

The green preview-only gate can be run from GitHub Actions when nobody has a
terminal open:

```text
https://github.com/newafro/website/actions/workflows/preview-review-readiness.yml
```

The stricter CMS-onboarding gate can also be run from GitHub Actions. The
workflow file is still named `first-designer-readiness.yml` for link stability.
The job summary and job name call this the CMS onboarding readiness gate; older
manual runs may still show the previous workflow title until the workflow-file
change is on the default branch:

```text
https://github.com/newafro/website/actions/workflows/first-designer-readiness.yml
```

That workflow writes a GitHub job summary with the two decisions that matter:
whether preview-only review is ready and whether CMS login/save is ready.

The website workflows use `secrets.NEWAFRO_OPERATOR_TOKEN` when present and
fall back to the default `github.token`. The default token cannot inspect
secrets in `newafro/decap-oauth`, so the website workflow may print a warning
that OAuth secrets could not be listed. Treat that as a monitoring-access
warning, not a designer-facing blocker. The authoritative OAuth secret check is
the `newafro/decap-oauth` operator preflight.

`npm run check:content-assets` scans the Astro, CMS, and content files for
`/uploads/...` references and fails when a referenced file is missing from
`public/uploads`.

`npm run check:preview-release` checks `https://preview.newafro.com/release.json`
against the current `staging` branch head, so onboarding does not accidentally
review an older deployed build.

When the readiness workflows are started manually from GitHub Actions, the run
list can show the workflow file's branch SHA, usually `main`. Do not use that
top-level run SHA as proof of what preview is serving. The workflow logs and
job summary print the checked `staging` SHA, and
`preview.newafro.com/release.json` is the source of truth for the deployed
preview candidate.

`./scripts/check-pages-readiness.sh` is the best operator-side first check: it
confirms preview/login HTTPS, reports whether the OAuth repo secrets exist when
the token can inspect `newafro/decap-oauth`, and then checks the OAuth proxy
DNS/HTTP path.

The public CMS readiness workflow writes a GitHub Actions job summary. Read
that summary first when the scheduled monitor is red; it lists the current
entry points, the exact remaining CMS login/save blockers, and the next
operator action before the full check log.

`npm run smoke:public` checks `https://preview.newafro.com/release.json`, the
preview home page, the CMS route, and both `login.newafro.com/` and
`login.newafro.com/admin/` redirecting into the preview CMS. In CI, the preview
smoke check fails if that marker does not match the exact staging commit GitHub
just deployed, so a green deploy proves the browser is testing the current
release candidate.

From the OAuth repo:

```bash
npm run check:live
```

Or from GitHub Actions:

```text
https://github.com/newafro/decap-oauth/actions/workflows/live-readiness.yml
```
