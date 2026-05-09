const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const u = (path: string): string => {
  if (!path) return BASE || '/';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('mailto:') || path.startsWith('#')) return path;
  if (BASE && (path === BASE || path.startsWith(`${BASE}/`))) return path;
  return `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};
