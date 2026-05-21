#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { resolve4, resolveCname } from 'node:dns/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PREVIEW_URL = 'https://preview.newafro.com';
const LOGIN_URL = 'https://login.newafro.com';
const OAUTH_HOST = 'decap-oauth.newafro.com';
const OAUTH_URL = `https://${OAUTH_HOST}`;
const OAUTH_REPO = 'newafro/decap-oauth';
const REQUIRED_OAUTH_SECRETS = ['GITHUB_OAUTH_ID', 'GITHUB_OAUTH_SECRET'];
const REQUIRED_CONFIG_TEXT = [
  'repo: newafro/website',
  'branch: staging',
  'base_url: https://decap-oauth.newafro.com',
  'auth_endpoint: /auth',
  'label: "Journal"',
  'label: "Events"',
  'label: "Artists"',
];

const previewFailures = [];
const cmsFailures = [];

function section(title) {
  console.log(`\n== ${title} ==`);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function failPreview(message) {
  previewFailures.push(message);
  console.log(`FAIL ${message}`);
}

function failCms(message) {
  cmsFailures.push(message);
  console.log(`FAIL ${message}`);
}

function normalizeHost(value) {
  return value.replace(/\.$/, '');
}

async function run(command, args) {
  try {
    const result = await execFileAsync(command, args, {
      timeout: 15000,
      maxBuffer: 1024 * 1024 * 10,
    });
    return { ok: true, stdout: result.stdout || '', stderr: result.stderr || '' };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
    };
  }
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      redirect: options.redirect || 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'newafro-first-designer-readiness',
      },
    });
    const text = await response.text().catch(() => '');
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

async function readDns(host) {
  const [cnames, addresses] = await Promise.all([
    resolveCname(host).catch(() => []),
    resolve4(host).catch(() => []),
  ]);

  return { cnames, addresses };
}

async function checkDns(host, { expectedCname, cmsRequired = false } = {}) {
  const { cnames, addresses } = await readDns(host);
  if (cnames.length) console.log(`CNAME ${host}: ${cnames.join(', ')}`);
  if (addresses.length) console.log(`A ${host}: ${addresses.join(', ')}`);

  if (!cnames.length && !addresses.length) {
    const message = `${host} has no public DNS result`;
    if (cmsRequired) failCms(message);
    else failPreview(message);
    return false;
  }

  if (expectedCname) {
    const normalized = cnames.map(normalizeHost);
    if (!normalized.includes(expectedCname)) {
      failPreview(`${host} CNAME should include ${expectedCname}`);
      return false;
    }
  }

  pass(`${host} resolves`);
  return true;
}

async function checkPage(label, url, expectedText, { cmsRequired = false } = {}) {
  try {
    const { response, text } = await fetchText(url);
    console.log(`${response.status} ${response.url}`);
    if (!response.ok) {
      const message = `${label} returned HTTP ${response.status}`;
      if (cmsRequired) failCms(message);
      else failPreview(message);
      return '';
    }

    for (const needle of expectedText) {
      if (!text.includes(needle)) {
        const message = `${label} missing expected text: ${needle}`;
        if (cmsRequired) failCms(message);
        else failPreview(message);
        return text;
      }
    }

    pass(`${label} is reachable`);
    return text;
  } catch (error) {
    const message = `${label} failed: ${error.message || error}`;
    if (cmsRequired) failCms(message);
    else failPreview(message);
    return '';
  }
}

async function checkLiveCmsConfig() {
  const text = await checkPage('Preview CMS config', `${PREVIEW_URL}/admin/config.yml`, REQUIRED_CONFIG_TEXT);
  if (!text) return;

  const draftDefaults = text.match(/name:\s*"draft"[^}\n]*default:\s*true/g) || [];
  if (draftDefaults.length < 3) {
    failPreview('CMS config should default Journal, Events, and Artists entries to Draft: true');
  } else {
    pass('CMS config defaults new Journal, Events, and Artists entries to drafts');
  }

  const galleryFields = text.match(/name:\s*"gallery"[\s\S]*?field:\s*\{ label:\s*"Image", name:\s*"image", widget:\s*"image" \}/g) || [];
  if (galleryFields.length < 2) {
    failPreview('CMS config should keep Journal and Events galleries as scalar image lists');
  } else {
    pass('CMS config gallery fields match the Astro string-array schema');
  }
}

async function checkGithubPages(repo, host) {
  const result = await run('gh', ['api', `repos/${repo}/pages`]);
  if (!result.ok) {
    failPreview(`could not inspect GitHub Pages for ${repo}`);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout || '{}');
  } catch {
    failPreview(`could not parse GitHub Pages response for ${repo}`);
    return;
  }

  if (payload.cname !== host) {
    failPreview(`${repo} Pages cname should be ${host}, got ${payload.cname || '(missing)'}`);
  } else {
    pass(`${repo} Pages cname is ${host}`);
  }

  if (payload.https_certificate?.state !== 'approved') {
    failPreview(`${repo} Pages HTTPS certificate is not approved`);
  } else {
    pass(`${repo} Pages HTTPS certificate is approved`);
  }

  if (payload.https_enforced !== true) {
    failPreview(`${repo} Pages HTTPS enforcement is not enabled`);
  } else {
    pass(`${repo} Pages HTTPS enforcement is enabled`);
  }
}

async function checkLocalContentAssets() {
  const result = await run('node', ['scripts/check-content-assets.mjs']);
  const output = `${result.stdout || ''}${result.stderr ? `\n${result.stderr}` : ''}`.trim();
  if (output) console.log(output);

  if (result.ok) {
    pass('local upload references resolve under public/uploads');
  } else {
    failPreview('local upload reference check failed');
  }
}

async function checkOauthSecrets() {
  const result = await run('gh', [
    'secret',
    'list',
    '--repo',
    OAUTH_REPO,
    '--json',
    'name',
  ]);

  if (!result.ok) {
    failCms(`could not list GitHub Actions secrets for ${OAUTH_REPO}`);
    return;
  }

  let rows = [];
  try {
    rows = JSON.parse(result.stdout || '[]');
  } catch {
    failCms(`could not parse GitHub Actions secrets for ${OAUTH_REPO}`);
    return;
  }

  const names = new Set(rows.map((row) => row.name));
  for (const secret of REQUIRED_OAUTH_SECRETS) {
    if (names.has(secret)) {
      pass(`${OAUTH_REPO} secret ${secret} exists`);
    } else {
      failCms(`${OAUTH_REPO} secret ${secret} is missing`);
    }
  }
}

async function checkOauthProxy({ dnsReady }) {
  if (!dnsReady) {
    console.log('skipping OAuth HTTP checks until DNS exists');
    return;
  }

  await checkPage('OAuth root', `${OAUTH_URL}/`, [], { cmsRequired: true });

  try {
    const { response, text } = await fetchText(`${OAUTH_URL}/healthz`);
    console.log(`health ${response.status} ${response.url}`);
    if (!response.ok) {
      failCms(`OAuth health returned HTTP ${response.status}`);
      return;
    }

    const payload = JSON.parse(text);
    if (payload.ok !== true) {
      failCms(`OAuth health is not ok: ${text}`);
    } else {
      pass('OAuth health endpoint is ready');
    }
  } catch (error) {
    failCms(`OAuth health failed: ${error.message || error}`);
  }

  try {
    const { response } = await fetchText(`${OAUTH_URL}/auth?provider=github`, {
      redirect: 'manual',
    });
    const location = response.headers.get('location') || '';
    console.log(`auth ${response.status} ${location}`);
    if (response.status !== 302 || !location.startsWith('https://github.com/login/oauth/authorize')) {
      failCms('OAuth auth endpoint does not redirect to GitHub authorize');
      return;
    }

    const redirectUri = new URL(location).searchParams.get('redirect_uri');
    if (redirectUri !== `${OAUTH_URL}/callback?provider=github`) {
      failCms(`OAuth auth endpoint has wrong callback URL: ${redirectUri || '(missing)'}`);
    } else {
      pass('OAuth auth endpoint uses the New Afro callback URL');
    }
  } catch (error) {
    failCms(`OAuth auth failed: ${error.message || error}`);
  }
}

console.log('New Afro first designer readiness');

section('Preview-Only Review');
await checkLocalContentAssets();
await checkDns('preview.newafro.com', { expectedCname: 'newafro.github.io' });
await checkDns('login.newafro.com', { expectedCname: 'newafro.github.io' });
await checkGithubPages('newafro/website-preview', 'preview.newafro.com');
await checkGithubPages('newafro/login', 'login.newafro.com');
await checkPage('Preview home', `${PREVIEW_URL}/`, ['New Afro', 'Where art connects cultures.']);
await checkPage('Preview admin', `${PREVIEW_URL}/admin/`, ['New Afro Studio']);
await checkPage('Friendly login page', `${LOGIN_URL}/`, [`${PREVIEW_URL}/admin/`]);
await checkLiveCmsConfig();

section('CMS Login And Save Dry Run');
const oauthDnsReady = await checkDns(OAUTH_HOST, { cmsRequired: true });
await checkOauthSecrets();
await checkOauthProxy({ dnsReady: oauthDnsReady });

section('Summary');
if (previewFailures.length) {
  console.log('Preview-only review: BLOCKED');
  for (const failure of previewFailures) console.log(`- ${failure}`);
} else {
  console.log('Preview-only review: READY');
  console.log('- The designer can review preview.newafro.com on desktop/mobile and send Figma or screenshot feedback.');
}

if (cmsFailures.length) {
  console.log('CMS login/save dry run: BLOCKED');
  for (const failure of cmsFailures) console.log(`- ${failure}`);
  console.log('');
  console.log('Next operator action: add OAuth repo secrets, deploy the Render OAuth proxy, add Namecheap CNAME decap-oauth -> exact Render DNS target, then rerun this command.');
} else {
  console.log('CMS login/save dry run: READY');
  console.log('- Start docs/operations/first-designer-test.md with one safe draft entry.');
}

if (previewFailures.length || cmsFailures.length) {
  process.exit(1);
}
