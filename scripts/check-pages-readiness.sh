#!/usr/bin/env bash
set -euo pipefail

repos=(
  "newafro/website-preview preview.newafro.com"
  "newafro/login login.newafro.com"
)

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
  elif [[ "$cert_state" == "approved" ]]; then
    echo "  action: HTTPS already enforced"
  else
    echo "  action: wait for GitHub Pages certificate"
  fi

  echo
done

echo "== decap-oauth.newafro.com =="
echo "DNS:"
dig +short decap-oauth.newafro.com | sed 's/^/  /' || true
echo "HTTP:"
curl -sSI --max-time 15 https://decap-oauth.newafro.com/ | sed -n '1,8p' | sed 's/^/  /' || true
echo
echo "Expected OAuth auth check after deployment:"
echo "  curl -I 'https://decap-oauth.newafro.com/auth?provider=github'"
