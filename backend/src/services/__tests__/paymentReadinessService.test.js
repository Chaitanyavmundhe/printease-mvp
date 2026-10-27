import { describe, expect, it, vi } from 'vitest';
import { assertTrustedOrderBill, assertPaymentMatchesBill, requireTrustedOrderBill } from '../paymentReadinessService.js';
import * as repo from '../../db/repository.js';
vi.mock('../../db/repository.js');

const order = { id: 'order', userId: 'user', amount: 2, totalAmountPaise: 200, status: 'draft_uploaded', configVersion: 2 };
const file = { lineAmountPaise: 200, printablePageCount: 2, document: {
  fileType: 'application/pdf', storagePath: 'original.pdf', fileSha256: 'verified-hash', preparationStatus: 'prepared', pageCount: 2
} };
describe('trusted payment bill', () => {
  it('allows a complete verified bill and rejects pending conversion even with a claimed amount', () => {
    expect(assertTrustedOrderBill(order, [file])).toBe(200);
    expect(() => assertTrustedOrderBill(order, [{ ...file, document: { ...file.document, preparationStatus: 'pending' } }])).toThrow(/preparation/);
    expect(() => assertTrustedOrderBill({ ...order, amount: 0, totalAmountPaise: 0, priceSnapshot: { pricingPending: true } }, [file])).toThrow(/pending/);
  });
  it('requires totals to match verified line prices', () => {
    expect(() => assertTrustedOrderBill({ ...order, totalAmountPaise: 100 }, [file])).toThrow(/bill changed/);
  });
  it('uses printable pages including copies for the loginless limit', () => {
    expect(() => assertTrustedOrderBill({ ...order, userId: null }, [{ ...file, printablePageCount: 6 }])).toThrow(/Login/);
    expect(assertTrustedOrderBill({ ...order, userId: null }, [{ ...file, printablePageCount: 5 }])).toBe(200);
  });
  it('permits genuinely free manual bills', () => {
    const free = { ...order, totalAmountPaise: 0, amount: 0 };
    expect(assertTrustedOrderBill(free, [{ ...file, lineAmountPaise: 0 }])).toBe(0);
  });
  it('rejects a payment created against another configuration version', () => {
    expect(() => assertPaymentMatchesBill({ amount: 2, providerPayload: { printeaseBill: { amountPaise: 200, configVersion: 1 } } }, order)).toThrow(/older bill/);
  });
  it('blocks another payment when funds need reconciliation', async () => {
    repo.listOrderFiles.mockResolvedValue([file]);
    repo.findSettledPaymentForOrder.mockResolvedValue({ id: 'captured-old-bill' });
    await expect(requireTrustedOrderBill(order, {})).rejects.toThrow(/Do not pay again/);
  });
});
