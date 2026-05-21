# Team Access

Gus, Maria, Cheria, and Ken should be able to update the website through the CMS and give feedback through WhatsApp.

## Access Model

There are two team-facing entry points today:

```text
CMS editing:      https://login.newafro.com
Preview review:   WhatsApp group + https://preview.newafro.com
Production site:  https://newafro.com
```

After the staged CMS/login routes are promoted to production,
`https://newafro.com/login/` can be used as a production-domain fallback. Do
not use that URL for onboarding until the production release has been promoted
and smoke-tested.

The team should not need to understand Git branches for daily work. The system maps simple actions onto the release flow:

- CMS edits publish to `staging`
- `staging` deploys to `preview.newafro.com`
- approved preview changes are promoted to `main`
- `main` deploys to `newafro.com`

`login.newafro.com` intentionally opens the preview CMS, because editors should
review their changes on staging before anything reaches production.

For a designer-friendly version of the workflow, see
[designer-handover.md](designer-handover.md).

## Required People

| Person | CMS login | WhatsApp feedback | Production approval |
| --- | --- | --- | --- |
| Gus | yes | yes | yes |
| Maria | yes | yes | yes |
| Cheria | yes | yes | yes |
| Ken | yes | yes | yes |

## CMS Login Setup

The CMS uses GitHub login through the Decap OAuth proxy. Each person needs:

1. A GitHub account.
2. Access to `newafro/website` with write permission, ideally through a `website-editors` team in the `newafro` GitHub organization.
3. A working New Afro OAuth proxy at `https://decap-oauth.newafro.com`.
4. A successful login test at `https://login.newafro.com`.

Editors do not need direct write access to `newafro/website-preview`; the preview deploy token handles that.

## WhatsApp Setup

The WhatsApp bot should allow the approved New Afro group and the four named team members. The friendly path is account whitelisting, not a technical pairing flow for each teammate.

Recommended setup:

1. Pair the bot once with the WhatsApp bridge account.
2. Add that bot account to the New Afro team group.
3. Whitelist Gus, Maria, Cheria, and Ken by WhatsApp phone number.
4. Let each person confirm once in the group with a message such as `New Afro, it's Maria`.
5. Store the confirmed WhatsApp identity next to their name.

After that, the team can just write naturally in the group.

Store the operational values in 1Password, not in the repository:

```text
New Afro Website Bot / WhatsApp group id
New Afro Website Bot / allowed phone numbers
New Afro Website Bot / GitHub token for issue and PR creation
New Afro Website Preview Deploy / NEWAFRO_PREVIEW_DEPLOY_TOKEN
New Afro Decap OAuth / decap-oauth.newafro.com client id and secret
```

The OAuth proxy source is `https://github.com/newafro/decap-oauth`.

The public readiness monitor is:

```text
https://github.com/newafro/website/actions/workflows/cms-readiness-public.yml
```

Use it after DNS or OAuth changes to confirm whether editor login is ready.

The bot should accept feedback from the group, create or update GitHub issues, and post only useful summaries back to WhatsApp.

## Minimal Onboarding Message

Send this to each team member once access is ready:

```text
You can update the New Afro website here:
https://login.newafro.com

After the production release is deployed, this fallback should also work:
https://newafro.com/login/

Sign in with GitHub.

Your edits first go to preview:
https://preview.newafro.com

Nothing goes to the public site until the preview is approved.

For feedback, write in the WhatsApp group:
"New Afro, please change ..."
or reply:
"Approved for production"
```

## Access Checklist

- [ ] Gus has GitHub write access to `newafro/website`
- [ ] Maria has GitHub write access to `newafro/website`
- [ ] Cheria has GitHub write access to `newafro/website`
- [ ] Ken has GitHub write access to `newafro/website`
- [ ] All four can log in at `https://login.newafro.com`
- [ ] WhatsApp bot can read the approved New Afro group
- [ ] WhatsApp bot can identify the four approved team members
- [ ] Preview deploy succeeds at `https://preview.newafro.com`
- [ ] Production publish requires explicit approval text
