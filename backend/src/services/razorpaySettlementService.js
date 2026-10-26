import {
  findPaymentById, findOrderByIdOrCode, updatePayment, updateOrderPayment, withTransaction
} from '../db/repository.js';
import { queuePrintJobIfPaymentReady } from './printQueueService.js';
import { isCancelledOrder, isPaymentComplete } from './orderUtils.js';
import { assertPaymentMatchesBill, requireTrustedOrderBill } from './paymentReadinessService.js';
import { RAZORPAY_CURRENCY } from '../config/razorpay.js';

export function assertProviderPaymentMatches(payment, entity, qrCodeId = null) {
  const expectedPaise = Math.round(Number(payment.amount) * 100);
  const referenceMatches = payment.qrCodeId
    ? Boolean(qrCodeId && payment.qrCodeId === qrCodeId)
    : entity?.order_id === payment.providerOrderId;
  if (!entity?.id || !referenceMatches ||
      Number(entity.amount) !== expectedPaise || entity.currency !== RAZORPAY_CURRENCY) {
    const error = new Error('Provider payment does not match the saved order, amount or currency.');
    error.statusCode = 409;
    throw error;
  }
}

// Signed webhooks and server-fetched checkout results share the same locked,
// monotonic settlement path. Authorization alone never activates printing.
export async function applyProviderPayment({ paymentId, entity, signature = null, payload = {}, failed = false, qrCodeId = null }) {
  return withTransaction(async client => {
    const initial = await findPaymentById(paymentId, client);
    if (!initial) return { ignored: true };
    const order = await findOrderByIdOrCode(initial.orderId, client, { forUpdate: true });
    const payment = await findPaymentById(paymentId, client);
    if (!order || !payment) return { ignored: true };
    assertProviderPaymentMatches(payment, entity, qrCodeId);
    const providerPayload = { ...payload, printeaseBill: payment.providerPayload?.printeaseBill };

    if (payment.status === 'verified') return {
      payment, order, alreadyProcessed: true,
      reconciliationRequired: !isPaymentComplete(order) || isCancelledOrder(order),
    };
    if (failed) {
      const failedPayment = await updatePayment(payment.id, {
        status: 'failed', providerPaymentId: entity.id, providerStatus: entity.status || 'failed', providerPayload
      }, client);
      // A failed attempt is not evidence that another attempt or cash collection
      // failed. Leave the order eligible for retry without undoing settlement.
      return { payment: failedPayment, order, failed: true };
    }

    if (entity.status !== 'captured' || entity.captured !== true) {
      return {
        payment: await updatePayment(payment.id, { providerStatus: entity.status, providerPayload }, client),
        order, paymentPending: true, message: 'Payment is awaiting capture confirmation.'
      };
    }

    // Retain received funds even when the order was cancelled/paid another way;
    // reconcile separately rather than printing or pretending no money arrived.
    const capturedPayment = await updatePayment(payment.id, {
      status: 'verified', providerPaymentId: entity.id, providerSignature: signature,
      providerStatus: 'captured', providerPayload, verifiedAt: new Date().toISOString()
    }, client);
    if (isCancelledOrder(order) || isPaymentComplete(order)) {
      return { payment: capturedPayment, order, reconciliationRequired: true, autoQueue: { queued: false } };
    }
    try {
      assertPaymentMatchesBill(payment, order);
      await requireTrustedOrderBill(order, client, { online: true, settlingPaymentId: payment.id });
    } catch (error) {
      return { payment: capturedPayment, order, reconciliationRequired: true, message: error.message, autoQueue: { queued: false } };
    }
    const paidOrder = await updateOrderPayment(order.id, 'verified', 'payment_collected', client);
    const autoQueue = await queuePrintJobIfPaymentReady(order.id, order.centreId, client);
    return { payment: capturedPayment, order: autoQueue.order || paidOrder, autoQueue, printJob: autoQueue.printJob || autoQueue.existingPrintJob || null };
  });
}
