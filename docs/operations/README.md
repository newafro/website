# New Afro Operations Index

Start here when handing the site to a designer, operator, or implementation
agent. The preview site is ready for visual review; CMS saving is still blocked
until the Decap OAuth proxy is deployed and DNS is published.

## Current Status

```text
Production: https://newafro.com
Preview:    https://preview.newafro.com
CMS login:  https://login.newafro.com
OAuth:      https://decap-oauth.newafro.com
```

- `newafro.com`, `preview.newafro.com`, and `login.newafro.com` are on GitHub
  Pages with approved HTTPS certificates and HTTPS enforcement.
- `login.newafro.com` opens the preview CMS route.
- `decap-oauth.newafro.com` still needs the Render custom-domain CNAME in
  Namecheap before GitHub CMS login and saving can work.

## Use The Right Checklist

- [Release handoff](release-handoff.md): short operator summary for the current
  launch state and CMS blocker.
- [Preview-only review](preview-only-review.md): use this now with the designer
  before CMS login is ready.
- [First designer test](first-designer-test.md): use this after OAuth passes,
  to prove login and one safe draft save.
- [Designer handover](designer-handover.md): explains the Figma, CMS, preview,
  and production approval workflow.
- [Staging preview](staging-preview.md): technical setup for preview, login,
  OAuth, DNS, and release flow.
- [Team access](team-access.md): access checklist for Gus, Maria, Cheria, Ken,
  or any future editor.
- [WhatsApp website assistant](whatsapp-website-assistant.md): parked design for
  the later Hermes-style feedback assistant.

## Next Operator Step

Finish the OAuth proxy setup in `newafro/decap-oauth`:

```text
https://github.com/newafro/decap-oauth/issues/1
```

If OAuth secrets should stay out of local shells, add `GITHUB_OAUTH_ID` and
`GITHUB_OAUTH_SECRET` as GitHub Actions secrets in `newafro/decap-oauth`, then
run the deploy-config preflight with the exact Render custom-domain DNS target:

```text
https://github.com/newafro/decap-oauth/actions/workflows/deploy-config-preflight.yml
```

After the Namecheap `decap-oauth` CNAME and OAuth repo secrets are in place,
run:

```text
https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml
```

Only start the first real CMS save test after that operator preflight and
`npm run check:cms-readiness` pass.

## Verification Commands

From the website repo:

```bash
./scripts/check-pages-readiness.sh
npm run check:cms-readiness
npm run smoke:public
```

`./scripts/check-pages-readiness.sh` is the best operator-side first check: it
confirms preview/login HTTPS, reports whether the OAuth repo secrets exist, and
then checks the OAuth proxy DNS/HTTP path.

From the OAuth repo:

```bash
npm run check:live
```
