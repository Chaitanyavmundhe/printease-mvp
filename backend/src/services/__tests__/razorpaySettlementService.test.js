import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository.js';
import { queuePrintJobIfPaymentReady } from '../printQueueService.js';
import { requireTrustedOrderBill } from '../paymentReadinessService.js';
import { applyProviderPayment } from '../razorpaySettlementService.js';

vi.mock('../../db/repository.js');
vi.mock('../printQueueService.js');
vi.mock('../paymentReadinessService.js', async importOriginal => ({ ...await importOriginal(), requireTrustedOrderBill: vi.fn() }));
vi.mock('../../config/razorpay.js', () => ({ RAZORPAY_CURRENCY: 'INR' }));
const payment = { id: 'payment', orderId: 'order', amount: 2, providerOrderId: 'provider-order', status: 'created' };
const order = { id: 'order', centreId: 'hub', amount: 2, totalAmountPaise: 200, status: 'payment_requested', paymentStatus: 'requested' };
const captured = { id: 'provider-payment', order_id: 'provider-order', amount: 200, currency: 'INR', status: 'captured', captured: true };
describe('provider settlement', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.withTransaction.mockImplementation(cb => cb({ query: vi.fn() }));
    repo.findPaymentById.mockResolvedValue(payment);
    repo.findOrderByIdOrCode.mockResolvedValue(order);
    repo.updatePayment.mockImplementation(async (id, value) => ({ ...payment, ...value }));
    repo.updateOrderPayment.mockResolvedValue({ ...order, paymentStatus: 'verified' });
    requireTrustedOrderBill.mockResolvedValue(200);
    queuePrintJobIfPaymentReady.mockResolvedValue({ queued: true, printJob: { id: 'job' } });
  });
  it('queues exactly through captured settlement, with an order lock', async () => {
    const result = await applyProviderPayment({ paymentId: 'payment', entity: captured });
    expect(result.autoQueue.queued).toBe(true);
    expect(repo.findOrderByIdOrCode).toHaveBeenCalledWith('order', expect.any(Object), { forUpdate: true });
    expect(queuePrintJobIfPaymentReady).toHaveBeenCalledTimes(1);
  });
  it('never queues an authorized-only payment', async () => {
    const result = await applyProviderPayment({ paymentId: 'payment', entity: { ...captured, captured: false, status: 'authorized' } });
    expect(result.paymentPending).toBe(true);
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
    expect(repo.updateOrderPayment).not.toHaveBeenCalled();
  });
  it('does not downgrade an order settled by another payment method', async () => {
    repo.findOrderByIdOrCode.mockResolvedValue({ ...order, paymentStatus: 'collected' });
    await applyProviderPayment({ paymentId: 'payment', entity: { ...captured, status: 'failed', captured: false }, failed: true });
    expect(repo.updateOrderPayment).not.toHaveBeenCalled();
  });
  it('ignores duplicate callbacks for an already verified payment', async () => {
    repo.findPaymentById.mockResolvedValue({ ...payment, status: 'verified' });
    const result = await applyProviderPayment({ paymentId: 'payment', entity: captured });
    expect(result.alreadyProcessed).toBe(true);
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
  it('rejects a mismatched provider amount', async () => {
    await expect(applyProviderPayment({ paymentId: 'payment', entity: { ...captured, amount: 1 } })).rejects.toThrow(/does not match/);
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
  it('records captured funds for reconciliation without printing a cancelled order', async () => {
    repo.findOrderByIdOrCode.mockResolvedValue({ ...order, status: 'cancelled' });
    const result = await applyProviderPayment({ paymentId: 'payment', entity: captured });
    expect(result.reconciliationRequired).toBe(true);
    expect(repo.updatePayment).toHaveBeenCalledWith('payment', expect.objectContaining({ status: 'verified' }), expect.any(Object));
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
  it('retains the bill snapshot through an authorized callback', async () => {
    const snapshot = { amountPaise: 200, configVersion: 1 };
    repo.findPaymentById.mockResolvedValue({ ...payment, providerPayload: { printeaseBill: snapshot } });
    const result = await applyProviderPayment({ paymentId: 'payment', entity: { ...captured, captured: false, status: 'authorized' } });
    expect(result.payment.providerPayload.printeaseBill).toEqual(snapshot);
  });
  it('settles a QR only with its authenticated QR reference', async () => {
    repo.findPaymentById.mockResolvedValue({ ...payment, providerOrderId: 'qr-id', qrCodeId: 'qr-id' });
    await expect(applyProviderPayment({ paymentId: 'payment', entity: { ...captured, order_id: null } })).rejects.toThrow(/does not match/);
    const result = await applyProviderPayment({ paymentId: 'payment', entity: { ...captured, order_id: null }, qrCodeId: 'qr-id' });
    expect(result.autoQueue.queued).toBe(true);
  });
});
