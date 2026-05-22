# First Designer Test

Use this checklist for the first New Afro designer onboarding session. The
goal is to prove the workflow with one person before inviting the full team.
For the short designer-facing checklist, use
[first-designer-kickoff.md](first-designer-kickoff.md).

## Current Entry Points

```text
Preview:        https://preview.newafro.com
CMS login:      https://login.newafro.com
Fallback login: https://preview.newafro.com/login/
Production:     https://newafro.com
```

`https://newafro.com/login/` is intentionally not part of the first designer
test until the staging branch has been promoted to production and smoke-tested.

If HTTPS is still pending for `preview.newafro.com` or `login.newafro.com`,
wait for GitHub Pages certificate provisioning before onboarding. Do not ask a
designer to ignore browser certificate warnings.

## Before The Session

- `preview.newafro.com` resolves and loads.
- `login.newafro.com` resolves and redirects to the CMS.
- `login.newafro.com/admin/` resolves and redirects to the CMS.
- GitHub Pages HTTPS enforcement is enabled for both `preview` and `login`.
- The OAuth deploy-config preflight has passed with the exact Render target.
- `decap-oauth.newafro.com` is deployed and reachable.
- `https://decap-oauth.newafro.com/auth?provider=github` redirects to GitHub.
- The designer has a GitHub account.
- The designer has write access to `newafro/website`.
- The CMS still writes to `staging`, not `main`.

OAuth deployment is tracked in
`https://github.com/newafro/decap-oauth/issues/1`.

The no-local-secrets OAuth preflight is:
`https://github.com/newafro/decap-oauth/actions/workflows/deploy-config-preflight.yml`.
Use it with the exact Render custom-domain DNS target before changing
Namecheap.

After the GitHub OAuth secrets and Namecheap DNS are added, run live OAuth
readiness and the operator access preflight from GitHub:

`https://github.com/newafro/decap-oauth/actions/workflows/live-readiness.yml`.

`https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml`.

Both should pass before scheduling the designer CMS login/save dry run.

The first designer dry run is tracked in
`https://github.com/newafro/website/issues/2`.

The designer onboarding is blocked until the OAuth proxy is live. The visible
preview and login pages can be reviewed before then, but GitHub login cannot be
completed without `decap-oauth.newafro.com`.

Practical split for the first session:

- Start preview-only review now if the designer is ready.
- Wait for CMS login/save until OAuth live readiness and operator preflight are
  both green.

Current state on 2026-05-22: `preview.newafro.com` and `login.newafro.com`
load over HTTPS, `login.newafro.com/admin/` is a valid editor entry point, the
public browser smoke check passes, and the CMS shows a clear pending-login
screen. The remaining blocker is `decap-oauth.newafro.com`, which still needs
the Render custom-domain CNAME in Namecheap before the designer can sign in or
save CMS changes.

First-designer readiness workflow:
`https://github.com/newafro/website/actions/workflows/first-designer-readiness.yml`.
Use the latest run summary. It checks `staging`, should report
`Preview-only review: READY`, and should keep CMS login/save blocked until
OAuth is live.

OAuth operator preflight:
`https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml`.
Use the latest run summary. It should be red until the DNS record and OAuth
repo secrets are added; its GitHub job summary lists the missing setup items
without exposing secrets.

OAuth deploy-config validation:
`https://github.com/newafro/decap-oauth/actions/workflows/deploy-config-preflight.yml`.
The deploy-config workflow summary should be read before changing Namecheap,
because it repeats the exact OAuth callback and `decap-oauth` CNAME generated
from the Render target.

If the designer is ready before OAuth is fixed, run a preview-only review
instead of the CMS login test. Have her inspect `https://preview.newafro.com`
on desktop and mobile, mark visual feedback as `Fix before launch`,
`Nice to improve`, `Missing asset`, or `Approved`, and stop before any CMS save
step.

Use `docs/operations/preview-only-review.md` for that no-login review.

Run `npm run check:cms-readiness` before the session. Start onboarding only
when that command passes.

For the clearest session gate, run:

```bash
npm run check:first-designer
```

Or run the same gate from GitHub Actions:

```text
https://github.com/newafro/website/actions/workflows/first-designer-readiness.yml
```

Use the workflow summary first. It separates preview-only review from CMS
login/save so the designer is not asked to test a blocked workflow.

This includes a local upload asset scan. If it reports a missing
`/uploads/...` file, fix the asset path or put the missing file in
`public/uploads` before asking the designer to review the affected page.
It also checks that `preview.newafro.com/release.json` matches the current
`staging` branch, so the review is against the latest candidate.

If it says `Preview-only review: READY` and `CMS login/save dry run: BLOCKED`,
start only the preview review flow. Start this CMS save test only when it says
`CMS login/save dry run: READY`.

If that check reports `decap-oauth.newafro.com has no public DNS result`, the
designer should wait. Fix the Namecheap/Render custom domain first; the CMS can
load without it, but GitHub login and saving content cannot work.

Run the browser smoke check as well from the website repo:

```bash
npm run smoke:public
```

This verifies the rendered preview home page, the preview CMS route, and both
`login.newafro.com/` and `login.newafro.com/admin/` redirecting into the preview
CMS on desktop/mobile Chrome.

You can also run the default-branch public monitor from GitHub:

```text
https://github.com/newafro/website/actions/workflows/cms-readiness-public.yml
```

Run the OAuth operator access workflow first if CMS readiness is failing on
OAuth secrets or `decap-oauth.newafro.com` DNS:

```text
https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml
```

## Session Script

1. Open `https://login.newafro.com`.
2. Sign in with GitHub.
3. Open `Journal`, `Events`, and `Artists` once so the sections feel familiar.
4. Create a test draft journal post named `CMS test - delete after onboarding`.
5. Add one short sentence, confirm `Draft` is still enabled, and save.
6. Confirm the change appears in the CMS list.
7. Do not publish it to production.
8. Delete the test draft or leave it clearly marked as a draft.
9. Open `https://preview.newafro.com` and review one page.
10. Add one Figma or screenshot comment with a concrete visual request.

## Success Criteria

- The designer can log in without help after the first pass.
- She understands that preview is the review space.
- She knows that production requires explicit approval.
- She can explain which changes belong in the CMS and which need a code/design
  request.

## Stop Conditions

Stop the onboarding session if:

- GitHub login fails.
- Preview does not update after a CMS save.
- The CMS asks the designer to understand branches, pull requests, or deploys.
- The designer is asked to bypass HTTPS or browser security warnings.

Fix the system first, then retry with the designer.
