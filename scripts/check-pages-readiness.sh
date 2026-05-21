#!/usr/bin/env bash
set -euo pipefail

repos=(
  "newafro/website-preview preview.newafro.com"
  "newafro/login login.newafro.com"
)

readiness_failed=0

echo "New Afro Pages readiness"
echo

for entry in "${repos[@]}"; do
  read -r repo host <<<"$entry"
  echo "== $host ($repo) =="
  echo "DNS:"
  dig +short "$host" | sed 's/^/  /' || true

  page_json="$(gh api "repos/$repo/pages")"
  cname="$(jq -r '.cname // ""' <<<"$page_json")"
  enforced="$(jq -r '.https_enforced' <<<"$page_json")"
  cert_state="$(jq -r '.https_certificate.state // "missing"' <<<"$page_json")"
  cert_domains="$(jq -r '.https_certificate.domains // [] | join(", ")' <<<"$page_json")"

  echo "Pages:"
  echo "  cname: $cname"
  echo "  https_enforced: $enforced"
  echo "  certificate_state: $cert_state"
  if [[ -n "$cert_domains" ]]; then
    echo "  certificate_domains: $cert_domains"
  fi

  if [[ "$cert_state" == "approved" && "$enforced" != "true" ]]; then
    echo "  action: enabling HTTPS enforcement"
    printf '{"https_enforced":true}' |
      gh api --method PUT "repos/$repo/pages" --input - --jq '{cname,https_enforced,https_certificate}'
    enforced="true"
  elif [[ "$cert_state" == "approved" ]]; then
    echo "  action: HTTPS already enforced"
  else
    echo "  action: wait for GitHub Pages certificate"
  fi

  if [[ "$cname" != "$host" || "$cert_state" != "approved" || "$enforced" != "true" ]]; then
    readiness_failed=1
  fi

  echo
done

echo "== decap-oauth.newafro.com =="
echo "DNS:"
oauth_dns="$(dig +short decap-oauth.newafro.com || true)"
if [[ -n "$oauth_dns" ]]; then
  sed 's/^/  /' <<<"$oauth_dns"
else
  echo "  missing"
fi

if [[ -z "$oauth_dns" ]]; then
  echo "HTTP:"
  echo "  skipped, DNS is missing"
  echo
  echo "Health endpoint:"
  echo "  skipped, DNS is missing"
  echo
  echo "OAuth auth endpoint:"
  echo "  skipped, DNS is missing"
  echo "  status: blocked, DNS is missing"
  readiness_failed=1
else
  echo "HTTP:"
  oauth_root_headers="$(curl -sSI --max-time 15 https://decap-oauth.newafro.com/ || true)"
  oauth_root_status="$(awk 'NR == 1 { print $2 }' <<<"$oauth_root_headers")"
  sed -n '1,8p' <<<"$oauth_root_headers" | sed 's/^/  /'
  echo
  echo "Health endpoint:"
  oauth_health_headers="$(curl -sSI --max-time 15 https://decap-oauth.newafro.com/healthz || true)"
  oauth_health_status="$(awk 'NR == 1 { print $2 }' <<<"$oauth_health_headers")"
  sed -n '1,8p' <<<"$oauth_health_headers" | sed 's/^/  /'
  echo
  echo "OAuth auth endpoint:"
  oauth_auth_headers="$(curl -sSI --max-time 15 'https://decap-oauth.newafro.com/auth?provider=github' || true)"
  oauth_auth_status="$(awk 'NR == 1 { print $2 }' <<<"$oauth_auth_headers")"
  oauth_auth_location="$(awk 'BEGIN { IGNORECASE = 1 } /^location:/ { print }' <<<"$oauth_auth_headers" | tr -d '\r')"
  sed -n '1,10p' <<<"$oauth_auth_headers" | sed 's/^/  /'

  if [[ ! "$oauth_root_status" =~ ^(200|204)$ ]]; then
    echo "  status: blocked, root endpoint did not return 200/204"
    readiness_failed=1
  elif [[ "$oauth_health_status" != "200" ]]; then
    echo "  status: blocked, health endpoint did not return 200"
    readiness_failed=1
  elif [[ "$oauth_auth_status" != "302" || "$oauth_auth_location" != *"github.com/login/oauth/authorize"* ]]; then
    echo "  status: blocked, auth endpoint did not redirect to GitHub OAuth"
    readiness_failed=1
  else
    echo "  status: OAuth proxy ready"
  fi
fi

echo
if [[ "$readiness_failed" -ne 0 ]]; then
  echo "Readiness incomplete. Fix the blocked item(s) above before onboarding editors."
  exit 1
fi

echo "Readiness complete."
