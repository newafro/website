# First Designer Kickoff

Use this as the short first-session checklist for the first New Afro designer.
It assumes the designer works in Figma/Adobe and has not used GitHub or a CMS
before.

## Current Status

The designer can start visual review now:

```text
Preview site: https://preview.newafro.com
CMS screen:   https://login.newafro.com
```

CMS login and saving are not ready yet. They are blocked until the New Afro
OAuth proxy is live:

```text
OAuth proxy: https://decap-oauth.newafro.com
```

## Send This To The Designer

Use this message for the first preview-only review:

```text
Hi [name], the New Afro preview is ready for a visual review.

Open https://preview.newafro.com on desktop and phone.
Please do not use the CMS/login yet. It is still waiting on the login setup.

In Figma, create a page named:
2026-05-22 Preview Review

Please review:
Home, Menu overlay, Archive, Events, Projects, Community, The Agency, Contact.

Use these labels in comments:
Fix before launch:
Nice to improve:
Missing asset:
Copy correction:
Approved:

When ready, send:
Preview review ready.
Fix before launch: [number]
Missing asset: [number]
Approved pages: [page names]
```

## Session 1: Preview Review

Goal: collect useful design and content feedback without asking the designer to
touch GitHub, Render, Namecheap, or CMS saving.

1. Open `https://preview.newafro.com` on desktop.
2. Open the same URL on a phone or mobile viewport.
3. Create a Figma page named with the date, for example:

   ```text
   2026-05-22 Preview Review
   ```

4. Capture desktop and mobile screenshots for:
   - Home
   - Menu overlay
   - Archive
   - Events
   - Projects
   - Community
   - The Agency
   - Contact
5. Add comments using one of these labels:
   - `Fix before launch:`
   - `Nice to improve:`
   - `Missing asset:`
   - `Copy correction:`
   - `Approved:`
6. Send the Figma link with this short summary:

   ```text
   Preview review ready.
   Fix before launch: [number]
   Missing asset: [number]
   Approved pages: [page names]
   ```

## What Good Feedback Looks Like

```text
Fix before launch: Mobile archive cards feel too cropped; show more of the image.
Missing asset: Event poster should use the original Galerie Zato flyer.
Copy correction: Contact address should use the confirmed public address.
Approved: Menu overlay feels close enough to the Wix reference.
```

Avoid comments like:

```text
Make it nicer.
Looks weird.
Something is off.
```

## CMS Login Test Later

Start this only after all three are green:

```text
https://github.com/newafro/decap-oauth/actions/workflows/live-readiness.yml
https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml
https://github.com/newafro/website/actions/workflows/cms-readiness-public.yml
```

Then run this short CMS test:

1. Open `https://login.newafro.com`.
2. Sign in with GitHub.
3. Open `Journal`, `Events`, and `Artists` once.
4. Create a draft journal post named `CMS test - delete after onboarding`.
5. Add one short sentence.
6. Confirm `Draft` is still enabled.
7. Save.
8. Confirm the draft appears in the CMS list.
9. Delete it or leave it clearly marked as a draft.

## Stop Conditions

Stop and ask the operator to fix the system if:

- `https://preview.newafro.com` does not load.
- The browser shows a certificate/security warning.
- `https://login.newafro.com` asks the designer to understand GitHub branches,
  pull requests, or deployments.
- GitHub login fails after OAuth readiness is supposed to be green.
- A CMS save does not appear on preview.

## Current Blockers

CMS login/save remains blocked until:

- `decap-oauth.newafro.com` resolves publicly.
- `newafro/decap-oauth` has `GITHUB_OAUTH_ID` and `GITHUB_OAUTH_SECRET`
  repository secrets.
- The OAuth live-readiness and operator preflight workflows pass.
- Website public CMS readiness passes.
