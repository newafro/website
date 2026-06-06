import { spawn, spawnSync } from 'node:child_process';
import { resolve4, resolveCname } from 'node:dns/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const previewUrl = (process.env.PREVIEW_URL || 'https://preview.newafro.com').replace(/\/$/, '');
const loginUrl = (process.env.LOGIN_URL || 'https://login.newafro.com').replace(/\/$/, '');
const oauthHost = process.env.OAUTH_HOST || 'decap-oauth.newafro.com';
const expectedReleaseSha = process.env.EXPECTED_RELEASE_SHA || '';
const expectedReleaseRef = process.env.EXPECTED_RELEASE_REF || '';
const expectedReleaseChannel = process.env.EXPECTED_RELEASE_CHANNEL || '';
const cacheToken = Date.now();
let oauthDnsReady = false;

const checks = [
  {
    name: 'preview desktop',
    url: `${previewUrl}/?smoke=${cacheToken}`,
    viewport: { width: 1440, height: 1000, mobile: false },
    waitMs: 6500,
    assert(page) {
      assertIncludes(page.href, previewUrl, 'preview desktop final URL');
      assertIncludes(page.title, 'New Afro', 'preview desktop title');
      assertIncludes(page.text, 'The Cultural and Creative Agency', 'preview desktop body');
    },
  },
  {
    name: 'preview mobile',
    url: `${previewUrl}/?smoke=${cacheToken}`,
    viewport: { width: 390, height: 844, mobile: true },
    waitMs: 6500,
    assert(page) {
      assertIncludes(page.href, previewUrl, 'preview mobile final URL');
      assertIncludes(page.title, 'New Afro', 'preview mobile title');
      assertIncludes(page.text, 'The Cultural and Creative Agency', 'preview mobile body');
    },
  },
  {
    name: 'admin desktop',
    url: `${previewUrl}/admin/?smoke=${cacheToken}`,
    viewport: { width: 1440, height: 1000, mobile: false },
    waitMs: 9000,
    assert(page) {
      assertIncludes(page.href, `${previewUrl}/admin/`, 'admin final URL');
      assertEqual(page.cmsLoaded, true, 'admin loads Decap CMS');
      assertEqual(page.configError, false, 'admin has no CMS config error');
      assertIncludes(page.text, 'Login with GitHub', 'admin login action');
      assertBlockedEditorStatus(page, 'admin');
    },
  },
  {
    name: 'login mobile',
    url: `${loginUrl}/?smoke=${cacheToken}`,
    viewport: { width: 390, height: 844, mobile: true },
    waitMs: 9000,
    assert(page) {
      assertIncludes(page.href, `${previewUrl}/admin/`, 'login redirects to preview admin');
      assertEqual(page.cmsLoaded, true, 'login destination loads Decap CMS');
      assertEqual(page.configError, false, 'login destination has no CMS config error');
      assertIncludes(page.text, 'Login with GitHub', 'login destination action');
      assertBlockedEditorStatus(page, 'login destination');
    },
  },
  {
    name: 'login admin mobile',
    url: `${loginUrl}/admin/?smoke=${cacheToken}`,
    viewport: { width: 390, height: 844, mobile: true },
    waitMs: 9000,
    assert(page) {
      assertIncludes(page.href, `${previewUrl}/admin/`, 'login admin redirects to preview admin');
      assertEqual(page.cmsLoaded, true, 'login admin destination loads Decap CMS');
      assertEqual(page.configError, false, 'login admin destination has no CMS config error');
      assertIncludes(page.text, 'Login with GitHub', 'login admin destination action');
      assertBlockedEditorStatus(page, 'login admin destination');
    },
  },
];

const failures = [];

function assertIncludes(actual, expected, label) {
  if (!String(actual || '').includes(expected)) {
    failures.push(`${label} should include ${expected}, got ${JSON.stringify(actual)}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    failures.push(`${label} should be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertBlockedEditorStatus(page, label) {
  if (oauthDnsReady) return;

  assertEqual(page.statusState, 'pending', `${label} OAuth pending status`);
  assertIncludes(
    page.statusText,
    'Website editing is waiting on login setup.',
    `${label} OAuth pending message`
  );
  assertIncludes(
    page.statusText,
    'GitHub sign-in needs the New Afro OAuth proxy',
    `${label} OAuth pending detail`
  );
  assertIncludes(
    page.statusText,
    'Design review can continue on preview now',
    `${label} OAuth pending review guidance`
  );
  assertIncludes(
    page.statusText,
    'preview.newafro.com',
    `${label} OAuth pending preview link`
  );
  assertIncludes(
    page.statusText,
    'OAuth operator preflight',
    `${label} OAuth operator preflight link`
  );
}

async function hasDnsResult(host) {
  const [cnames, addresses] = await Promise.all([
    resolveCname(host).catch(() => []),
    resolve4(host).catch(() => []),
  ]);
  return cnames.length > 0 || addresses.length > 0;
}

function findChrome() {
  const explicit = process.env.CHROME_BIN;
  if (explicit) return explicit;

  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(macChrome)) return macChrome;

  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }

  return '';
}

async function waitForJson(url, options, tries = 100) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
    } catch {}
    await sleep(100);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-store',
      'user-agent': 'newafro-public-smoke',
    },
  });
  const text = await response.text().catch(() => '');
  return { response, text };
}

function validateReleaseMarker(marker) {
  if (marker.app !== 'newafro-website') {
    failures.push(`release marker app should be newafro-website, got ${JSON.stringify(marker.app)}`);
  }

  if (!marker.sha) {
    failures.push('release marker is missing sha');
  }

  if (!marker.ref) {
    failures.push('release marker is missing ref');
  }

  if (expectedReleaseSha && marker.sha !== expectedReleaseSha) {
    failures.push(`release marker sha should be ${expectedReleaseSha}, got ${marker.sha || '(missing)'}`);
  }

  if (expectedReleaseRef && marker.ref !== expectedReleaseRef) {
    failures.push(`release marker ref should be ${expectedReleaseRef}, got ${marker.ref || '(missing)'}`);
  }

  if (expectedReleaseChannel && marker.channel !== expectedReleaseChannel) {
    failures.push(`release marker channel should be ${expectedReleaseChannel}, got ${marker.channel || '(missing)'}`);
  }
}

async function checkReleaseMarker() {
  const url = `${previewUrl}/release.json?smoke=${cacheToken}`;
  const tries = expectedReleaseSha ? 30 : 1;
  let lastStatus = '';
  let lastText = '';

  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const { response, text } = await fetchJson(url);
      lastStatus = `${response.status} ${response.url}`;
      lastText = text;

      if (response.ok) {
        const marker = JSON.parse(text);
        const shaMatches = !expectedReleaseSha || marker.sha === expectedReleaseSha;
        if (shaMatches) {
          console.log('\n== release marker ==');
          console.log(lastStatus);
          console.log(`sha: ${marker.sha}`);
          console.log(`ref: ${marker.ref}`);
          console.log(`channel: ${marker.channel}`);
          validateReleaseMarker(marker);
          return;
        }
      }
    } catch (error) {
      lastStatus = error.message || String(error);
    }

    if (attempt < tries) {
      await sleep(3000);
    }
  }

  failures.push(`release marker did not become ready at ${url}; last response: ${lastStatus} ${lastText.slice(0, 160)}`.trim());
}

async function stopChrome(chromeProcess) {
  if (chromeProcess.exitCode !== null || chromeProcess.killed) return;

  const exited = new Promise((resolve) => {
    chromeProcess.once('exit', resolve);
  });
  chromeProcess.kill('SIGKILL');
  await Promise.race([exited, sleep(2000)]);
}

async function removeTempDir(dir) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`Warning: could not remove temporary Chrome profile: ${error.message || error}`);
        return;
      }
      await sleep(200 * (attempt + 1));
    }
  }
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  const requests = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
      return;
    }

    if (message.method === 'Network.requestWillBeSent') {
      requests.set(message.params.requestId, message.params.request.url);
    }

    events.push(message);
  });

  const open = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, (message) => {
      if (message.error) {
        reject(new Error(`${method}: ${message.error.message}`));
      } else {
        resolve(message.result || {});
      }
    });
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });

  return {
    events,
    requests,
    close: () => ws.close(),
    open,
    send,
  };
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    throw new Error('Chrome/Chromium was not found. Set CHROME_BIN to run browser smoke checks.');
  }
  oauthDnsReady = await hasDnsResult(oauthHost);
  console.log(`OAuth DNS ready: ${oauthDnsReady}`);
  await checkReleaseMarker();

  const port = 10400 + Math.floor(Math.random() * 1000);
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'newafro-public-smoke-'));
  const chromeProcess = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });
  chromeProcess.unref();

  let cdp;
  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`, undefined, 300);
    const tabs = await waitForJson(`http://127.0.0.1:${port}/json/list`, undefined, 300);
    const page = tabs.find((tab) => tab.type === 'page')
      || await waitForJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });

    cdp = createCdpClient(page.webSocketDebuggerUrl);
    await cdp.open;
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');

    for (const check of checks) {
      cdp.events.length = 0;
      cdp.requests.clear();
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: check.viewport.width,
        height: check.viewport.height,
        deviceScaleFactor: check.viewport.mobile ? 3 : 1,
        mobile: check.viewport.mobile,
      });
      await cdp.send('Page.navigate', { url: check.url });
      await sleep(check.waitMs);

      const result = await cdp.send('Runtime.evaluate', {
        expression: `(() => ({
          href: location.href,
          title: document.title,
          text: document.body?.innerText.slice(0, 900) || '',
          cmsLoaded: Boolean(window.CMS),
          configError: document.body?.innerText.includes('Error loading the CMS configuration') || false,
          statusText: document.querySelector('#editor-status')?.innerText || '',
          statusState: document.querySelector('#editor-status')?.dataset?.state || '',
          videos: [...document.querySelectorAll('video')].map((video) => ({
            readyState: video.readyState,
            currentTime: video.currentTime,
            paused: video.paused,
          })),
          overflowX:
            Math.max(
              document.documentElement?.scrollWidth || 0,
              document.body?.scrollWidth || 0
            ) > (document.documentElement?.clientWidth || window.innerWidth) + 2,
        }))()`,
        returnByValue: true,
      });

      const pageState = result.result.value;
      const failedRequests = cdp.events
        .filter((event) => event.method === 'Network.loadingFailed')
        .map((event) => ({
          ...event.params,
          url: cdp.requests.get(event.params.requestId) || '',
        }))
        .filter((failure) => !failure.canceled)
        .map((failure) => `${failure.type} ${failure.url} ${failure.errorText || ''}`.trim());
      const exceptions = cdp.events
        .filter((event) => event.method === 'Runtime.exceptionThrown')
        .map((event) => event.params.exceptionDetails?.text || 'Runtime exception');

      console.log(`\n== ${check.name} ==`);
      console.log(`${pageState.href}`);
      console.log(`title: ${pageState.title}`);
      console.log(`cmsLoaded: ${pageState.cmsLoaded}`);
      if (pageState.statusText) console.log(`status: ${pageState.statusText}`);

      if (failedRequests.length) {
        failures.push(`${check.name} failed requests: ${failedRequests.join('; ')}`);
      }
      if (exceptions.length) {
        failures.push(`${check.name} JS exceptions: ${exceptions.join('; ')}`);
      }
      assertEqual(pageState.overflowX, false, `${check.name} has no horizontal overflow`);

      check.assert(pageState);
    }
  } finally {
    if (cdp) cdp.close();
    await stopChrome(chromeProcess);
    await removeTempDir(userDataDir);
  }

  if (failures.length) {
    console.error('\nBrowser smoke failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('\nBrowser smoke passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
