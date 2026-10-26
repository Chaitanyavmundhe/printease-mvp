import { findPrintJobForAgent, findOrderByIdOrCode } from '../db/repository.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isPaymentComplete } from '../services/orderUtils.js';

// Paid-print cancellation uses this agent/hub-scoped live read, not user login
// credentials or the entire hub queue. Never cache authorization decisions.
export const getAgentJobStatus = asyncHandler(async (req, res) => {
  const job = await findPrintJobForAgent(req.params.jobId, req.agent.id, req.agent.hubId);
  if (!job) return res.status(404).json({ success: false, message: 'Print job not found for this agent.' });
  const order = await findOrderByIdOrCode(job.orderId);
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, job: {
    id: job.id, status: job.status, orderStatus: order?.status,
    paymentVerified: Boolean(order && isPaymentComplete(order)),
  } });
});
