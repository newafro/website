#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { resolve4, resolveCname } from 'node:dns/promises';
import fs from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PREVIEW_URL = 'https://preview.newafro.com';
const LOGIN_URL = 'https://login.newafro.com';
const OAUTH_HOST = 'decap-oauth.newafro.com';
const OAUTH_URL = `https://${OAUTH_HOST}`;
const OAUTH_CALLBACK_URL = `${OAUTH_URL}/callback?provider=github`;
const OAUTH_REPO = 'newafro/decap-oauth';
const OAUTH_OPERATOR_WORKFLOW_URL = 'https://github.com/newafro/decap-oauth/actions/workflows/operator-access.yml';
const FIRST_DESIGNER_WORKFLOW_URL = 'https://github.com/newafro/website/actions/workflows/first-designer-readiness.yml';
const FIRST_DESIGNER_DOC_URL = 'docs/operations/first-designer-test.md';
const PREVIEW_REVIEW_DOC_URL = 'docs/operations/preview-only-review.md';
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
const cmsWarnings = [];

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

function warnCms(message) {
  cmsWarnings.push(message);
  console.log(`WARN ${message}`);
}

function writeStepSummary() {
  if (!process.env.GITHUB_STEP_SUMMARY) return;

  const previewReady = previewFailures.length === 0;
  const cmsReady = cmsFailures.length === 0;
  const summary = [
    '# New Afro First Designer Readiness',
    '',
    `Preview-only review: ${previewReady ? 'READY' : 'BLOCKED'}`,
    `CMS login/save dry run: ${cmsReady ? 'READY' : 'BLOCKED'}`,
    '',
    '## Entry Points',
    '',
    `- Preview: ${PREVIEW_URL}`,
    `- CMS login: ${LOGIN_URL}`,
    `- OAuth proxy: ${OAUTH_URL}`,
    '',
  ];

  if (previewReady) {
    summary.push(
      '## Preview Review',
      '',
      '- The designer can review the preview site on desktop/mobile and send Figma or screenshot feedback.',
      `- Use ${PREVIEW_REVIEW_DOC_URL} while CMS saving is still blocked.`,
      '',
    );
  } else {
    summary.push('## Preview Blockers', '');
    for (const failure of previewFailures) summary.push(`- ${failure}`);
    summary.push('');
  }

  if (cmsReady) {
    summary.push(
      '## CMS Login/Save',
      '',
      `- Start ${FIRST_DESIGNER_DOC_URL} with one safe draft entry.`,
      '',
    );
  } else {
    summary.push('## Required Before CMS Login/Save', '');
    for (const failure of cmsFailures) summary.push(`- ${failure}`);
    summary.push(
      '',
      '## Next Operator Action',
      '',
      '1. In `newafro/decap-oauth`, run `GITHUB_OAUTH_ID=... GITHUB_OAUTH_SECRET=... npm run setup:operator` after the GitHub OAuth app exists.',
      '2. Deploy the `newafro/decap-oauth` Render Blueprint; it declares `decap-oauth.newafro.com` and `/healthz` already.',
      '3. Rerun `RENDER_CUSTOM_DOMAIN_TARGET=[exact Render target] npm run setup:operator` to validate the Namecheap record.',
      '4. Add Namecheap `CNAME` record `decap-oauth` -> exact Render custom-domain DNS target.',
      `5. Rerun the OAuth operator preflight: ${OAUTH_OPERATOR_WORKFLOW_URL}`,
      `6. Rerun this first-designer readiness workflow: ${FIRST_DESIGNER_WORKFLOW_URL}`,
      '',
    );
  }

  if (cmsWarnings.length) {
    summary.push('## Warnings', '');
    for (const warning of cmsWarnings) summary.push(`- ${warning}`);
    summary.push('');
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
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

async function checkPreviewRelease() {
  const result = await run('node', ['scripts/check-preview-release.mjs']);
  const output = `${result.stdout || ''}${result.stderr ? `\n${result.stderr}` : ''}`.trim();
  if (output) console.log(output);

  if (result.ok) {
    pass('preview release marker matches the staging branch');
  } else {
    failPreview('preview release marker does not match the staging branch');
  }
}

async function checkOauthSecrets({ blockOnMissing = true } = {}) {
  const result = await run('gh', [
    'secret',
    'list',
    '--repo',
    OAUTH_REPO,
    '--json',
    'name',
  ]);

  if (!result.ok) {
    const message = `could not list GitHub Actions secrets for ${OAUTH_REPO}`;
    if (!blockOnMissing || process.env.GITHUB_ACTIONS === 'true') {
      warnCms(`${message}; relying on OAuth DNS/HTTP checks and the OAuth operator workflow instead`);
    } else {
      failCms(message);
    }
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
    } else if (blockOnMissing) {
      failCms(`${OAUTH_REPO} secret ${secret} is missing`);
    } else {
      warnCms(`${OAUTH_REPO} secret ${secret} is missing; live OAuth is healthy, so this is a monitoring/preflight warning rather than a designer blocker`);
    }
  }
}

async function checkOauthProxy({ dnsReady }) {
  const failureCountAtStart = cmsFailures.length;

  if (!dnsReady) {
    console.log('skipping OAuth HTTP checks until DNS exists');
    return false;
  }

  await checkPage('OAuth root', `${OAUTH_URL}/`, [], { cmsRequired: true });

  try {
    const { response, text } = await fetchText(`${OAUTH_URL}/healthz`);
    console.log(`health ${response.status} ${response.url}`);
    if (!response.ok) {
      failCms(`OAuth health returned HTTP ${response.status}`);
      return false;
    }

    const payload = JSON.parse(text);
    if (payload.ok !== true) {
      failCms(`OAuth health is not ok: ${text}`);
    } else if (payload.publicUrl !== OAUTH_URL) {
      failCms(`OAuth health reports wrong PUBLIC_URL: ${payload.publicUrl || '(missing)'}`);
    } else if (payload.callbackUrl !== OAUTH_CALLBACK_URL) {
      failCms(`OAuth health reports wrong callback URL: ${payload.callbackUrl || '(missing)'}`);
    } else if (!String(payload.scope || '').split(',').includes('user')) {
      failCms(`OAuth health reports scope without user: ${payload.scope || '(missing)'}`);
    } else {
      pass('OAuth health endpoint is ready and reports the expected callback');
    }
  } catch (error) {
    failCms(`OAuth health failed: ${error.message || error}`);
    return false;
  }

  try {
    const { response } = await fetchText(`${OAUTH_URL}/auth?provider=github`, {
      redirect: 'manual',
    });
    const location = response.headers.get('location') || '';
    console.log(`auth ${response.status} ${location}`);
    if (response.status !== 302 || !location.startsWith('https://github.com/login/oauth/authorize')) {
      failCms('OAuth auth endpoint does not redirect to GitHub authorize');
      return false;
    }

    const redirectUri = new URL(location).searchParams.get('redirect_uri');
    if (redirectUri !== OAUTH_CALLBACK_URL) {
      failCms(`OAuth auth endpoint has wrong callback URL: ${redirectUri || '(missing)'}`);
    } else {
      pass('OAuth auth endpoint uses the New Afro callback URL');
    }
  } catch (error) {
    failCms(`OAuth auth failed: ${error.message || error}`);
    return false;
  }

  return cmsFailures.length === failureCountAtStart;
}

console.log('New Afro first designer readiness');

section('Preview-Only Review');
await checkLocalContentAssets();
await checkPreviewRelease();
await checkDns('preview.newafro.com', { expectedCname: 'newafro.github.io' });
await checkDns('login.newafro.com', { expectedCname: 'newafro.github.io' });
await checkGithubPages('newafro/website-preview', 'preview.newafro.com');
await checkGithubPages('newafro/login', 'login.newafro.com');
await checkPage('Preview home', `${PREVIEW_URL}/`, ['New Afro', 'Where art connects cultures.']);
await checkPage('Preview admin', `${PREVIEW_URL}/admin/`, ['New Afro Studio']);
await checkPage('Friendly login page', `${LOGIN_URL}/`, [`${PREVIEW_URL}/admin/`]);
await checkPage('Friendly login admin path', `${LOGIN_URL}/admin/`, [`${PREVIEW_URL}/admin/`]);
await checkLiveCmsConfig();

section('CMS Login And Save Dry Run');
const oauthDnsReady = await checkDns(OAUTH_HOST, { cmsRequired: true });
const oauthProxyReady = await checkOauthProxy({ dnsReady: oauthDnsReady });
await checkOauthSecrets({ blockOnMissing: !oauthProxyReady });

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
  if (cmsWarnings.length) {
    console.log('');
    console.log('Warnings:');
    for (const warning of cmsWarnings) console.log(`- ${warning}`);
  }
  console.log('');
  console.log('Next operator action: in newafro/decap-oauth run setup:operator with the GitHub OAuth values, deploy the Render Blueprint, rerun setup:operator with the exact Render target, add Namecheap CNAME decap-oauth -> exact Render target, then rerun this command.');
} else {
  console.log('CMS login/save dry run: READY');
  console.log('- Start docs/operations/first-designer-test.md with one safe draft entry.');
  if (cmsWarnings.length) {
    console.log('');
    console.log('Warnings:');
    for (const warning of cmsWarnings) console.log(`- ${warning}`);
  }
}

writeStepSummary();

if (previewFailures.length || cmsFailures.length) {
  process.exit(1);
}
