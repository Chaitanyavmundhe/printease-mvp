import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository.js';
import { queuePrintJobIfPaymentReady } from '../printQueueService.js';
vi.mock('../../db/repository.js');
beforeEach(() => {
  vi.resetAllMocks();
  repo.withTransaction.mockImplementation(cb => cb({ query: vi.fn() }));
  repo.findOrderByIdOrCode.mockResolvedValue({ id: 'order', centreId: 'hub' });
  repo.findOrderWithDocumentForHub.mockResolvedValue({ payment_status: 'collected', status: 'payment_collected' });
});
it('serializes dispatch under an order lock and reuses existing active work', async () => {
  repo.findActivePrintJobByOrder.mockResolvedValue({ id: 'existing' });
  const result = await queuePrintJobIfPaymentReady('order', 'hub');
  expect(repo.findOrderByIdOrCode).toHaveBeenCalledWith('order', expect.any(Object), { forUpdate: true });
  expect(result.existingPrintJob.id).toBe('existing');
  expect(repo.createPrintJob).not.toHaveBeenCalled();
});
it('does not queue an unpaid order even if files were predownloaded', async () => {
  repo.findOrderWithDocumentForHub.mockResolvedValue({ payment_status: 'requested' });
  const result = await queuePrintJobIfPaymentReady('order', 'hub');
  expect(result.blocked).toBe('PAYMENT_NOT_READY');
  expect(repo.createPrintJob).not.toHaveBeenCalled();
});
