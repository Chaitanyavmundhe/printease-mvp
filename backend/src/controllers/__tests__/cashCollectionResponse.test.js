import { beforeEach, expect, it, vi } from 'vitest';
import { collectCashPayment } from '../order/orderUpdateController.js';
import { processManualCollection } from '../../services/manualCollectionService.js';
vi.mock('../../services/manualCollectionService.js', () => ({ processManualCollection: vi.fn() }));
vi.mock('../../utils/asyncHandler.js', () => ({ asyncHandler: fn => fn }));
beforeEach(() => vi.resetAllMocks());
const res = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
const req = body => ({ body, params: { id: 'order' }, user: { centreId: 'hub' } });
it('returns a conflict rather than collected success before a customer request', async () => {
  processManualCollection.mockResolvedValue({ error: 'PAYMENT_NOT_REQUESTED', message: 'User has not created a payment request yet.' });
  const response = res();
  await collectCashPayment(req({ method: 'cash' }), response);
  expect(response.status).toHaveBeenCalledWith(409);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code: 'PAYMENT_NOT_REQUESTED' }));
});
it('rejects malformed method and string booleans before service work', async () => {
  for (const body of [{ method: {} }, { method: 'cash', autoPrintAfterCollection: 'false' }]) {
    const response = res();
    await collectCashPayment(req(body), response);
    expect(response.status).toHaveBeenCalledWith(400);
  }
  expect(processManualCollection).not.toHaveBeenCalled();
});
it('preserves explicit auto-print off and successful collection', async () => {
  processManualCollection.mockResolvedValue({ success: true, order: { paymentStatus: 'collected' } });
  const response = res();
  await collectCashPayment(req({ method: 'cash', autoPrintAfterCollection: false }), response);
  expect(processManualCollection).toHaveBeenCalledWith(expect.objectContaining({ autoPrintAfterCollection: false }));
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
});
