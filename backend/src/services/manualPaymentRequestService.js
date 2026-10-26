import { createPayment, findOrderByIdOrCode, updateOrderPayment, withTransaction } from '../db/repository.js';
import { canAccessOrder, isPaymentComplete } from './orderUtils.js';
import { requireTrustedOrderBill, paymentBillSnapshot } from './paymentReadinessService.js';
import { generateId } from '../utils/generateCode.js';

// Customer intent is not money received. Hold the order lock across ownership,
// bill readiness and the requested-state write so retries cannot duplicate rows.
export async function requestManualPayment(req) {
  return withTransaction(async client => {
    const order = await findOrderByIdOrCode(req.body.orderId, client, { forUpdate: true });
    if (!order || !canAccessOrder(req.user, order, req)) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      throw error;
    }
    if (isPaymentComplete(order)) {
      const error = new Error('Payment is already completed for this order');
      error.statusCode = 409;
      throw error;
    }
    await requireTrustedOrderBill(order, client);
    if (order.paymentStatus === 'requested') return { payment: null, order };
    const payment = await createPayment({
      id: generateId(), orderId: order.id, amount: order.amount,
      method: 'MANUAL_PAYMENT_REQUEST', transactionId: `manual_request_${generateId()}`,
      status: 'pending', providerPayload: { printeaseBill: paymentBillSnapshot(order) },
      createdAt: new Date().toISOString()
    }, client);
    return { payment, order: await updateOrderPayment(order.id, 'requested', 'payment_requested', client) };
  });
}
