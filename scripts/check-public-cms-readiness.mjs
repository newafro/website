#!/usr/bin/env node
import { resolve4, resolveCname } from 'node:dns/promises';
import fs from 'node:fs';

const CHECK_TIMEOUT_MS = 15000;
const OAUTH_OPERATOR_WORKFLOW_URL = 'https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml';
const failures = [];
const lines = [];

function log(line = '') {
  console.log(line);
  lines.push(line);
}

function writeSummary() {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
  }
}

function normalizeHost(value) {
  return value.replace(/\.$/, '');
}

function pass(message) {
  log(`PASS ${message}`);
}

function fail(message) {
  failures.push(message);
  log(`FAIL ${message}`);
}

function printOauthDnsInstructions() {
  log('');
  log('Required Namecheap record for the OAuth proxy:');
  log('  Type:  CNAME Record');
  log('  Host:  decap-oauth');
  log('  Value: the exact Render custom-domain target, without https://');
  log('  TTL:   Automatic');
  log('');
  log('The record must be in the newafro.com Advanced DNS zone and must not point to GitHub Pages.');
  log('');
  log('After adding OAuth repo secrets and DNS, run the OAuth operator preflight:');
  log(`  ${OAUTH_OPERATOR_WORKFLOW_URL}`);
}

async function withTimeout(promise, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`${label} timed out`)), CHECK_TIMEOUT_MS);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, options = {}) {
  return withTimeout(async (signal) => {
    const response = await fetch(url, {
      redirect: options.redirect || 'follow',
      method: options.method || 'GET',
      signal,
      headers: {
        'User-Agent': 'newafro-cms-readiness-check',
        ...options.headers,
      },
    });
    const text = await response.text().catch(() => '');
    return { response, text };
  }, url);
}

async function checkDns(host, { expectedCname } = {}) {
  log(`\n== DNS: ${host} ==`);
  let cnames = [];
  let addresses = [];

  try {
    cnames = await resolveCname(host);
  } catch {
    cnames = [];
  }

  try {
    addresses = await resolve4(host);
  } catch {
    addresses = [];
  }

  if (cnames.length > 0) {
    log(`CNAME ${cnames.join(', ')}`);
  }
  if (addresses.length > 0) {
    log(`A ${addresses.join(', ')}`);
  }

  if (cnames.length === 0 && addresses.length === 0) {
    fail(`${host} has no public DNS result`);
    return false;
  }

  if (expectedCname) {
    const normalized = cnames.map(normalizeHost);
    if (!normalized.includes(expectedCname)) {
      fail(`${host} CNAME should include ${expectedCname}`);
      return false;
    }
  }

  pass(`${host} resolves`);
  return true;
}

async function checkPage(name, url, expectedText = []) {
  log(`\n== Page: ${name} ==`);
  try {
    const { response, text } = await fetchText(url);
    log(`${response.status} ${response.url}`);

    if (!response.ok) {
      fail(`${name} returned HTTP ${response.status}`);
      return;
    }

    for (const needle of expectedText) {
      if (!text.includes(needle)) {
        fail(`${name} missing expected text: ${needle}`);
        return;
      }
    }

    pass(`${name} is reachable`);
  } catch (error) {
    fail(`${name} failed: ${error.message}`);
  }
}

async function checkCmsConfig() {
  log('\n== CMS Config ==');
  try {
    const { response, text } = await fetchText('https://preview.newafro.com/admin/config.yml');
    log(`${response.status} ${response.url}`);

    if (!response.ok) {
      fail(`CMS config returned HTTP ${response.status}`);
      return;
    }

    const required = [
      'repo: newafro/website',
      'branch: staging',
      'base_url: https://decap-oauth.newafro.com',
      'auth_endpoint: /auth',
      'display_url: https://preview.newafro.com',
      'label: "Journal"',
      'label: "Events"',
      'label: "Artists"',
    ];

    for (const needle of required) {
      if (!text.includes(needle)) {
        fail(`CMS config missing ${needle}`);
        return;
      }
    }

    const draftDefaults = text.match(/name:\s*"draft"[^}\n]*default:\s*true/g) || [];
    if (draftDefaults.length < 3) {
      fail('CMS config should default Journal, Events, and Artists entries to Draft: true');
      return;
    }

    const galleryFields = text.match(/name:\s*"gallery"[\s\S]*?field:\s*\{ label:\s*"Image", name:\s*"image", widget:\s*"image" \}/g) || [];
    if (galleryFields.length < 2) {
      fail('CMS config should keep Journal and Events galleries as scalar image lists');
      return;
    }

    pass('CMS config targets staging and includes editor collections');
    pass('CMS config defaults new editor entries to drafts');
    pass('CMS config gallery fields match the Astro content schema');
  } catch (error) {
    fail(`CMS config failed: ${error.message}`);
  }
}

async function checkOauthProxy({ dnsReady }) {
  log('\n== OAuth Proxy ==');

  if (!dnsReady) {
    log('skipped because decap-oauth.newafro.com has no DNS result');
    printOauthDnsInstructions();
    return;
  }

  try {
    const root = await fetchText('https://decap-oauth.newafro.com/');
    log(`root ${root.response.status} ${root.response.url}`);
    if (!root.response.ok) {
      fail(`OAuth root returned HTTP ${root.response.status}`);
      return;
    }
  } catch (error) {
    fail(`OAuth root failed: ${error.message}`);
    return;
  }

  try {
    const health = await fetchText('https://decap-oauth.newafro.com/healthz');
    log(`health ${health.response.status} ${health.response.url}`);
    if (!health.response.ok) {
      fail(`OAuth health returned HTTP ${health.response.status}`);
      return;
    }
    const payload = JSON.parse(health.text);
    if (payload.ok !== true) {
      fail(`OAuth health is not ok: ${health.text}`);
      return;
    }
  } catch (error) {
    fail(`OAuth health failed: ${error.message}`);
    return;
  }

  try {
    const auth = await fetchText('https://decap-oauth.newafro.com/auth?provider=github', {
      redirect: 'manual',
    });
    const location = auth.response.headers.get('location') || '';
    log(`auth ${auth.response.status} ${location}`);
    if (auth.response.status !== 302 || !location.startsWith('https://github.com/login/oauth/authorize')) {
      fail('OAuth auth endpoint does not redirect to GitHub authorize');
      return;
    }

    const redirectUri = new URL(location).searchParams.get('redirect_uri');
    if (redirectUri !== 'https://decap-oauth.newafro.com/callback?provider=github') {
      fail(`OAuth auth endpoint has wrong GitHub callback URL: ${redirectUri || '(missing)'}`);
      return;
    }
  } catch (error) {
    fail(`OAuth auth failed: ${error.message}`);
    return;
  }

  pass('OAuth proxy is ready for Decap CMS login');
}

log('New Afro public CMS readiness');

await checkDns('preview.newafro.com', { expectedCname: 'newafro.github.io' });
await checkDns('login.newafro.com', { expectedCname: 'newafro.github.io' });
const oauthDnsReady = await checkDns('decap-oauth.newafro.com');

await checkPage('Preview home', 'https://preview.newafro.com/', ['New Afro', 'Where art connects cultures.']);
await checkPage('Preview admin', 'https://preview.newafro.com/admin/', ['New Afro Studio']);
await checkPage('Friendly login page', 'https://login.newafro.com/', ['https://preview.newafro.com/admin/']);
await checkCmsConfig();
await checkOauthProxy({ dnsReady: oauthDnsReady });

log('\n== Summary ==');
if (failures.length > 0) {
  for (const failure of failures) {
    log(`- ${failure}`);
  }
  writeSummary();
  process.exit(1);
}

log('All public CMS readiness checks passed.');
writeSummary();
