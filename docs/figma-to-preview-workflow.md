# Figma To Preview Workflow

This is the working process for a New Afro designer who designs in Figma and
wants changes to appear on the website without learning deployments on day one.

## Short Version

```text
Figma proposal
-> GitHub issue or WhatsApp request
-> implementation agent updates Astro
-> push to staging
-> review on preview.newafro.com
-> approve production
-> merge to main
-> newafro.com updates
```

The designer should start with Figma and the CMS. Codex, Claude, or a developer
turns approved design requests into Astro code.

## Roles

| Role | Does | Does not do at first |
| --- | --- | --- |
| CMS editor | Updates events, journal posts, artists, images, dates, draft state | Terminal, SSH, direct production deploy |
| Designer | Creates Figma components, reviews preview, marks visual feedback | Push code directly to `main` |
| Implementation agent | Converts Figma request into Astro/CSS/content changes | Guess missing assets or publish without approval |
| Release operator | Checks preview and merges approved work to production | Rewrite design direction during release |

One person can hold multiple roles later. For onboarding, keep the roles
separate.

## Phase 1: CMS And Figma Only

This is the correct first step for non-technical team members.

Required access:

```text
GitHub account
Write access to newafro/website
CMS login at https://login.newafro.com
Figma file access
```

Editors can create or update:

- Events
- Journal posts
- Artist profiles
- Hero images and galleries
- Dates, locations, CTA links
- Draft/published state in the CMS workflow

Designers create Figma feedback and proposals, then hand them to the
implementation agent.

## Phase 2: Designer To Preview

Use this once the designer is comfortable reviewing preview.

Required for each request:

```text
Figma link:
Preview URL:
Page:
Component:
Viewport:
CMS fields that must remain editable:
Assets:
Approval owner:
```

Example:

```text
Figma link: https://figma.com/file/...
Preview URL: https://preview.newafro.com/archive/
Page: Archive
Component: ArchiveTimeline / ArchiveProject
Viewport: desktop 1440, mobile 390
CMS fields that must remain editable: none yet, keep current archive data
Assets: use Drive folder "DESIGN / Archive / Heritage"
Approval owner: Cheria
```

The implementation agent should push to `staging` only. The designer reviews
`https://preview.newafro.com`, not a screenshot from the developer machine.

## Phase 3: Release Operator

Only after several safe preview cycles should someone besides Kai publish.

The release operator needs to understand:

```text
staging = preview.newafro.com
main = newafro.com
checks must pass before merge
"Approved for production" is required
```

They do not need SSH if they use GitHub's browser UI.

## When SSH Or Local Code Is Needed

SSH/local development is optional and should come later.

Use local development only when the designer wants to run the site locally:

```bash
git clone git@github.com:newafro/website.git
cd website
npm ci
npm run dev
```

For most design work, GitHub issues, Figma links, Codex, Claude, or GitHub
Desktop are easier than terminal/SSH.

## Request Template

Use this exact text in GitHub issues, WhatsApp, or an agent prompt:

```text
Change type: CMS content / visual layout / new component / asset replacement
Page URL:
Astro component or page:
Figma link:
Desktop frame:
Mobile frame:
What should change:
What must stay the same:
CMS fields affected:
Assets/Drive links:
Approval owner:
Target: staging only
```

## Good Agent Prompt

```text
Implement the Figma changes for the Archive page.

Use:
- docs/design-system.md
- Page: /archive/
- Component: ArchiveTimeline / ArchiveProject
- Figma frame: [link]
- Keep current project content and image references.
- Match desktop 1440 and mobile 390.
- Push to staging only.
- Verify with npm run build and browser smoke.
```

## Bad Agent Prompt

```text
Make it look like the Figma.
```

That usually creates mismatch because the agent has to guess component names,
CMS constraints, mobile behavior, and asset intent.

## Review Checklist

Before approving production:

- Desktop preview matches Figma direction.
- Mobile preview matches Figma direction.
- Text does not overflow buttons/cards.
- Images are not visibly broken, missing, or badly cropped.
- CMS-editable content still comes from CMS fields.
- `npm run build` passes.
- Public smoke/readiness checks pass when relevant.
- Approval text is written clearly:

```text
Approved for production
```

## What Belongs In Figma

- New page layout direction.
- Component states and variants.
- Desktop/mobile visual rhythm.
- Image crop notes.
- Typography/spacing intent.
- Screenshot comments from preview.

## What Belongs In CMS

- Event details.
- Journal posts.
- Artist profiles.
- Draft/published state.
- Image uploads for content entries.
- Date/location/status/CTA fields.

## What Belongs In Code

- Navigation/menu behavior.
- Page templates.
- Layout structure.
- Component styling.
- Responsive breakpoints.
- New CMS fields or collections.
- Production release workflow.

If a request crosses CMS and code, do the CMS content first, then implement the
layout on `staging`.
