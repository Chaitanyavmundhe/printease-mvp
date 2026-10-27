import { expect, it } from 'vitest';
import { isAllowedPreviewOrigin } from '../originPolicy.js';
it('does not trust another Vercel tenant containing the project name', () => {
  expect(isAllowedPreviewOrigin('https://evil-printease.vercel.app', { ALLOW_VERCEL_PREVIEW_ORIGINS: 'true' })).toBe(false);
});
it('requires the opt-in flag and exact configured HTTPS preview', () => {
  const env = { ALLOW_VERCEL_PREVIEW_ORIGINS: 'true', VERCEL_PREVIEW_ORIGINS: 'https://printease-trusted.vercel.app' };
  expect(isAllowedPreviewOrigin('https://printease-trusted.vercel.app', env)).toBe(true);
  expect(isAllowedPreviewOrigin('http://printease-trusted.vercel.app', env)).toBe(false);
  expect(isAllowedPreviewOrigin('https://printease-trusted.vercel.app.evil.test', env)).toBe(false);
  expect(isAllowedPreviewOrigin('https://printease-trusted.vercel.app', { ...env, ALLOW_VERCEL_PREVIEW_ORIGINS: 'false' })).toBe(false);
});
