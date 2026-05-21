import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const previewUrl = (process.env.PREVIEW_URL || 'https://preview.newafro.com').replace(/\/$/, '');
const loginUrl = (process.env.LOGIN_URL || 'https://login.newafro.com').replace(/\/$/, '');
const cacheToken = Date.now();

const checks = [
  {
    name: 'preview desktop',
    url: `${previewUrl}/?smoke=${cacheToken}`,
    viewport: { width: 1440, height: 1000, mobile: false },
    waitMs: 6500,
    assert(page) {
      assertIncludes(page.href, previewUrl, 'preview desktop final URL');
      assertIncludes(page.title, 'New Afro', 'preview desktop title');
      assertIncludes(page.text, 'Where art connects cultures.', 'preview desktop body');
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
      assertIncludes(page.text, 'Where art connects cultures.', 'preview mobile body');
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
  if (typeof WebSocket !== 'function') {
    throw new Error('This smoke check needs a Node runtime with global WebSocket support.');
  }

  const chrome = findChrome();
  if (!chrome) {
    throw new Error('Chrome/Chromium was not found. Set CHROME_BIN to run browser smoke checks.');
  }

  const port = 10400 + Math.floor(Math.random() * 1000);
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'newafro-public-smoke-'));
  const chromeProcess = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
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
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    const tabs = await waitForJson(`http://127.0.0.1:${port}/json/list`);
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

      check.assert(pageState);
    }
  } finally {
    if (cdp) cdp.close();
    chromeProcess.kill('SIGKILL');
    await rm(userDataDir, { recursive: true, force: true });
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
