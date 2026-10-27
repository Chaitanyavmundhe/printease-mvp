export function normalizeHttpOrigin(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

// Project-name substrings do not prove who owns a Vercel deployment. Require
// exact operator-listed preview origins, not arbitrary *printease*.vercel.app.
export function isAllowedPreviewOrigin(value, env = process.env) {
  if (env.ALLOW_VERCEL_PREVIEW_ORIGINS !== 'true') return false;
  const origin = normalizeHttpOrigin(value);
  if (!origin || !origin.startsWith('https://') || !new URL(origin).hostname.endsWith('.vercel.app')) return false;
  const allowed = String(env.VERCEL_PREVIEW_ORIGINS || '').split(',').map(item => normalizeHttpOrigin(item.trim())).filter(Boolean);
  return allowed.includes(origin);
}
