# Preview-Only Review

Use this when the designer is ready to review the website visually but does not
yet need CMS access. This review does not require GitHub, Decap CMS, Render,
Namecheap, or production access.

## When To Use

Use this flow while any of these are still true:

- The designer does not yet have GitHub write access to `newafro/website`.
- The designer is only reviewing visual direction, not saving content.
- The team wants comments before opening CMS editing to another person.

Do not use this flow to save content. It is visual/content feedback only.

## Setup

1. Open `https://preview.newafro.com` on desktop.
2. Open `https://preview.newafro.com` on a phone, or use a mobile browser
   viewport.
3. Create a Figma page named with the review date:

   ```text
   [date] Preview Review
   ```

4. Add one desktop screenshot and one mobile screenshot for each page reviewed.

## Pages To Review

Review these first:

- Home
- Menu overlay
- Archive
- Events
- Projects
- Community
- The Agency
- Contact

If time is short, review Home, Menu, Archive, and Events first.

## Comment Labels

Use exactly one of these labels at the start of each comment:

```text
Fix before launch:
Nice to improve:
Missing asset:
Copy correction:
Approved:
```

Good comments are concrete:

```text
Fix before launch: Mobile archive cards feel too cropped; use more top/bottom image breathing room.
Missing asset: This event poster should use the original Galerie Zato flyer.
Copy correction: Contact address should use the confirmed public address.
Approved: Menu overlay feels close enough to the Wix reference.
```

Avoid vague comments like:

```text
Make it nicer.
Looks weird.
Something is off.
```

## What To Check

- Image crop and image quality.
- Missing or wrong images.
- Typographic feel compared with the Wix reference.
- Menu overlay spacing, color, and type style.
- Page order and section rhythm.
- Wrong addresses, names, dates, emails, or credits.
- Mobile text clipping, overlap, or awkward line breaks.
- Anything that looks generated, generic, or off-brand.

## Handoff

Send the Figma link or screenshot set with one short status:

```text
Preview review ready.
Fix before launch: [number]
Missing asset: [number]
Approved pages: [page names]
```

The implementation agent can then turn `Fix before launch`, `Missing asset`,
and `Copy correction` notes into issues or staging changes.

## Stop Conditions

Stop the review and report the blocker if:

- `https://preview.newafro.com` does not load.
- A page is blank or clearly broken on both desktop and mobile.
- Browser security warnings appear.
- The designer is asked to log in to CMS, GitHub, Render, or Namecheap.

CMS save testing is covered in [first-designer-test.md](first-designer-test.md)
and starts only after the person has accepted write access to `newafro/website`.
