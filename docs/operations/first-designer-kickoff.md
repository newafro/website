# First Designer Kickoff

Use this as the first-session checklist for a New Afro designer who works in
Figma/Adobe and is new to GitHub/CMS workflows.

## Current Status

```text
Production: https://newafro.com
Preview:    https://preview.newafro.com
CMS login:  https://login.newafro.com
OAuth:      https://decap-oauth.newafro.com
```

CMS login/save is ready for GitHub users who have write access to
`newafro/website`.

Run this before the session:

```bash
npm run status:release
```

Expected decision:

```text
Preview/design review: READY
CMS login/save: READY
Production promotion: READY FOR FINAL HUMAN APPROVAL
```

## Send This To The Designer

```text
Hi [name], the New Afro website workflow is ready.

CMS editing:
https://login.newafro.com

Preview review:
https://preview.newafro.com

Please log in with GitHub. Your edits go to preview first, not directly to
the public site.

For visual/layout feedback, use Figma. Create a page named:
[date] Preview Review

Please use these labels in comments:
Fix before launch:
Nice to improve:
Missing asset:
Copy correction:
Approved:
```

## Session 1: CMS And Preview

Goal: prove the designer can safely use the CMS and understand preview.

1. Confirm the designer has accepted GitHub access to `newafro/website`.
2. Open `https://login.newafro.com`.
3. Sign in with GitHub.
4. Open `Journal`, `Events`, and `Artists` once.
5. Create a draft named `CMS test - delete after onboarding`.
6. Confirm `Draft` is enabled.
7. Save.
8. Confirm the draft appears in the CMS list.
9. Delete the draft or leave it clearly marked as a draft.
10. Open `https://preview.newafro.com` and review one page.

Stop if GitHub login fails, if saving fails, or if the designer sees any Git
branch/terminal/deployment language in the normal CMS flow.

## Session 2: Figma Review

Goal: collect design feedback without changing production.

1. Open `https://preview.newafro.com` on desktop.
2. Open the same URL on a phone.
3. Create a Figma page named with the review date:

   ```text
   [date] Preview Review
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
6. Send the Figma link with this summary:

   ```text
   Preview review ready.
   Fix before launch: [number]
   Missing asset: [number]
   Approved pages: [page names]
   ```

## Component-Based Feedback

For layout work, do not ask for a vague full-page redesign. Name the page and
component from [../design-system.md](../design-system.md).

Example:

```text
Fix before launch:
Page: Archive
Component: ArchiveTimeline / ArchiveProject
Viewport: mobile 390
Issue: project image strip crops too tightly; keep poster legible.
```

Then use [../figma-to-preview-workflow.md](../figma-to-preview-workflow.md) to
turn that feedback into a staged preview update.

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

## Stop Conditions

Stop and ask the operator to fix the system if:

- `https://preview.newafro.com` does not load.
- `https://login.newafro.com` does not load.
- GitHub login fails for a user who has accepted the repo invitation.
- CMS save fails.
- The browser shows a certificate/security warning.
- The designer is asked to bypass GitHub, HTTPS, or production approval.
