# First Designer Test

Use this checklist for the first New Afro designer onboarding session. The
goal is to prove the workflow with one person before inviting the full team.

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
- GitHub Pages HTTPS enforcement is enabled for both `preview` and `login`.
- `decap-oauth.newafro.com` is deployed and reachable.
- `https://decap-oauth.newafro.com/auth?provider=github` redirects to GitHub.
- The designer has a GitHub account.
- The designer has write access to `newafro/website`.
- The CMS still writes to `staging`, not `main`.

OAuth deployment is tracked in
`https://github.com/newafro/decap-oauth/issues/1`.

The first designer dry run is tracked in
`https://github.com/newafro/website/issues/2`.

The designer onboarding is blocked until the OAuth proxy is live. The visible
preview and login pages can be reviewed before then, but GitHub login cannot be
completed without `decap-oauth.newafro.com`.

Run `npm run check:cms-readiness` before the session. Start onboarding only
when that command passes.

Run the browser smoke check as well from the website repo:

```bash
npm run smoke:public
```

This verifies the rendered preview home page, the preview CMS route, and
`login.newafro.com` redirecting into the preview CMS on desktop/mobile Chrome.

You can also run the default-branch public monitor from GitHub:

```text
https://github.com/newafro/website/actions/workflows/cms-readiness-public.yml
```

## Session Script

1. Open `https://login.newafro.com`.
2. Sign in with GitHub.
3. Open `Journal`, `Events`, and `Artists` once so the sections feel familiar.
4. Create a test draft journal post named `CMS test - delete after onboarding`.
5. Add one short sentence, set `Draft` to true, and save.
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
