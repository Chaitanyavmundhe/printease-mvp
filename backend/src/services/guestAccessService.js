import crypto from 'crypto';

export function createGuestToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashGuestToken(token) {
  if (typeof token !== 'string' || !token || token.length > 512) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getGuestExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

export function assertGuestCanUseDocument({ guestTokenHash, document }) {
  // Repository models are camelCase. Treat absent/expired capabilities as a
  // denial, never as a public upload merely because userId is absent.
  if (!document) {
    throw new Error('Document not found');
  }

  // If document belongs to a user, a guest should not be able to use it
  if (document.userId) {
    throw new Error('Unauthorized: Document belongs to a registered user');
  }

  if (!document.guestTokenHash || !guestTokenHash || document.guestTokenHash !== guestTokenHash) {
    throw new Error('Unauthorized: Invalid guest token for this document');
  }

  const expiresAt = Date.parse(document.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error('Unauthorized: Guest document has expired');
  }

  return true;
}

export function getGuestTokenHashFromRequest(req) {
  const token = req.headers['x-order-access-token'] || req.query.token;
  return hashGuestToken(token);
}
