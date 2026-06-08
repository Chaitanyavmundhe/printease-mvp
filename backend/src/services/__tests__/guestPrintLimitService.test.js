import { afterEach, describe, it, expect } from 'vitest';
import { assertGuestPrintLimit, getGuestPrintPageLimit, GUEST_PRINT_LIMIT_CODE } from '../guestPrintLimitService.js';

describe('guestPrintLimitService', () => {
  afterEach(() => {
    delete process.env.GUEST_PRINT_PAGE_LIMIT;
  });

  it('allows logged-in users regardless of pages', () => {
    expect(() => assertGuestPrintLimit({ user: { id: '123' }, pricedFiles: [{ price: { printablePageCount: 10 } }] })).not.toThrow();
  });

  it('allows guest if total printable pages <= 5', () => {
    expect(() => assertGuestPrintLimit({ user: null, pricedFiles: [{ price: { printablePageCount: 5 } }] })).not.toThrow();
  });

  it('throws for guest if total printable pages > 5', () => {
    expect(() => assertGuestPrintLimit({ user: null, pricedFiles: [{ price: { printablePageCount: 6 } }] }))
      .toThrowError(/Guest users can print up to 5 pages/);
  });

  it('calculates properly across multiple files', () => {
    expect(() => assertGuestPrintLimit({ user: null, pricedFiles: [{ price: { printablePageCount: 3 } }, { price: { printablePageCount: 3 } }] }))
      .toThrowError(/Guest users can print up to 5 pages/);
  });

  it('falls back to 5 if env limit is invalid', () => {
    process.env.GUEST_PRINT_PAGE_LIMIT = 'not-a-number';
    expect(getGuestPrintPageLimit()).toBe(5);
  });
});
