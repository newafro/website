# Designer Handover

This workflow assumes the designer is comfortable in Figma and Adobe, but is
new to websites and GitHub. The goal is to keep updates calm: edit safe content
in the CMS, review layout changes on preview, and promote only approved work to
production.

## What To Use

| Task | Best Tool | Notes |
| --- | --- | --- |
| Add or update events | New Afro Studio CMS | Goes to staging/preview first. |
| Add or update artist profiles | New Afro Studio CMS | Used by the Community page. |
| Draft journal posts | New Afro Studio CMS | Keep as draft until copy and credits are verified. |
| Review page layout, spacing, typography, image crop | Figma or screenshot comments | Send comments against `preview.newafro.com`. |
| Request structural page changes | WhatsApp or GitHub issue | Agent implements and opens preview. |
| Approve production | WhatsApp/GitHub approval text | Use `Approved for production`. |

## Daily Editing Flow

1. Open `https://login.newafro.com`.
2. Sign in with GitHub.
3. Choose `Events`, `Artists`, or `Journal`.
4. Edit text, image, date, status, or draft state.
5. Save/publish in the CMS.
6. Review the result on `https://preview.newafro.com`.
7. Share feedback in WhatsApp or mark it `Approved for production`.

The designer should not need to push Git commands manually. If a change needs
code, layout work, or a new page type, ask the agent to implement it and deploy
to preview.

## Figma Review Flow

Use Figma for visual direction, not as a separate source of website truth.

1. Take screenshots from `preview.newafro.com`.
2. Place screenshots in a Figma page named with the date, for example
   `2026-05-21 Preview Review`.
3. Comment directly on text size, spacing, image crop, missing assets, or page
   order.
4. Mark comments as one of:
   - `Fix before launch`
   - `Nice to improve`
   - `Missing asset`
   - `Approved`
5. Send the Figma link to the website agent or in the team WhatsApp group.

## Preview And Production

- Preview: `https://preview.newafro.com`
- Production: `https://newafro.com`

Preview is the review space. Production should only change after explicit
approval.

Recommended approval words:

```text
Approved for production
```

Recommended rejection words:

```text
Needs changes: [short reason]
Needs missing content: [what is missing]
Do not publish
```

## What Not To Invent

Do not publish uncertain copy, uncredited images, placeholder bios, or guessed
event details. Add those to
`docs/content-requests/release-content-requests.md` and keep the public page
hidden, draft, or minimal until the team provides the missing material.

## First Onboarding Session

In a 30-minute onboarding session, have the designer do this once:

1. Log in at `https://login.newafro.com`.
2. Open an existing event.
3. Change one harmless field, for example add a period to a draft description.
4. Save it.
5. Confirm it appears on preview.
6. Revert the harmless change.
7. Comment on one preview screenshot in Figma.

That is enough to understand the full loop without needing GitHub internals.
