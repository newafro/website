# New Afro Operations Index

Start here when handing the site to a designer, operator, or implementation
agent. The production site, preview site, CMS login, and Decap OAuth proxy are
live.

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
- `decap-oauth.newafro.com` is deployed on Render, has a Namecheap CNAME, and
  passes `/healthz` and GitHub OAuth redirect checks.
- CMS login/save is ready for GitHub users with write access to
  `newafro/website`.

Readiness evidence to check before onboarding:

- `preview.newafro.com/release.json` must match the current `staging` branch.
- The preview-review readiness workflow should pass when the designer can start
  visual review before or alongside CMS editing:
  `https://github.com/newafro/website/actions/workflows/preview-review-readiness.yml`.
- The stricter CMS Onboarding Readiness workflow should report
  `Preview-only review: READY` and `CMS login/save dry run: READY`. It runs
  daily after the public CMS readiness monitor.
  The workflow file is still named `first-designer-readiness.yml` for link
  stability:
  `https://github.com/newafro/website/actions/workflows/first-designer-readiness.yml`.
- The public CMS readiness workflow should pass preview, login, CMS config, and
  release-marker checks, plus the OAuth DNS/HTTP path:
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
- The OAuth operator preflight runs daily after the live readiness monitor. Use
  it as the deeper infrastructure monitor for OAuth secrets and Render/DNS:
  `https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml`.

## Use The Right Checklist

- [Release handoff](release-handoff.md): short operator summary for the current
  launch state and CMS blocker.
- [First designer kickoff](first-designer-kickoff.md): the short checklist to
  send to the first designer now.
- [Preview-only review](preview-only-review.md): use this now with the designer
  before CMS login is ready.
- [OAuth operator quickstart](oauth-operator-quickstart.md): the short
  copy-paste checklist for the person finishing Render, Namecheap, and OAuth
  secrets.
- [First designer test](first-designer-test.md): use this after OAuth passes,
  to prove login and one safe draft save.
- [Designer handover](designer-handover.md): explains the Figma, CMS, preview,
  and production approval workflow.
- [Design system](../design-system.md): maps Figma components to Astro files,
  CMS fields, tokens, and review constraints.
- [Figma to preview workflow](../figma-to-preview-workflow.md): the process for
  turning a Figma request into a staged preview and approved production release.
- [Staging preview](staging-preview.md): technical setup for preview, login,
  OAuth, DNS, and release flow.
- [Team access](team-access.md): access checklist for Gus, Maria, Cheria, Ken,
  or any future editor.
- [WhatsApp website assistant](whatsapp-website-assistant.md): parked design for
  the later Hermes-style feedback assistant.

## Next Operator Step

Onboard people in this order:

1. Add the person's GitHub username with write access to `newafro/website`.
2. Ask them to accept the GitHub invitation.
3. Ask them to log in at `https://login.newafro.com`.
4. Ask them to create one harmless draft.
5. Confirm the draft appears in the CMS and on preview where expected.

The first designer can use [First designer test](first-designer-test.md) for
the CMS dry run and [Designer handover](designer-handover.md) for the daily
workflow.

For Figma-led design changes, use [../design-system.md](../design-system.md)
and [../figma-to-preview-workflow.md](../figma-to-preview-workflow.md).

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
readiness, and CMS onboarding login/save gate. It should exit green before
team onboarding. Use `STRICT_RELEASE=1 npm run status:release` when the command
should fail unless CMS login/save is also ready.

`npm run check:preview-review` is the best first command before the visual
review. It checks the same preview, login, asset, CMS config, and GitHub Pages
evidence, and exits green when preview-only review is ready.

`npm run check:first-designer` is the stricter command before CMS onboarding.
It separates `Preview-only review: READY` from `CMS login/save dry run:
READY`, then exits red if CMS login/save is not ready. It also runs
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
