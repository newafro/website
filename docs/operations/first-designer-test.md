# First Designer Test

Use this checklist for the first New Afro designer onboarding session. The
goal is to prove the workflow with one person before inviting the full team.

## Current Entry Points

```text
Preview:        https://preview.newafro.com
CMS login:      https://login.newafro.com
Fallback login: https://newafro.com/login/
Production:     https://newafro.com
```

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
