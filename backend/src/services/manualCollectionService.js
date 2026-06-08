import { findOrderByIdOrCode, savePayment, updateOrderPayment, withTransaction } from '../db/repository.js';
import { generateId } from '../utils/uuid.js';
import { queuePrintJobIfPaymentReady } from './printQueueService.js';
import { isCancelledOrder, isPaymentComplete } from './orderUtils.js';

export async function processManualCollection({
  orderId,
  hubId,
  rawMethod,
  transactionNoteInput,
  autoPrintAfterCollection
}) {
  if (rawMethod !== 'cash' && rawMethod !== 'manual_upi') {
    return { error: 'INVALID_METHOD', message: 'Invalid collection method. Allowed values: cash, manual_upi' };
  }
  
  const collectionMethod = rawMethod === 'manual_upi' ? 'MANUAL_UPI' : 'CASH';
  const transactionNote = typeof transactionNoteInput === 'string' ? transactionNoteInput.trim().slice(0, 200) : '';

  return await withTransaction(async (client) => {
    const order = await findOrderByIdOrCode(orderId, client);

    if (!order || order.centreId !== hubId) {
      return { notFound: true };
    }

    const normalizedPaymentStatus = String(order.paymentStatus || '').toLowerCase();
    if (isCancelledOrder(order) && !isPaymentComplete(order)) {
      return { cancelledBeforePayment: true, order };
    }

    if (!['pending', 'unpaid', ''].includes(normalizedPaymentStatus)) {
      const autoQueue = autoPrintAfterCollection
        ? await queuePrintJobIfPaymentReady(order.id, hubId, client)
        : { queued: false, message: 'Payment already collected. Auto-print is off; press Send to print manually.' };
      return {
        success: true,
        order,
        payment: null,
        autoQueue,
        printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
      };
    }

    const now = new Date().toISOString();
    const payment = await savePayment({
      id: generateId(),
      orderId: order.id,
      amount: order.amount,
      method: collectionMethod,
      transactionId: transactionNote || `${collectionMethod.toLowerCase()}_collected_${Date.now()}`,
      status: 'collected',
      createdAt: now,
      verifiedAt: now
    }, client);

    const collectedOrder = await updateOrderPayment(order.id, 'collected', 'Payment Collected', client);
    const autoQueue = autoPrintAfterCollection
      ? await queuePrintJobIfPaymentReady(collectedOrder.id, hubId, client)
      : { queued: false, message: 'Payment collected. Auto-print is off; press Send to print manually.' };

    return {
      success: true,
      payment,
      order: autoQueue.order || collectedOrder,
      autoQueue,
      printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
    };
  });
}
