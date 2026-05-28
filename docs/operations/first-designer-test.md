# First Designer Test

Use this checklist to prove the workflow with one designer before inviting the
full team.

For the short designer-facing checklist, use
[first-designer-kickoff.md](first-designer-kickoff.md).

## Entry Points

```text
Preview:        https://preview.newafro.com
CMS login:      https://login.newafro.com
Production:     https://newafro.com
Fallback login: https://newafro.com/login/
OAuth health:   https://decap-oauth.newafro.com/healthz
```

## Before The Session

Run:

```bash
npm run status:release
npm run check:cms-readiness
npm run smoke:public
```

Expected:

```text
Preview/design review: READY
CMS login/save: READY
```

Also confirm:

- The designer has a GitHub account.
- The designer has accepted write access to `newafro/website`.
- The CMS writes to `staging`, not `main`.
- `https://decap-oauth.newafro.com/auth?provider=github` redirects to GitHub.

## Session Script

1. Open `https://login.newafro.com`.
2. Sign in with GitHub.
3. Open `Journal`, `Events`, and `Artists` once so the sections feel familiar.
4. Create a test draft journal post named `CMS test - delete after onboarding`.
5. Add one short sentence.
6. Confirm `Draft` is still enabled.
7. Save.
8. Confirm the draft appears in the CMS list.
9. Delete the test draft or leave it clearly marked as a draft.
10. Open `https://preview.newafro.com` and review one page.
11. Add one Figma or screenshot comment with a concrete visual request.

## Success Criteria

- The designer can log in without help after the first pass.
- She understands that preview is the review space.
- She knows that production requires explicit approval.
- She can explain which changes belong in the CMS and which need a code/design
  request.
- She can name the page/component for a layout request using
  [../design-system.md](../design-system.md).

## Stop Conditions

Stop the onboarding session if:

- GitHub login fails.
- Preview does not update after a CMS save.
- The CMS asks the designer to understand branches, pull requests, or deploys.
- The designer is asked to bypass HTTPS or browser security warnings.
- A proposed Figma change does not include desktop and mobile intent.

Fix the system or request shape first, then retry with the designer.
