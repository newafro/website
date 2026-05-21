#!/usr/bin/env node
import { resolve4, resolveCname } from 'node:dns/promises';

const CHECK_TIMEOUT_MS = 15000;
const failures = [];

function normalizeHost(value) {
  return value.replace(/\.$/, '');
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  failures.push(message);
  console.log(`FAIL ${message}`);
}

function printOauthDnsInstructions() {
  console.log('');
  console.log('Required Namecheap record for the OAuth proxy:');
  console.log('  Type:  CNAME Record');
  console.log('  Host:  decap-oauth');
  console.log('  Value: the exact Render custom-domain target, without https://');
  console.log('  TTL:   Automatic');
  console.log('');
  console.log('The record must be in the newafro.com Advanced DNS zone and must not point to GitHub Pages.');
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
  console.log(`\n== DNS: ${host} ==`);
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
    console.log(`CNAME ${cnames.join(', ')}`);
  }
  if (addresses.length > 0) {
    console.log(`A ${addresses.join(', ')}`);
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
  console.log(`\n== Page: ${name} ==`);
  try {
    const { response, text } = await fetchText(url);
    console.log(`${response.status} ${response.url}`);

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
  console.log('\n== CMS Config ==');
  try {
    const { response, text } = await fetchText('https://preview.newafro.com/admin/config.yml');
    console.log(`${response.status} ${response.url}`);

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

    pass('CMS config targets staging and includes editor collections');
  } catch (error) {
    fail(`CMS config failed: ${error.message}`);
  }
}

async function checkOauthProxy({ dnsReady }) {
  console.log('\n== OAuth Proxy ==');

  if (!dnsReady) {
    console.log('skipped because decap-oauth.newafro.com has no DNS result');
    printOauthDnsInstructions();
    return;
  }

  try {
    const root = await fetchText('https://decap-oauth.newafro.com/');
    console.log(`root ${root.response.status} ${root.response.url}`);
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
    console.log(`health ${health.response.status} ${health.response.url}`);
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
    console.log(`auth ${auth.response.status} ${location}`);
    if (auth.response.status !== 302 || !location.startsWith('https://github.com/login/oauth/authorize')) {
      fail('OAuth auth endpoint does not redirect to GitHub authorize');
      return;
    }
  } catch (error) {
    fail(`OAuth auth failed: ${error.message}`);
    return;
  }

  pass('OAuth proxy is ready for Decap CMS login');
}

console.log('New Afro public CMS readiness');

await checkDns('preview.newafro.com', { expectedCname: 'newafro.github.io' });
await checkDns('login.newafro.com', { expectedCname: 'newafro.github.io' });
const oauthDnsReady = await checkDns('decap-oauth.newafro.com');

await checkPage('Preview home', 'https://preview.newafro.com/', ['New Afro', 'Where art connects cultures.']);
await checkPage('Preview admin', 'https://preview.newafro.com/admin/', ['New Afro Studio']);
await checkPage('Friendly login page', 'https://login.newafro.com/', ['https://preview.newafro.com/admin/']);
await checkCmsConfig();
await checkOauthProxy({ dnsReady: oauthDnsReady });

console.log('\n== Summary ==');
if (failures.length > 0) {
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
  process.exit(1);
}

console.log('All public CMS readiness checks passed.');
