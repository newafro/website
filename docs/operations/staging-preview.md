# Staging Preview

Production is `https://newafro.com`.
Staging is `https://preview.newafro.com`.

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

## DNS

Add this record in Namecheap:

```text
Type:  CNAME Record
Host:  preview
Value: newafro.github.io.
TTL:   Automatic
```

Do not add `A` or `AAAA` records for `preview`.

After DNS propagates, verify the custom domain in the `newafro/website-preview` GitHub Pages settings and enable HTTPS enforcement.

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
