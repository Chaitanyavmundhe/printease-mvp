import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository.js';
import { processManualCollection } from '../manualCollectionService.js';
import { requestManualPayment } from '../manualPaymentRequestService.js';
import { queuePrintJobIfPaymentReady } from '../printQueueService.js';

vi.mock('../../db/repository.js');
vi.mock('../printQueueService.js');
const order = { id: 'order', userId: 'customer', centreId: 'hub', paymentStatus: 'requested', status: 'payment_requested', amount: 4, totalAmountPaise: 400 };
const files = [{ lineAmountPaise: 400, printablePageCount: 2, document: { preparationStatus: 'prepared', pageCount: 2, fileType: 'application/pdf', storagePath: 'private.pdf', fileSha256: 'verified' } }];
describe('manual payment activation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.withTransaction.mockImplementation(cb => cb({ query: vi.fn() }));
    repo.findOrderByIdOrCode.mockResolvedValue(order);
    repo.listOrderFiles.mockResolvedValue(files);
    repo.createPayment.mockResolvedValue({ id: 'payment' });
    repo.updateOrderPayment.mockResolvedValue({ ...order, paymentStatus: 'collected' });
    queuePrintJobIfPaymentReady.mockResolvedValue({ queued: true });
  });
  const collect = autoPrintAfterCollection => processManualCollection({ orderId: 'order', hubId: 'hub', rawMethod: 'cash', autoPrintAfterCollection });
  it('only queues after an explicit hub collection with auto-print on', async () => {
    await collect(true);
    expect(repo.findOrderByIdOrCode).toHaveBeenCalledWith('order', expect.any(Object), { forUpdate: true });
    expect(repo.createPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 4, status: 'collected' }), expect.any(Object));
    expect(queuePrintJobIfPaymentReady).toHaveBeenCalledTimes(1);
  });
  it('retains manual print control when auto-print is off', async () => {
    await collect(false);
    expect(repo.updateOrderPayment).toHaveBeenCalledWith('order', 'collected', 'payment_collected', expect.any(Object));
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
  it('does not collect money while conversion is pending', async () => {
    repo.listOrderFiles.mockResolvedValue([{ ...files[0], document: { preparationStatus: 'pending' } }]);
    await expect(collect(true)).rejects.toThrow(/preparation/);
    expect(repo.createPayment).not.toHaveBeenCalled();
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
  it('never collects a cancelled unpaid order', async () => {
    repo.findOrderByIdOrCode.mockResolvedValue({ ...order, status: 'cancelled' });
    expect((await collect(true)).cancelledBeforePayment).toBe(true);
    expect(repo.createPayment).not.toHaveBeenCalled();
  });
  it('a user request is pending only, not collection or print activation', async () => {
    repo.findOrderByIdOrCode.mockResolvedValue({ ...order, paymentStatus: 'not_requested', status: 'bill_confirmed' });
    await requestManualPayment({ body: { orderId: 'order' }, user: { id: 'customer', role: 'user' } });
    expect(repo.createPayment).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }), expect.any(Object));
    expect(repo.updateOrderPayment).toHaveBeenCalledWith('order', 'requested', 'payment_requested', expect.any(Object));
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
  it('duplicate requests do not create extra payments', async () => {
    await requestManualPayment({ body: { orderId: 'order' }, user: { id: 'customer', role: 'user' } });
    expect(repo.createPayment).not.toHaveBeenCalled();
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
});
