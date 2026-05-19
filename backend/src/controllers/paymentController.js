import {
  createPayment as savePayment,
  findOrderByIdOrCode,
  findPaymentById,
  updateOrderPayment,
  updatePayment,
  withTransaction
} from '../db/repository.js';
import { queuePrintJobIfPaymentReady } from '../services/printQueueService.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function canAccessOrder(user, order) {
  if (!user || !order) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'user') return order.userId === user.id;
  if (user.role === 'hub') return Boolean(user.centreId && order.centreId === user.centreId);
  return false;
}

export const createPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Order ID is required' });
  }

  const order = await findOrderByIdOrCode(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!canAccessOrder(req.user, order)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to create payment for this order' });
  }

  const payment = await savePayment({
    id: generateId(),
    orderId: order.id,
    amount: order.amount,
    method: 'DEMO_UPI',
    transactionId: `demo_order_${Date.now()}`,
    status: 'created',
    createdAt: new Date().toISOString(),
    verifiedAt: null
  });

  res.status(201).json({
    success: true,
    message: 'Demo payment order created',
    payment,
    note: 'Production should create Razorpay order from backend.'
  });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId, demoSuccess = true } = req.body;

  if (!paymentId) {
    return res.status(400).json({ success: false, message: 'Payment ID is required' });
  }

  const payment = await findPaymentById(paymentId);

  if (!payment) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }

  const order = await findOrderByIdOrCode(payment.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Linked order not found' });
  }

  if (!canAccessOrder(req.user, order)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to verify this payment' });
  }

  if (!demoSuccess) {
    const result = await withTransaction(async (client) => {
      const failedPayment = await updatePayment(payment.id, { status: 'failed' }, client);
      const failedOrder = await updateOrderPayment(order.id, 'failed', 'Payment Failed', client);
      return { payment: failedPayment, order: failedOrder };
    });

    return res.json({ success: true, message: 'Payment marked failed in demo', ...result });
  }

  const result = await withTransaction(async (client) => {
    const verifiedPayment = await updatePayment(payment.id, {
      status: 'verified',
      transactionId: `demo_payment_${Date.now()}`,
      verifiedAt: new Date().toISOString()
    }, client);
    const verifiedOrder = await updateOrderPayment(order.id, 'verified', 'Payment Verified', client);
    const autoQueue = await queuePrintJobIfPaymentReady(verifiedOrder.id, verifiedOrder.centreId, client);
    return {
      payment: verifiedPayment,
      order: autoQueue.order || verifiedOrder,
      autoQueue,
      printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
    };
  });

  res.json({
    success: true,
    message: result.autoQueue?.message || 'Payment verified in demo mode',
    ...result,
    securityNote: 'Real project must verify Razorpay signature/webhook on backend.'
  });
});
