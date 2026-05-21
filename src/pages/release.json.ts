import { env } from 'node:process';

export const prerender = true;

const release = {
  app: 'newafro-website',
  channel: env.RELEASE_CHANNEL || env.GITHUB_REF_NAME || 'local',
  sha: env.RELEASE_SHA || env.GITHUB_SHA || 'local',
  ref: env.RELEASE_REF || env.GITHUB_REF_NAME || 'local',
  siteUrl: env.SITE_URL || '',
  builtAt: env.RELEASE_BUILT_AT || new Date().toISOString(),
};

export function GET() {
  return new Response(`${JSON.stringify(release, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
