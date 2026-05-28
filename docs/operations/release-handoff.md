# Release Handoff

Use this when handing the site to an operator or designer before a review call.

## Live URLs

```text
Production: https://newafro.com
Preview:    https://preview.newafro.com
CMS login:  https://login.newafro.com
OAuth:      https://decap-oauth.newafro.com
```

## Current Release State

- Production is deployed from `main`.
- Preview is deployed from `staging`.
- CMS edits save to `staging`, then appear on `preview.newafro.com`.
- Production updates require explicit approval and a merge to `main`.
- Decap OAuth is live on Render and `decap-oauth.newafro.com`.

## One-Command Status

From the website repo:

```bash
npm run status:release
```

Expected before onboarding:

```text
Preview/design review: READY
CMS login/save: READY
Production promotion: READY FOR FINAL HUMAN APPROVAL
```

If CMS readiness fails, run:

```bash
npm run check:cms-readiness
npm run smoke:public
```

From the OAuth repo:

```bash
npm run check:live
```

## Publish Rule

Only promote preview to production after someone writes:

```text
Approved for production
```

Anything else stays on preview.

## Editor Access Rule

Each editor needs:

1. GitHub account.
2. Accepted write invitation to `newafro/website`.
3. Successful login at `https://login.newafro.com`.
4. One safe draft-save test.

GitHub login can succeed even when save fails if the user only has read access.

## Designer Access Rule

The designer starts with:

- Figma access.
- CMS access.
- Preview review.
- GitHub issue/WhatsApp design requests.

Do not start them with SSH, terminal, or production deploys. Use:

- [../design-system.md](../design-system.md)
- [../figma-to-preview-workflow.md](../figma-to-preview-workflow.md)
- [designer-handover.md](designer-handover.md)

## Production Promotion Checklist

- `preview.newafro.com` reviewed on desktop and mobile.
- CMS draft/content changes are approved.
- Figma/layout differences are resolved or accepted.
- `npm run build` passes for code changes.
- `npm run status:release` is green or has only explained non-blocking warnings.
- Approval text exists: `Approved for production`.
- Merge `staging` to `main`.
- Confirm `https://newafro.com/release.json` updates to the new production SHA.
