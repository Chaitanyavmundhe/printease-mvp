// Accept retries of the current state, not backward transitions. Terminal order
// state also wins over delayed agent callbacks; call under order/job row locks.
const transitions = {
  queued: ['assigned', 'accepted', 'failed', 'cancelled'],
  assigned: ['accepted', 'failed', 'cancelled'],
  accepted: ['downloading', 'failed', 'cancelled'],
  downloading: ['printing', 'failed', 'cancelled'],
  printing: ['submitted_to_printer', 'completed', 'failed', 'cancelled'],
  submitted_to_printer: ['completed', 'failed', 'cancelled'],
  completed: [], failed: [], cancelled: []
};

export function assertPrintJobTransition(job, nextStatus, order) {
  const current = String(job.status || '').toLowerCase();
  const orderStatus = String(order.status || '').toLowerCase();
  const terminalOrder = ['cancelled', 'completed', 'collected', 'failed'].includes(orderStatus);
  const sameTerminal = (orderStatus === 'cancelled' && nextStatus === 'cancelled') ||
    (orderStatus === 'completed' && nextStatus === 'completed') ||
    (orderStatus === 'failed' && nextStatus === 'failed');
  if ((!terminalOrder && (current === nextStatus || transitions[current]?.includes(nextStatus))) ||
      (sameTerminal && current === nextStatus)) return;
  const error = new Error(`Print job cannot move from ${current} to ${nextStatus} while order is ${orderStatus}.`);
  error.statusCode = 409;
  error.code = 'PRINT_JOB_STATE_CONFLICT';
  throw error;
}
