import { describe, expect, it } from 'vitest';
import { mapDocument } from '../../db/repositories/mappers.js';
import { assertGuestCanUseDocument, hashGuestToken } from '../guestAccessService.js';

describe('guest document ownership', () => {
  const token = 'a'.repeat(64);
  const row = { id: 'doc', user_id: null, guest_token_hash: hashGuestToken(token), expires_at: new Date(Date.now() + 60000) };

  it('retains the capability and expiry through the database mapper', () => {
    const document = mapDocument(row);
    expect(() => assertGuestCanUseDocument({ document, guestTokenHash: hashGuestToken(token) })).not.toThrow();
    expect(document.expiresAt).toBe(row.expires_at.toISOString());
  });

  it.each([null, hashGuestToken('another-token')])('rejects a missing or foreign capability', guestTokenHash => {
    expect(() => assertGuestCanUseDocument({ document: mapDocument(row), guestTokenHash })).toThrow(/Invalid guest token/);
  });

  it('rejects expired or registered documents', () => {
    expect(() => assertGuestCanUseDocument({ document: mapDocument({ ...row, expires_at: new Date(0) }), guestTokenHash: row.guest_token_hash })).toThrow(/expired/);
    expect(() => assertGuestCanUseDocument({ document: mapDocument({ ...row, user_id: 'owner' }), guestTokenHash: row.guest_token_hash })).toThrow(/registered/);
  });
});
