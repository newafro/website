# Staging Preview

Production is `https://newafro.com`.
Staging is `https://preview.newafro.com`.
CMS login is `https://login.newafro.com`, which redirects to
`https://preview.newafro.com/admin/`.

The preview site is for design review, WhatsApp feedback, and team approval before a change reaches production.

## Branches

- `main` deploys production through `.github/workflows/deploy.yml`.
- `staging` deploys preview through `.github/workflows/deploy-preview.yml`.
- Work branches should open pull requests into `staging` first.
- Approved staging changes are promoted by opening a pull request from `staging` into `main`.

## Preview Hosting

The preview workflow builds this repository, then publishes the static `dist/` output to a separate GitHub Pages repository:

```text
newafro/website-preview
```

That repository should serve GitHub Pages from:

```text
branch: gh-pages
folder: /
custom domain: preview.newafro.com
```

The source repository needs this GitHub Actions secret:

```text
NEWAFRO_PREVIEW_DEPLOY_TOKEN
```

Use a fine-grained GitHub token with write access only to `newafro/website-preview` contents. Store the token in 1Password and mirror it into the `newafro/website` repository secret.

An SSH deploy key would be cleaner, but GitHub currently rejects deploy keys for this preview repository.

## DNS

Add this record in Namecheap:

```text
Type:  CNAME Record
Host:  preview
Value: newafro.github.io.
TTL:   Automatic
```

Do not add `A` or `AAAA` records for `preview`.

For the friendly CMS login URL, add this record too:

```text
Type:  CNAME Record
Host:  login
Value: newafro.github.io.
TTL:   Automatic
```

The `newafro/login` GitHub Pages repository serves only a tiny redirect page
from `login.newafro.com` to `https://preview.newafro.com/admin/`. The CMS
targets `staging`, so this keeps editors inside the review workflow by default.

The CMS also needs an OAuth proxy because Decap CMS cannot complete GitHub
login from a static GitHub Pages site without a small server-side callback.
Use this domain for that service:

```text
decap-oauth.newafro.com
```

The proxy source lives here:

```text
https://github.com/newafro/decap-oauth
```

Deployment is tracked here:

```text
https://github.com/newafro/decap-oauth/issues/1
```

It includes a Render Blueprint (`render.yaml`) and can also run on any Node 20
host. The Blueprint declares `decap-oauth.newafro.com`, uses `/healthz` as the
health check, and waits for checks to pass before auto-deploying. For the
current Namecheap DNS setup, Render is the lowest-friction path:

1. Create a GitHub OAuth app:

   ```text
   Application name: New Afro Studio CMS
   Homepage URL: https://newafro.com
   Authorization callback URL: https://decap-oauth.newafro.com/callback?provider=github
   ```

2. Store the GitHub OAuth values in the OAuth proxy host:

   ```text
   GITHUB_OAUTH_ID
   GITHUB_OAUTH_SECRET
   PUBLIC_URL=https://decap-oauth.newafro.com
   GITHUB_REPO_PRIVATE=0
   ```

3. Deploy `newafro/decap-oauth` on Render from the Blueprint.
4. Confirm Render shows `decap-oauth.newafro.com` as the custom domain.
5. Add the exact CNAME target Render provides in Namecheap.

The preferred guided command from the OAuth repo is:

```bash
cd /path/to/newafro-decap-oauth
GITHUB_OAUTH_ID=[from GitHub OAuth app] \
GITHUB_OAUTH_SECRET=[from GitHub OAuth app] \
npm run setup:operator
```

After Render shows the exact custom-domain target, rerun:

```bash
cd /path/to/newafro-decap-oauth
npm run check:render-blueprint
RENDER_CUSTOM_DOMAIN_TARGET=[exact Render DNS target] npm run setup:operator
```

This creates or reads the exact `New Afro Decap OAuth` 1Password item, syncs
the OAuth repo GitHub Actions secrets, prints the exact Namecheap record when
the Render target is present, and catches common wrong values such as
`newafro.github.io`, a value with `https://`, or a mismatched `PUBLIC_URL`.

If the OAuth credentials should stay out of the local shell, store
`GITHUB_OAUTH_ID` and `GITHUB_OAUTH_SECRET` as secrets in
`newafro/decap-oauth`, then run the same check from GitHub Actions:

```text
https://github.com/newafro/decap-oauth/actions/workflows/deploy-config-preflight.yml
```

Use the exact Render custom-domain DNS target as the workflow input.

After the GitHub OAuth secrets and Namecheap DNS are added, verify the operator
path from GitHub Actions:

```text
https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml
```

That workflow checks `decap-oauth.newafro.com` DNS and whether the OAuth repo
secrets are available to GitHub Actions without printing their values.

The Namecheap record must look like this:

```text
Type:  CNAME Record
Host:  decap-oauth
Value: [exact Render DNS target, no https://]
TTL:   Automatic
```

Do not guess the `decap-oauth` CNAME value. It depends on the Render service.
Do not point this host at GitHub Pages; the OAuth proxy needs server-side code
and secrets.

If `npm run check:cms-readiness` says `decap-oauth.newafro.com has no public
DNS result`, the record is not published from Namecheap yet. Check that the
record was added under the `newafro.com` Advanced DNS zone, not `newafro.net`,
and that the host field is `decap-oauth`, not the full
`decap-oauth.newafro.com` domain.

After DNS propagates, verify the custom domains in GitHub Pages settings for
`newafro/website-preview` and `newafro/login`, then enable HTTPS enforcement.

To check the current state and automatically enable HTTPS once GitHub Pages has
approved the certificates, run:

```bash
./scripts/check-pages-readiness.sh
```

The script exits non-zero until the full editor path is ready. It checks the
preview/login Pages certificates, HTTPS enforcement, whether
`preview.newafro.com/release.json` matches the current `staging` branch, the
preview CMS route, both friendly login entry points, the OAuth repo secret
names, and the OAuth proxy DNS/HTTP endpoints. That is expected to fail while
`decap-oauth.newafro.com` is not deployed yet or the OAuth repo secrets are
missing.

For a public check that can run without GitHub admin credentials, use:

```bash
npm run check:cms-readiness
```

For a rendered browser smoke check of the public preview and CMS login flow,
use:

```bash
npm run smoke:public
```

This command starts headless Chrome locally and verifies
`preview.newafro.com`, `preview.newafro.com/admin/`, and `login.newafro.com`
with desktop/mobile viewports. Set `CHROME_BIN` if Chrome is installed in a
non-standard path.

The staging deploy workflow also runs this smoke check after publishing the
preview site, so a green preview deploy means both the build and the public
browser route check passed.

The default branch also has a GitHub Actions public readiness monitor:

```text
https://github.com/newafro/website/actions/workflows/cms-readiness-public.yml
```

That `Public CMS Readiness` workflow runs manually and daily. It verifies the
public preview, friendly login URL, CMS config, and OAuth proxy endpoints. It
is expected to fail until `decap-oauth.newafro.com` is deployed and DNS is
added.

## Release Flow

1. A team member requests a website change in WhatsApp, Decap CMS, Figma, or GitHub.
2. The implementation agent creates a branch and pull request into `staging`.
3. Merging to `staging` deploys `https://preview.newafro.com`.
4. The team reviews the preview URL and gives clear feedback.
5. When approved, open a pull request from `staging` into `main`.
6. Merging to `main` deploys `https://newafro.com`.

CMS edits also target `staging`, so editors can update events, posts, and artists without accidentally publishing directly to production. See [team-access.md](team-access.md) for editor onboarding.

## Approval Language

Use clear review states:

- `Approved for production`
- `Needs changes`
- `Needs missing content`
- `Do not publish`

Avoid approving from vague messages like "looks fine" when the change affects production content, events, forms, navigation, or SEO.
