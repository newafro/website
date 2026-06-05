# New Afro Website Design System

Use this as the bridge between Figma and the Astro codebase. The goal is not to
limit the visual direction. The goal is to make sure design decisions survive
the trip from Figma to `preview.newafro.com`.

## Core Rule

Every Figma frame should name the website page, component, and content source
it is changing.

Good:

```text
Page: Archive
Component: ArchiveTimeline / ArchiveProject
Source: hard-coded archive project list today
Viewport: desktop 1440 and mobile 390
```

Risky:

```text
Make archive more premium.
```

## Figma Pages To Create

Create these pages in the New Afro Figma file:

```text
00 Website Components / Astro Mapping
01 Page Reviews
02 New Layout Proposals
03 CMS Content Examples
04 Asset Notes
```

`00 Website Components / Astro Mapping` is the important one. It should contain
the reusable website blocks below, using the same names as this document.

The fastest way to seed that Figma page is to import the live design kit:

```text
https://preview.newafro.com/design-kit/
```

Import it once at desktop `1440px` and once at mobile `390px`, then duplicate
the imported frames before remixing them.

## Design Tokens

The code tokens live in `src/styles/tokens.css`. Figma should mirror these
tokens as styles or variables.

| Figma token | Code token | Use |
| --- | --- | --- |
| Ink | `--na-ink` | Primary text and black page titles |
| Paper | `--na-paper` | White surfaces |
| Cream | `--na-cream` / `--na-cream-warm` | Warm page and menu text backgrounds |
| Sand | `--na-sand` | Muted section backgrounds |
| Bronze | `--na-bronze` | Links, buttons, warm accents |
| Display Serif | `--na-font-display` | Italic editorial headings |
| Page Display | `--na-font-page-display` | Large uppercase page titles |
| Body | `--na-font-body` | Paragraph text |
| Container | `--na-container` | Normal content width |
| Text Container | `--na-container-text` | Article/detail text width |

Do not use viewport-width text scaling in Figma specs. Provide desktop and
mobile type sizes or use the existing code scale.

## Component Map

| Figma component | Astro/source | Used on | Designer can change | CMS can change |
| --- | --- | --- | --- | --- |
| `SiteHeader` | `src/components/Header.astro` | All pages | Logo placement, menu icon, overlay style, nav layout | No |
| `MenuOverlay` | `src/components/Header.astro` | All pages | Background, nav typography, spacing, mobile menu behavior | No |
| `HomeHero` | `src/pages/index.astro` | Home | Hero composition, video/image treatment, title placement | No |
| `PageHero` | page files and `src/components/Hero.astro` | Content pages | Title scale, media treatment, section intro layout | Some image/text via content only where wired |
| `ArchiveTimeline` | `src/components/ArchiveTimeline.astro` | Archive | Timeline structure, project strip, image ratios, mobile stacking | Not yet |
| `ArchiveProject` | `src/components/ArchiveTimeline.astro` | Archive | Per-project row/card visual system | Not yet |
| `EventList` | `src/pages/events.astro` | Events | List spacing, card layout, button style | Event text/images/dates/status |
| `EventCard` | `src/pages/events.astro` | Events | Card visual design and responsive behavior | Event title, image, date, location, CTA/status |
| `EventDetail` | `src/pages/event-details-registration/[slug].astro` | Event pages | Article layout, gallery treatment, back link style | Event body, gallery, date/location, CTA |
| `ArtistGrid` | `src/pages/community.astro` | Community | Grid density, portrait crop, card typography | Artist profile text/image/order |
| `ArtistCard` | `src/pages/community.astro` | Community | Portrait ratio, name/role/body styling | Artist profile fields |
| `ProjectPage` | `src/pages/projects.astro` | Projects | Page structure, artist panel, CTA placement | No |
| `AgencyPage` | `src/components/AgencyPage.astro` | The Agency | Layout, image rhythm, copy hierarchy | No |
| `ContactLanding` | `src/components/ContactLanding.astro` | Contact | Contact layout and typography | No |
| `Footer` | `src/components/Footer.astro` | All pages | Footer grouping, newsletter treatment, link layout | No |
| `BlogCard` | `src/components/BlogCard.astro` | Journal/blog lists | Card style and image ratio | Journal title/date/image/category |
| `NewAfroStudio` | `src/pages/admin.astro`, `public/admin/config.yml` | CMS | Onboarding copy only, not Decap internals | CMS collections/fields |

If a Figma proposal does not map to one of these components, write which new
component should exist and where it should be used.

## CMS Fields

These fields are safe for editors to change in New Afro Studio:

### Events

```text
title
description
date_label
start_date
location
city
status
cta_label
cta_url
hero_image
hero_alt
gallery
body_ready
order
draft
body
```

### Journal

```text
title
description
date
author
category
tags
hero_image
hero_alt
gallery
draft
body
```

### Artists

```text
name
role
city
country
disciplines
portrait
portrait_alt
short_bio
website
instagram
featured
order
draft
long bio
```

Layout, spacing, typography, and navigation are code changes, not CMS changes.

## Figma Frame Requirements

For every design change request, include:

- Desktop frame at `1440px` wide.
- Mobile frame at `390px` wide.
- The real text, not short placeholder text.
- Real or representative images with source notes.
- The page URL and component name.
- Notes for what CMS fields should remain editable.
- Any missing assets marked as `Missing asset`, not faked.

If only one viewport is designed, the implementation should not be considered
ready for production.

## Asset Rules

- Use actual New Afro imagery when available.
- Preserve useful image ratios in Figma, especially event posters and artist
  portraits.
- Mark low-quality or temporary images as `Missing asset`.
- Do not crop important faces, artwork, event dates, or logos in the mobile
  frame.
- Include image credit/source notes when known.

## Preview Is The Source Of Truth

Figma is the design proposal. `https://preview.newafro.com` is the approval
surface.

A design change is not done until:

- It is deployed to preview.
- Desktop and mobile preview are checked.
- The designer confirms whether preview matches the intended Figma direction.
- Any differences are either fixed or accepted.

Use this approval sentence:

```text
Approved for production
```

Without that exact approval, keep changes on preview.
