# OAuth Operator Quickstart

Use this when the next human has GitHub, Render, Namecheap, and optionally
1Password access. This is the remaining blocker before New Afro CMS login/save
can be tested.

## Current Split

```text
Preview review: READY
CMS login/save: BLOCKED
Production promotion: BLOCKED
```

The designer can review `https://preview.newafro.com` now. Do not ask anyone to
save CMS content until this checklist passes.

## Create OAuth App

Create or verify the GitHub OAuth app:

```text
Application name: New Afro Studio CMS
Homepage URL: https://newafro.com
Authorization callback URL: https://decap-oauth.newafro.com/callback?provider=github
```

GitHub OAuth app page:

```text
https://github.com/settings/applications/new
```

## Add Secrets

Add these as repository secrets in `newafro/decap-oauth`:

```text
GITHUB_OAUTH_ID
GITHUB_OAUTH_SECRET
```

Secrets page:

```text
https://github.com/newafro/decap-oauth/settings/secrets/actions
```

Trusted-shell alternative from the OAuth repo:

```bash
GITHUB_OAUTH_ID=[from GitHub OAuth app] \
GITHUB_OAUTH_SECRET=[from GitHub OAuth app] \
npm run setup:operator
```

## Deploy Render

Deploy from:

```text
https://render.com/deploy?repo=https://github.com/newafro/decap-oauth
```

Use the committed Blueprint. It already declares:

```text
Custom domain: decap-oauth.newafro.com
Health check: /healthz
Node: 20
```

When Render asks for environment variables, set:

```text
GITHUB_OAUTH_ID=[from GitHub OAuth app]
GITHUB_OAUTH_SECRET=[from GitHub OAuth app]
PUBLIC_URL=https://decap-oauth.newafro.com
GITHUB_REPO_PRIVATE=0
```

These are Render service environment variables. They are separate from the
GitHub Actions repository secrets above, even when the values are the same.

Copy Render's exact custom-domain DNS target for
`decap-oauth.newafro.com`. Do not guess it.

## Validate Before Namecheap

From the OAuth repo, validate the Render target before editing DNS:

```bash
RENDER_CUSTOM_DOMAIN_TARGET=[exact Render target] npm run setup:operator
```

No-local-secrets alternative:

```text
https://github.com/newafro/decap-oauth/actions/workflows/deploy-config-preflight.yml
```

## Add Namecheap DNS

In the `newafro.com` Advanced DNS zone, add exactly:

```text
Type:  CNAME Record
Host:  decap-oauth
Value: [exact Render custom-domain DNS target, no https://]
TTL:   Automatic
```

Do not use:

```text
Host:  decap-oauth.newafro.com
Value: https://...
Value: newafro.github.io
```

## Verify

From `newafro/decap-oauth`:

```bash
npm run status:setup
npm run check:live
npm run check:operator
```

From `newafro/website`:

```bash
npm run status:release
npm run check:cms-readiness
npm run smoke:public
npm run check:first-designer
```

CMS onboarding can start only when those pass.

## Source Of Truth

OAuth blocker issue:

```text
https://github.com/newafro/decap-oauth/issues/1
```

Full Render/Namecheap runbook:

```text
https://github.com/newafro/decap-oauth/blob/main/docs/render-namecheap-runbook.md
```
