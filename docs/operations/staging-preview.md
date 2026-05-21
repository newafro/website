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

It includes a Render blueprint (`render.yaml`) and can also run on any Node 20
host. For the current Namecheap DNS setup, Render is the lowest-friction path:

1. Create a GitHub OAuth app:

   ```text
   Application name: New Afro Studio CMS
   Homepage URL: https://newafro.com
   Authorization callback URL: https://decap-oauth.newafro.com/callback
   ```

2. Store the GitHub OAuth values in the OAuth proxy host:

   ```text
   GITHUB_OAUTH_ID
   GITHUB_OAUTH_SECRET
   PUBLIC_URL=https://decap-oauth.newafro.com
   GITHUB_REPO_PRIVATE=0
   ```

3. Deploy `newafro/decap-oauth` on Render as a web service or blueprint.
4. Add `decap-oauth.newafro.com` as a Render custom domain.
5. Add the exact CNAME target Render provides in Namecheap.

Do not guess the `decap-oauth` CNAME value. It depends on the Render service.
Do not point this host at GitHub Pages; the OAuth proxy needs server-side code
and secrets.

After DNS propagates, verify the custom domains in GitHub Pages settings for
`newafro/website-preview` and `newafro/login`, then enable HTTPS enforcement.

To check the current state and automatically enable HTTPS once GitHub Pages has
approved the certificates, run:

```bash
./scripts/check-pages-readiness.sh
```

The script exits non-zero until the full editor path is ready. That is expected
while `decap-oauth.newafro.com` is not deployed yet.

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
