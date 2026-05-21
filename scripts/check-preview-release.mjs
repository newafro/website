#!/usr/bin/env node

const previewUrl = (process.env.PREVIEW_URL || 'https://preview.newafro.com').replace(/\/$/, '');
const websiteRepo = process.env.WEBSITE_REPO || 'newafro/website';
const expectedBranch = process.env.EXPECTED_RELEASE_REF || 'staging';
const expectedChannel = process.env.EXPECTED_RELEASE_CHANNEL || 'preview';
const expectedSiteUrl = process.env.EXPECTED_RELEASE_SITE_URL || previewUrl;
const expectedShaOverride = process.env.EXPECTED_RELEASE_SHA || '';
const timeoutMs = Number(process.env.RELEASE_CHECK_TIMEOUT_MS || 15000);
const failures = [];

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  failures.push(message);
  console.log(`FAIL ${message}`);
}

function header(title) {
  console.log(`\n== ${title} ==`);
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'newafro-preview-release-check',
        ...(process.env.GITHUB_TOKEN && url.startsWith('https://api.github.com/')
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text().catch(() => '');
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  const { response, text } = await fetchText(url, options);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${url} did not return JSON: ${error.message}`);
  }
}

async function readExpectedSha() {
  if (expectedShaOverride) return expectedShaOverride;

  const apiUrl = `https://api.github.com/repos/${websiteRepo}/git/ref/heads/${expectedBranch}`;
  const payload = await fetchJson(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });
  const sha = payload?.object?.sha;
  if (!sha) {
    throw new Error(`GitHub ref ${websiteRepo}@${expectedBranch} did not include object.sha`);
  }
  return sha;
}

async function main() {
  console.log('New Afro preview release marker');

  header('Expected Staging Head');
  let expectedSha = '';
  try {
    expectedSha = await readExpectedSha();
    console.log(`${websiteRepo}@${expectedBranch}: ${expectedSha}`);
  } catch (error) {
    fail(`could not read expected staging SHA: ${error.message || error}`);
  }

  header('Preview Marker');
  let marker = {};
  try {
    const markerUrl = `${previewUrl}/release.json?check=${Date.now()}`;
    marker = await fetchJson(markerUrl);
    console.log(`app: ${marker.app || '(missing)'}`);
    console.log(`channel: ${marker.channel || '(missing)'}`);
    console.log(`ref: ${marker.ref || '(missing)'}`);
    console.log(`sha: ${marker.sha || '(missing)'}`);
    console.log(`siteUrl: ${marker.siteUrl || '(missing)'}`);
  } catch (error) {
    fail(`could not read preview release marker: ${error.message || error}`);
  }

  header('Assertions');
  if (marker.app === 'newafro-website') {
    pass('release marker app is newafro-website');
  } else {
    fail(`release marker app should be newafro-website, got ${marker.app || '(missing)'}`);
  }

  if (marker.channel === expectedChannel) {
    pass(`release marker channel is ${expectedChannel}`);
  } else {
    fail(`release marker channel should be ${expectedChannel}, got ${marker.channel || '(missing)'}`);
  }

  if (marker.ref === expectedBranch) {
    pass(`release marker ref is ${expectedBranch}`);
  } else {
    fail(`release marker ref should be ${expectedBranch}, got ${marker.ref || '(missing)'}`);
  }

  if (marker.siteUrl === expectedSiteUrl) {
    pass(`release marker siteUrl is ${expectedSiteUrl}`);
  } else {
    fail(`release marker siteUrl should be ${expectedSiteUrl}, got ${marker.siteUrl || '(missing)'}`);
  }

  if (expectedSha && marker.sha === expectedSha) {
    pass('preview is serving the current staging SHA');
  } else if (expectedSha) {
    fail(`release marker sha should be ${expectedSha}, got ${marker.sha || '(missing)'}`);
  }

  header('Summary');
  if (failures.length) {
    for (const failure of failures) console.log(`- ${failure}`);
    process.exit(1);
  }

  console.log('Preview release marker matches the current staging branch.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
