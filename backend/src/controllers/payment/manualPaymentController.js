import crypto from 'node:crypto';
import {
  createPayment as savePayment,
  findOrderByIdOrCode,
  findPaymentById,
  findPaymentByProviderOrderId,
  updateOrderPayment,
  updatePayment,
  listOrderFiles,
  withTransaction
} from '../../db/repository.js';
import { queuePrintJobIfPaymentReady } from '../../services/printQueueService.js';
import { generateId } from '../../utils/generateCode.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  canAccessOrder,
  isCancelledOrder,
  isPaymentComplete,
  normalizePaymentStatus
} from '../../services/orderUtils.js';
import {
  amountToPaise,
  getPublicRazorpayConfig,
  getRazorpayClient,
  RAZORPAY_CURRENCY,
  RAZORPAY_ENABLED,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET
} from '../../config/razorpay.js';

function assertRazorpayConfigured() {
  if (!RAZORPAY_ENABLED) {
    const error = new Error('Razorpay is not enabled on this backend.');
    error.statusCode = 503;
    throw error;
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay credentials are missing.');
    error.statusCode = 500;
    throw error;
  }
}

function selectedPageCountForOrder(order) {
  return Number(order?.selectedPageCount || order?.printablePageCount || order?.pages || 0);
}

function assertOrderCanStartPayment(order) {
  if (isCancelledOrder(order) && !isPaymentComplete(order)) {
    const error = new Error('Order was cancelled before payment. Payment cannot be started.');
    error.statusCode = 409;
    throw error;
  }
}

// Removed assertOrderIsFullyPrepared

function verifyRazorpayCheckoutSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(String(razorpaySignature || ''));

  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!RAZORPAY_WEBHOOK_SECRET) return false;

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(String(signature || ''));

  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

async function markOrderPaidAndQueue({ orderId, paymentId, providerPaymentId, providerSignature, providerStatus, providerPayload, client }) {
  const payment = await updatePayment(paymentId, {
    status: 'verified',
    transactionId: providerPaymentId,
    providerPaymentId,
    providerSignature,
    providerStatus,
    providerPayload,
    verifiedAt: new Date().toISOString()
  }, client);

  const paidOrder = await updateOrderPayment(orderId, 'verified', 'payment_collected', client);
  const autoQueue = await queuePrintJobIfPaymentReady(paidOrder.id, paidOrder.centreId, client);

  return {
    payment,
    order: autoQueue.order || paidOrder,
    autoQueue,
    printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
  };
}

export const getPaymentConfig = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    razorpay: getPublicRazorpayConfig()
  });
});

export const createManualPaymentRequest = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Order ID is required' });
  }

  const order = await findOrderByIdOrCode(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!canAccessOrder(req.user, order, req)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to create a payment request for this order' });
  }

  if (!order.userId && selectedPageCountForOrder(order) > 5) {
    return res.status(403).json({
      success: false,
      code: 'LOGIN_REQUIRED_FOR_MORE_THAN_5_PAGES',
      message: 'Login is required to print more than 5 selected pages.'
    });
  }

  assertOrderCanStartPayment(order);

  const paymentStatus = normalizePaymentStatus(order);
  if (['verified', 'collected', 'paid'].includes(paymentStatus)) {
    return res.status(409).json({ success: false, message: 'Payment is already completed for this order' });
  }

  const result = await withTransaction(async (client) => {
    const payment = await savePayment({
      id: generateId(),
      orderId: order.id,
      amount: order.amount,
      method: 'MANUAL_PAYMENT_REQUEST',
      transactionId: `manual_request_${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      verifiedAt: null
    }, client);

    const requestedOrder = await updateOrderPayment(order.id, 'requested', 'payment_requested', client);

    return { payment, order: requestedOrder };
  });

  res.status(201).json({
    success: true,
    message: 'Pending payment request created.',
    ...result
  });
});

const createRazorpayOrder = asyncHandler(async (req, res) => {
  assertRazorpayConfigured();

  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Order ID is required' });
  }

  const order = await findOrderByIdOrCode(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!canAccessOrder(req.user, order, req)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to pay for this order' });
  }

  if (!req.user && !order.userId) {
    return res.status(403).json({
      success: false,
      code: 'LOGIN_REQUIRED_FOR_ONLINE_PAYMENT',
      message: 'Login is required for online payment.'
    });
  }

  assertOrderCanStartPayment(order);

  const paymentStatus = normalizePaymentStatus(order);
  if (['verified', 'collected', 'paid'].includes(paymentStatus)) {
    return res.status(409).json({ success: false, message: 'Payment is already completed for this order' });
  }

  const amountPaise = amountToPaise(order.amount);
  const razorpay = getRazorpayClient();

  const razorpayOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: RAZORPAY_CURRENCY,
    receipt: order.orderCode || order.id,
    notes: {
      printEaseOrderId: order.id,
      orderCode: order.orderCode || '',
      hubId: order.centreId || ''
    }
  });

  const { payment, requestedOrder } = await withTransaction(async (client) => {
    const payment = await savePayment({
      id: generateId(),
      orderId: order.id,
      amount: order.amount,
      method: 'RAZORPAY_CHECKOUT',
      provider: 'RAZORPAY',
      providerOrderId: razorpayOrder.id,
      providerStatus: razorpayOrder.status,
      providerPayload: razorpayOrder,
      transactionId: razorpayOrder.id,
      status: 'created',
      createdAt: new Date().toISOString(),
      verifiedAt: null
    }, client);

    const requestedOrder = await updateOrderPayment(order.id, 'requested', 'payment_requested', client);
    return { payment, requestedOrder };
  });

  res.status(201).json({
    success: true,
    message: 'Razorpay order created',
    payment,
    order: requestedOrder,
    razorpay: {
      enabled: true,
      keyId: RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name: 'PrintEase',
      description: `Print order ${order.orderCode || order.id}`,
      prefill: {
        name: req.user?.name || '',
        contact: req.user?.mobile || ''
      },
      notes: razorpayOrder.notes || {}
    }
  });
});

const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  assertRazorpayConfigured();

  const {
    paymentId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body;

  if (!paymentId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: 'paymentId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required'
    });
  }

  const payment = await findPaymentById(paymentId);

  if (!payment) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }

  if (payment.providerOrderId !== razorpay_order_id) {
    return res.status(400).json({ success: false, message: 'Razorpay order ID does not match payment record' });
  }

  const order = await findOrderByIdOrCode(payment.orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Linked order not found' });
  }

  if (!canAccessOrder(req.user, order, req)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to verify payment for this order' });
  }

  let validSignature = false;

  try {
    validSignature = verifyRazorpayCheckoutSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature
    });
  } catch {
    validSignature = false;
  }

  if (!validSignature) {
    const failed = await updatePayment(payment.id, {
      status: 'failed',
      providerPaymentId: razorpay_payment_id,
      providerSignature: razorpay_signature,
      providerStatus: 'signature_failed',
      providerPayload: { reason: 'signature_failed' }
    });

    return res.status(400).json({
      success: false,
      message: 'Invalid Razorpay signature',
      payment: failed
    });
  }

  const result = await withTransaction(async (client) => {
    const latestOrder = await findOrderByIdOrCode(order.id, client);
    const latestPaymentStatus = normalizePaymentStatus(latestOrder);

    if (['verified', 'collected', 'paid'].includes(latestPaymentStatus)) {
      return {
        payment,
        order: latestOrder,
        autoQueue: { queued: false, message: 'Payment already processed.' },
        printJob: null
      };
    }

    if (isCancelledOrder(latestOrder)) {
      const cancelledPayment = await updatePayment(payment.id, {
        status: 'cancelled',
        providerPaymentId: razorpay_payment_id,
        providerSignature: razorpay_signature,
        providerStatus: 'order_cancelled_before_payment',
        providerPayload: { ...req.body, reason: 'order_cancelled_before_payment' }
      }, client);

      const error = new Error('Order was cancelled before payment. Payment cannot be verified.');
      error.statusCode = 409;
      error.payment = cancelledPayment;
      error.order = latestOrder;
      throw error;
    }

    return markOrderPaidAndQueue({
      orderId: order.id,
      paymentId: payment.id,
      providerPaymentId: razorpay_payment_id,
      providerSignature: razorpay_signature,
      providerStatus: 'verified_by_signature',
      providerPayload: req.body,
      client
    });
  });

  res.json({
    success: true,
    message: result.autoQueue?.message || 'Payment verified',
    ...result
  });
});

const createRazorpayUpiQr = asyncHandler(async (req, res) => {
  assertRazorpayConfigured();

  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Order ID is required' });
  }

  const order = await findOrderByIdOrCode(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!canAccessOrder(req.user, order, req)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to generate QR for this order' });
  }

  if (!req.user && !order.userId) {
    return res.status(403).json({
      success: false,
      code: 'LOGIN_REQUIRED_FOR_ONLINE_PAYMENT',
      message: 'Login is required for online payment.'
    });
  }

  assertOrderCanStartPayment(order);

  const paymentStatus = normalizePaymentStatus(order);
  if (['verified', 'collected', 'paid'].includes(paymentStatus)) {
    return res.status(409).json({ success: false, message: 'Payment is already completed for this order' });
  }

  const amountPaise = amountToPaise(order.amount);
  const razorpay = getRazorpayClient();

  let qr;
  try {
    qr = await razorpay.qrCode.create({
      type: 'upi_qr',
      name: `PrintEase ${order.orderCode || order.id}`,
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: amountPaise,
      description: `PrintEase order ${order.orderCode || order.id}`,
      notes: {
        printEaseOrderId: order.id,
        orderCode: order.orderCode || '',
        hubId: order.centreId || ''
      }
    });
  } catch (error) {
    error.statusCode = error.statusCode || 502;
    throw error;
  }

  const { payment, requestedOrder } = await withTransaction(async (client) => {
    const payment = await savePayment({
      id: generateId(),
      orderId: order.id,
      amount: order.amount,
      method: 'RAZORPAY_UPI_QR',
      provider: 'RAZORPAY',
      providerOrderId: qr.id,
      providerStatus: qr.status,
      providerPayload: qr,
      transactionId: qr.id,
      qrCodeId: qr.id,
      qrImageUrl: qr.image_url || null,
      shortUrl: qr.image_url || null,
      status: 'created',
      createdAt: new Date().toISOString(),
      verifiedAt: null
    }, client);

    const requestedOrder = await updateOrderPayment(order.id, 'requested', 'payment_requested', client);
    return { payment, requestedOrder };
  });

  res.status(201).json({
    success: true,
    message: 'UPI QR created',
    payment,
    order: requestedOrder,
    qr: {
      id: qr.id,
      imageUrl: qr.image_url || null,
      status: qr.status,
      amount: amountPaise,
      currency: RAZORPAY_CURRENCY
    }
  });
});

const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody || JSON.stringify(req.body || {});

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  const event = req.body;
  const eventName = event?.event;
  const paymentEntity = event?.payload?.payment?.entity || null;
  const orderId = paymentEntity?.order_id || null;
  const paymentId = paymentEntity?.id || null;

  if (!paymentEntity || !paymentId) {
    return res.json({ success: true, ignored: true, message: 'No payment entity in webhook' });
  }

  if (!['payment.captured', 'payment.authorized', 'payment.failed'].includes(eventName)) {
    return res.json({ success: true, ignored: true, event: eventName });
  }

  const result = await withTransaction(async (client) => {
    const payment = orderId
      ? await findPaymentByProviderOrderId(orderId, client)
      : null;

    if (!payment) {
      return { ignored: true, message: 'Payment record not found for webhook' };
    }

    const order = await findOrderByIdOrCode(payment.orderId, client);
    if (!order) {
      return { ignored: true, message: 'Order not found for webhook payment' };
    }

    if (eventName === 'payment.failed') {
      const failedPayment = await updatePayment(payment.id, {
        status: 'failed',
        providerPaymentId: paymentId,
        providerStatus: paymentEntity.status || 'failed',
        providerPayload: event
      }, client);

      const failedOrder = isCancelledOrder(order)
        ? order
        : await updateOrderPayment(order.id, 'failed', 'failed', client);
      return { payment: failedPayment, order: failedOrder, failed: true };
    }

    const currentOrderStatus = normalizePaymentStatus(order);
    if (['verified', 'collected', 'paid'].includes(currentOrderStatus)) {
      return { payment, order, alreadyProcessed: true };
    }

    if (isCancelledOrder(order)) {
      const cancelledPayment = await updatePayment(payment.id, {
        status: 'cancelled',
        providerPaymentId: paymentId,
        providerStatus: 'order_cancelled_before_payment',
        providerPayload: event
      }, client);

      return {
        payment: cancelledPayment,
        order,
        cancelledBeforePayment: true,
        message: 'Order was cancelled before payment; webhook payment was not applied.'
      };
    }

    return markOrderPaidAndQueue({
      orderId: order.id,
      paymentId: payment.id,
      providerPaymentId: paymentId,
      providerSignature: null,
      providerStatus: paymentEntity.status || eventName,
      providerPayload: event,
      client
    });
  });

  res.json({
    success: true,
    event: eventName,
    result
  });
});

/**
 * Temporary compatibility endpoint:
 * Do not allow demo verification in production unless DEMO_PAYMENT_ENABLED=true.
 */
const verifyDemoPayment = asyncHandler(async (req, res) => {
  if (String(process.env.DEMO_PAYMENT_ENABLED || 'false').toLowerCase() !== 'true') {
    return res.status(403).json({
      success: false,
      message: 'Demo payment verification is disabled.'
    });
  }

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

  if (!canAccessOrder(req.user, order, req)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to access this order payment' });
  }

  assertOrderCanStartPayment(order);

  if (!demoSuccess) {
    const result = await withTransaction(async (client) => {
      const failedPayment = await updatePayment(payment.id, { status: 'failed' }, client);
      const failedOrder = await updateOrderPayment(order.id, 'failed', 'failed', client);
      return { payment: failedPayment, order: failedOrder };
    });

    return res.json({ success: true, message: 'Payment marked failed in demo', ...result });
  }

  const result = await withTransaction(async (client) => {
    const collectedPayment = await updatePayment(payment.id, {
      status: 'collected',
      transactionId: `demo_payment_${Date.now()}`,
      verifiedAt: new Date().toISOString()
    }, client);
    const collectedOrder = await updateOrderPayment(order.id, 'collected', 'payment_collected', client);
    const autoQueue = await queuePrintJobIfPaymentReady(collectedOrder.id, collectedOrder.centreId, client);
    return {
      payment: collectedPayment,
      order: autoQueue.order || collectedOrder,
      autoQueue,
      printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
    };
  });

  res.json({
    success: true,
    message: result.autoQueue?.message || 'Payment collected in demo mode',
    ...result
  });
});
