#!/usr/bin/env node
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const STRICT_RELEASE = process.env.STRICT_RELEASE === '1';
const OAUTH_REPO = 'newafro/decap-oauth';
const OAUTH_CALLBACK_URL = 'https://decap-oauth.newafro.com/callback?provider=github';
const GITHUB_OAUTH_APP_URL = 'https://github.com/settings/applications/new';
const OAUTH_SECRETS_URL = `https://github.com/${OAUTH_REPO}/settings/secrets/actions`;
const RENDER_DEPLOY_URL = `https://render.com/deploy?repo=https://github.com/${OAUTH_REPO}`;
const OAUTH_SETUP_STATUS_URL = `https://github.com/${OAUTH_REPO}/actions/workflows/setup-status.yml`;
const OAUTH_LIVE_READINESS_URL = `https://github.com/${OAUTH_REPO}/actions/workflows/live-readiness.yml`;
const OAUTH_OPERATOR_PREFLIGHT_URL = `https://github.com/${OAUTH_REPO}/actions/workflows/operator-access.yml`;
const OAUTH_RUNBOOK_URL = `https://github.com/${OAUTH_REPO}/blob/main/docs/render-namecheap-runbook.md`;
const OAUTH_QUICKSTART_DOC = 'docs/operations/oauth-operator-quickstart.md';

const checks = [
  {
    key: 'previewRelease',
    label: 'Preview serves current staging SHA',
    command: 'node',
    args: ['scripts/check-preview-release.mjs'],
    requiredForPreview: true,
    requiredForCms: true,
  },
  {
    key: 'previewReview',
    label: 'Preview-only designer review',
    command: 'node',
    args: ['scripts/check-first-designer-readiness.mjs'],
    env: { PREVIEW_REVIEW_ONLY: '1' },
    requiredForPreview: true,
    requiredForCms: true,
  },
  {
    key: 'publicSmoke',
    label: 'Rendered browser smoke',
    command: 'node',
    args: ['scripts/smoke-public-browser.mjs'],
    timeoutMs: 120000,
    requiredForPreview: true,
    requiredForCms: true,
  },
  {
    key: 'cmsReadiness',
    label: 'Public CMS OAuth readiness',
    command: 'node',
    args: ['scripts/check-public-cms-readiness.mjs'],
    requiredForPreview: false,
    requiredForCms: true,
  },
  {
    key: 'firstDesigner',
    label: 'CMS onboarding login/save gate',
    command: 'node',
    args: ['scripts/check-first-designer-readiness.mjs'],
    requiredForPreview: false,
    requiredForCms: true,
  },
];

function section(title) {
  console.log(`\n== ${title} ==`);
}

function statusLine(ok, label) {
  console.log(`${ok ? 'PASS' : 'BLOCKED'} ${label}`);
}

function summarizeBlockers(output) {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const interesting = [];
  for (const line of lines) {
    if (
      line.startsWith('- decap-oauth.') ||
      line.startsWith('- newafro/decap-oauth secret') ||
      line.includes('decap-oauth.newafro.com has no public DNS result') ||
      line.includes('GITHUB_OAUTH_ID is missing') ||
      line.includes('GITHUB_OAUTH_SECRET is missing') ||
      line.includes('x-render-routing: no-server') ||
      line.includes('CMS login/save dry run:') ||
      line.includes('Preview-only review:')
    ) {
      interesting.push(line.replace(/^(FAIL|BLOCKED)\s+/, '').replace(/^-+\s*/, ''));
    }
  }

  return [...new Set(interesting)].slice(0, 12);
}

async function runCheck(check) {
  try {
    const result = await execFileAsync(check.command, check.args, {
      env: { ...process.env, ...(check.env || {}) },
      timeout: check.timeoutMs || 45000,
      maxBuffer: 1024 * 1024 * 20,
    });
    return {
      ...check,
      ok: true,
      output: `${result.stdout || ''}${result.stderr || ''}`,
    };
  } catch (error) {
    return {
      ...check,
      ok: false,
      output: `${error.stdout || ''}${error.stderr || error.message || ''}`,
    };
  }
}

function writeStepSummary(results, previewReady, cmsReady) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;

  const summary = [
    '# New Afro Release Status',
    '',
    `Preview/design review: ${previewReady ? 'READY' : 'BLOCKED'}`,
    `CMS login/save: ${cmsReady ? 'READY' : 'BLOCKED'}`,
    `Production promotion: ${cmsReady ? 'READY FOR FINAL HUMAN APPROVAL' : 'BLOCKED'}`,
    '',
    '## Entry Points',
    '',
    '- Preview: https://preview.newafro.com',
    '- CMS login: https://login.newafro.com',
    '- OAuth proxy: https://decap-oauth.newafro.com',
    '',
    '## Checks',
    '',
  ];

  for (const result of results) {
    summary.push(`- ${result.ok ? 'PASS' : 'BLOCKED'} ${result.label}`);
  }

  const blockers = results.flatMap((result) => (result.ok ? [] : summarizeBlockers(result.output)));
  if (blockers.length) {
    summary.push('', '## Current Blockers', '');
    for (const blocker of [...new Set(blockers)]) summary.push(`- ${blocker}`);
  }

  summary.push(
    '',
    '## Next Action',
    '',
    cmsReady
      ? '- Run the real one-person CMS login/save onboarding test from `docs/operations/first-designer-test.md`.'
      : '- Finish the `newafro/decap-oauth` Render/OAuth/Namecheap setup, then rerun `npm run status:release`.',
    '',
  );

  if (!cmsReady) {
    summary.push(
      '## OAuth Operator Links',
      '',
      `- Website quickstart: ${OAUTH_QUICKSTART_DOC}`,
      `- GitHub OAuth app setup: ${GITHUB_OAUTH_APP_URL}`,
      `- OAuth repo secrets: ${OAUTH_SECRETS_URL}`,
      `- Render deploy from repo: ${RENDER_DEPLOY_URL}`,
      `- OAuth setup status: ${OAUTH_SETUP_STATUS_URL}`,
      `- OAuth live readiness: ${OAUTH_LIVE_READINESS_URL}`,
      `- OAuth operator preflight: ${OAUTH_OPERATOR_PREFLIGHT_URL}`,
      `- Render/Namecheap runbook: ${OAUTH_RUNBOOK_URL}`,
      '',
    );
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
}

section('New Afro Release Status');
console.log('Preview: https://preview.newafro.com');
console.log('CMS login: https://login.newafro.com');
console.log('OAuth proxy: https://decap-oauth.newafro.com');

const results = [];
for (const check of checks) {
  section(check.label);
  const result = await runCheck(check);
  results.push(result);
  statusLine(result.ok, check.label);

  if (!result.ok) {
    const blockers = summarizeBlockers(result.output);
    if (blockers.length) {
      for (const blocker of blockers) console.log(`- ${blocker}`);
    } else {
      console.log(`Run manually for details: ${check.command} ${check.args.join(' ')}`);
    }
  }
}

const previewReady = results.every((result) => !result.requiredForPreview || result.ok);
const cmsReady = results.every((result) => !result.requiredForCms || result.ok);

section('Decision');
console.log(`Preview/design review: ${previewReady ? 'READY' : 'BLOCKED'}`);
console.log(`CMS login/save: ${cmsReady ? 'READY' : 'BLOCKED'}`);
console.log(`Production promotion: ${cmsReady ? 'READY FOR FINAL HUMAN APPROVAL' : 'BLOCKED'}`);

if (previewReady && !cmsReady) {
  section('Next Operator Action');
  console.log('Finish the OAuth proxy setup before CMS onboarding:');
  console.log(`1. Create/verify the GitHub OAuth app callback: ${OAUTH_CALLBACK_URL}`);
  console.log(`   ${GITHUB_OAUTH_APP_URL}`);
  console.log(`2. Add GITHUB_OAUTH_ID and GITHUB_OAUTH_SECRET to ${OAUTH_SECRETS_URL}`);
  console.log('3. Deploy newafro/decap-oauth on Render and attach decap-oauth.newafro.com.');
  console.log(`   ${RENDER_DEPLOY_URL}`);
  console.log('4. Add Namecheap CNAME: Host decap-oauth -> exact Render custom-domain target.');
  console.log('5. Rerun npm run status:release.');
  console.log('');
  console.log('Operator links:');
  console.log(`- Website quickstart: ${OAUTH_QUICKSTART_DOC}`);
  console.log(`- OAuth setup status: ${OAUTH_SETUP_STATUS_URL}`);
  console.log(`- OAuth live readiness: ${OAUTH_LIVE_READINESS_URL}`);
  console.log(`- OAuth operator preflight: ${OAUTH_OPERATOR_PREFLIGHT_URL}`);
  console.log(`- Render/Namecheap runbook: ${OAUTH_RUNBOOK_URL}`);
}

writeStepSummary(results, previewReady, cmsReady);

if (!previewReady) process.exitCode = 1;
if (STRICT_RELEASE && !cmsReady) process.exitCode = 1;
