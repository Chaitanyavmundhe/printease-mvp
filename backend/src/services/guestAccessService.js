import crypto from 'crypto';

export function createGuestToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashGuestToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getGuestExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

export function assertGuestCanUseDocument({ guestTokenHash, document }) {
  // If the document is owned by a logged-in user, the guest token check doesn't apply here directly,
  // but if it's a guest document, it must have a matching hash.
  if (!document) {
    throw new Error('Document not found');
  }

  // If document belongs to a user, a guest should not be able to use it
  if (document.user_id) {
    throw new Error('Unauthorized: Document belongs to a registered user');
  }

  // If document has a guest token hash, it must match
  if (document.guest_token_hash && document.guest_token_hash !== guestTokenHash) {
    throw new Error('Unauthorized: Invalid guest token for this document');
  }

  // Check expiration if present
  if (document.expires_at && new Date(document.expires_at) < new Date()) {
    throw new Error('Unauthorized: Guest document has expired');
  }

  return true;
}

export function getGuestTokenHashFromRequest(req) {
  const token = req.headers['x-order-access-token'] || req.query.token;
  return hashGuestToken(token);
}
