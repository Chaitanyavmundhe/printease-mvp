import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository.js';
import { updateOrderStatus } from '../order/orderUpdateController.js';
import { getAgentJobStatus } from '../agentJobStatusController.js';
vi.mock('../../db/repository.js');
vi.mock('../../utils/asyncHandler.js', () => ({ asyncHandler: fn => fn }));
beforeEach(() => {
  vi.resetAllMocks();
  repo.withTransaction.mockImplementation(callback => callback({ query: vi.fn() }));
});
const request = status => ({ params: { id: 'order' }, user: { role: 'hub', centreId: 'hub' }, body: { status } });
it('does not reopen completed orders for another dispatch', async () => {
  repo.findOrderByIdOrCode.mockResolvedValue({ id: 'order', centreId: 'hub', status: 'completed' });
  await expect(updateOrderStatus(request('queued_for_print'), {})).rejects.toThrow(/Cannot change status/);
  expect(repo.updateOrderStatus).not.toHaveBeenCalled();
});
it('does not mark an active print as completed from the hub dropdown', async () => {
  repo.findOrderByIdOrCode.mockResolvedValue({ id: 'order', centreId: 'hub', status: 'printing' });
  repo.findActivePrintJobByOrder.mockResolvedValue({ id: 'active' });
  await expect(updateOrderStatus(request('completed'), {})).rejects.toThrow(/still active/);
  expect(repo.updateOrderStatus).not.toHaveBeenCalled();
});
it('scopes the live status endpoint to the requesting agent and hub', async () => {
  repo.findPrintJobForAgent.mockResolvedValue(null);
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), set: vi.fn() };
  await getAgentJobStatus({ params: { jobId: 'foreign' }, agent: { id: 'agent', hubId: 'hub' } }, res);
  expect(repo.findPrintJobForAgent).toHaveBeenCalledWith('foreign', 'agent', 'hub');
  expect(res.status).toHaveBeenCalledWith(404);
  expect(repo.findOrderByIdOrCode).not.toHaveBeenCalled();
});
it('returns no-store paid state for an authorized job', async () => {
  repo.findPrintJobForAgent.mockResolvedValue({ id: 'job', orderId: 'order', status: 'printing' });
  repo.findOrderByIdOrCode.mockResolvedValue({ status: 'printing', paymentStatus: 'collected' });
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), set: vi.fn() };
  await getAgentJobStatus({ params: { jobId: 'job' }, agent: { id: 'agent', hubId: 'hub' } }, res);
  expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(res.json).toHaveBeenCalledWith({ success: true, job: { id: 'job', status: 'printing', orderStatus: 'printing', paymentVerified: true } });
});
