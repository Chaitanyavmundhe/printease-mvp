import crypto from 'crypto';
import {
  createPayment as savePayment,
  findOrderByIdOrCode,
  findPaymentByRazorpayOrderId,
  findPaymentByRazorpayPaymentId,
  updateOrderPayment,
  updatePayment,
  withTransaction
} from '../db/repository.js';
import {
  getRazorpayClient,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  getRazorpayWebhookSecret
} from '../config/razorpay.js';
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

function amountPaise(order) {
  return order.totalAmountPaise || Math.round(Number(order.amount || 0) * 100);
}

function verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const expectedSignature = crypto
    .createHmac('sha256', getRazorpayKeySecret())
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const received = Buffer.from(String(razorpaySignature || ''));
  const expected = Buffer.from(expectedSignature);
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = getRazorpayWebhookSecret();
  if (!secret) throw new Error('Razorpay webhook secret is not configured');

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const received = Buffer.from(String(signature || ''));
  const expected = Buffer.from(expectedSignature);
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

async function markVerifiedAndQueue({ payment, razorpayPaymentId, razorpaySignature, rawResponse }, client) {
  if (['verified', 'captured', 'collected'].includes(String(payment.status || '').toLowerCase())) {
    const order = await findOrderByIdOrCode(payment.orderId, client);
    return { payment, order, autoQueue: { queued: false, message: 'Payment was already processed.' } };
  }

  const now = new Date().toISOString();
  const verifiedPayment = await updatePayment(payment.id, {
    status: 'verified',
    transactionId: razorpayPaymentId,
    razorpayPaymentId,
    razorpaySignature,
    rawResponse,
    verifiedAt: now
  }, client);

  const verifiedOrder = await updateOrderPayment(payment.orderId, 'verified', 'Payment Verified', client);
  const autoQueue = await queuePrintJobIfPaymentReady(verifiedOrder.id, verifiedOrder.centreId, client);

  return {
    payment: verifiedPayment,
    order: autoQueue.order || verifiedOrder,
    autoQueue,
    printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
  };
}

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { printOrderId, orderId } = req.body;
  const id = printOrderId || orderId;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Print order ID is required' });
  }

  const order = await findOrderByIdOrCode(id);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!canAccessOrder(req.user, order)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to pay for this order' });
  }

  const amount = amountPaise(order);
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Order amount is invalid' });
  }

  const razorpay = getRazorpayClient();
  const razorpayOrder = await razorpay.orders.create({
    amount,
    currency: 'INR',
    receipt: order.orderCode || order.id,
    notes: {
      printOrderId: order.id,
      orderCode: order.orderCode
    }
  });

  const payment = await savePayment({
    id: generateId(),
    orderId: order.id,
    amount: amount / 100,
    method: 'RAZORPAY_CHECKOUT',
    transactionId: razorpayOrder.id,
    razorpayOrderId: razorpayOrder.id,
    status: 'created',
    rawResponse: razorpayOrder,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    keyId: getRazorpayKeyId(),
    razorpayOrderId: razorpayOrder.id,
    amount,
    currency: razorpayOrder.currency || 'INR',
    payment
  });
});

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_payment_id: razorpayPaymentId, razorpay_order_id: razorpayOrderId, razorpay_signature: razorpaySignature } = req.body;

  if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    return res.status(400).json({ success: false, message: 'Razorpay payment ID, order ID, and signature are required' });
  }

  const payment = await findPaymentByRazorpayOrderId(razorpayOrderId);
  if (!payment) {
    return res.status(404).json({ success: false, message: 'Payment order not found' });
  }

  const order = await findOrderByIdOrCode(payment.orderId);
  if (!canAccessOrder(req.user, order)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to verify this payment' });
  }

  if (!verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
    await updatePayment(payment.id, {
      status: 'failed',
      razorpayPaymentId,
      razorpaySignature,
      rawResponse: { reason: 'signature_mismatch' }
    });
    return res.status(400).json({ success: false, message: 'Invalid Razorpay signature' });
  }

  const result = await withTransaction(async (client) => markVerifiedAndQueue({
    payment,
    razorpayPaymentId,
    razorpaySignature,
    rawResponse: req.body
  }, client));

  res.json({
    success: true,
    message: result.autoQueue?.message || 'Payment verified',
    ...result
  });
});

export const createRazorpayPaymentLink = asyncHandler(async (req, res) => {
  const { printOrderId, orderId } = req.body;
  const id = printOrderId || orderId;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Print order ID is required' });
  }

  const order = await findOrderByIdOrCode(id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!canAccessOrder(req.user, order)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to pay for this order' });
  }

  const amount = amountPaise(order);
  const razorpay = getRazorpayClient();
  const paymentLink = await razorpay.paymentLink.create({
    amount,
    currency: 'INR',
    description: `PrintEase order ${order.orderCode}`,
    reference_id: order.id,
    notes: {
      printOrderId: order.id,
      orderCode: order.orderCode
    },
    notify: {
      sms: false,
      email: false
    }
  });

  const payment = await savePayment({
    id: generateId(),
    orderId: order.id,
    amount: amount / 100,
    method: 'RAZORPAY_PAYMENT_LINK',
    transactionId: paymentLink.id,
    paymentLinkId: paymentLink.id,
    status: 'created',
    rawResponse: paymentLink,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    paymentLinkId: paymentLink.id,
    shortUrl: paymentLink.short_url,
    amount,
    currency: paymentLink.currency || 'INR',
    payment
  });
});

export const razorpayWebhook = asyncHandler(async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
  const signature = req.headers['x-razorpay-signature'];

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  const event = JSON.parse(rawBody);
  const paymentEntity = event.payload?.payment?.entity;

  if (!paymentEntity?.id) {
    return res.json({ success: true, ignored: true });
  }

  const existingByPayment = await findPaymentByRazorpayPaymentId(paymentEntity.id);
  if (existingByPayment && ['verified', 'captured', 'collected'].includes(String(existingByPayment.status || '').toLowerCase())) {
    return res.json({ success: true, idempotent: true });
  }

  const razorpayOrderId = paymentEntity.order_id;
  const payment = razorpayOrderId ? await findPaymentByRazorpayOrderId(razorpayOrderId) : null;

  if (!payment) {
    return res.json({ success: true, ignored: true, message: 'No matching PrintEase payment found' });
  }

  if (event.event === 'payment.captured') {
    const result = await withTransaction(async (client) => markVerifiedAndQueue({
      payment,
      razorpayPaymentId: paymentEntity.id,
      rawResponse: event
    }, client));

    return res.json({ success: true, ...result });
  }

  if (event.event === 'payment.failed') {
    await updatePayment(payment.id, {
      status: 'failed',
      razorpayPaymentId: paymentEntity.id,
      rawResponse: event
    });
    return res.json({ success: true, failed: true });
  }

  res.json({ success: true, ignored: true });
});
