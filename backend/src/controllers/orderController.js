import {
  createOrder as saveOrder,
  findCentreByCode,
  findCentreById,
  createPayment as savePayment,
  findDocumentById,
  findOrderByIdOrCode,
  listOrdersByCentre,
  listOrdersByUser,
  updateOrderPayment,
  updateOrderStatus as saveOrderStatus,
  withTransaction
} from '../db/repository.js';
import { calculatePrice } from '../utils/calculatePrice.js';
import { generateId, generateOrderCode, generateShortCode } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { queuePrintJobIfPaymentReady } from '../services/printQueueService.js';

export const createOrder = asyncHandler(async (req, res) => {
  const {
    centreCode,
    hubId,
    documentId,
    documentName,
    pages,
    copies,
    colorType = 'bw',
    sideType = 'single',
    watermarkEnabled = false
  } = req.body;

  const trimmedCentreCode = typeof centreCode === 'string' ? centreCode.trim() : '';
  const submittedPageCount = Number(pages);
  const copyCount = Number(copies);
  const allowedColorTypes = ['bw', 'color'];
  const allowedSideTypes = ['single', 'double'];

  if (!trimmedCentreCode && !hubId) {
    return res.status(400).json({ success: false, message: 'Centre code or hub ID is required' });
  }

  if ((!documentName && !documentId) || !copies) {
    return res.status(400).json({ success: false, message: 'Document name or document ID, and copies are required' });
  }

  let document = null;
  if (documentId) {
    document = await findDocumentById(documentId);

    if (!document) {
      return res.status(404).json({ success: false, message: 'Uploaded document not found' });
    }

    if (
      document.userId &&
      req.user?.role !== 'hub' &&
      req.user?.role !== 'admin' &&
      document.userId !== req.user?.id
    ) {
      return res.status(403).json({ success: false, message: 'You are not allowed to use this uploaded document' });
    }
  }

  const trustedPageCount = document?.pageCount || submittedPageCount;

  if (!Number.isFinite(trustedPageCount) || trustedPageCount <= 0 || !Number.isFinite(copyCount) || copyCount <= 0) {
    return res.status(400).json({ success: false, message: 'Pages and copies must be positive numbers' });
  }

  if (!allowedColorTypes.includes(colorType) || !allowedSideTypes.includes(sideType)) {
    return res.status(400).json({ success: false, message: 'Invalid print options' });
  }

  const centre = hubId ? await findCentreById(hubId) : await findCentreByCode(trimmedCentreCode);
  if (!centre) {
    return res.status(404).json({ success: false, message: 'Centre not found' });
  }

  const price = calculatePrice({ centre, pages: trustedPageCount, copies: copyCount, colorType, sideType, watermarkEnabled });
  const orderCode = generateOrderCode(centre.centreCode);

  const order = await saveOrder({
    id: generateId(),
    orderCode,
    userId: req.user?.id || null,
    centreId: centre.id,
    documentId: documentId || null,
    documentName: documentName || document?.fileName || 'Uploaded Document',
    pages: trustedPageCount,
    copies: copyCount,
    colorType,
    sideType,
    watermarkEnabled: Boolean(watermarkEnabled),
    amount: price.totalAmount,
    paymentStatus: 'pending',
    status: 'Payment Pending',
    pickupCode: generateShortCode(4),
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: 'Order created. Complete payment before printing.',
    order,
    price
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await findOrderByIdOrCode(req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({ success: true, order });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await listOrdersByUser(req.user.id);
  res.json({ success: true, orders });
});

export const getCentreOrders = asyncHandler(async (req, res) => {
  const orders = await listOrdersByCentre(req.user.centreId);
  res.json({ success: true, orders });
});

export const collectCashPayment = asyncHandler(async (req, res) => {
  const hubId = req.user?.centreId || req.user?.hubId;
  const orderId = req.params.id;

  const result = await withTransaction(async (client) => {
    const order = await findOrderByIdOrCode(orderId, client);

    if (!order || order.centreId !== hubId) {
      return { notFound: true };
    }

    const normalizedPaymentStatus = String(order.paymentStatus || '').toLowerCase();
    if (!['pending', 'unpaid', ''].includes(normalizedPaymentStatus)) {
      const autoQueue = await queuePrintJobIfPaymentReady(order.id, hubId, client);
      return {
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
      method: 'CASH',
      transactionId: `cash_collected_${Date.now()}`,
      status: 'collected',
      createdAt: now,
      verifiedAt: now
    }, client);

    const collectedOrder = await updateOrderPayment(order.id, 'collected', 'Payment Collected', client);
    const autoQueue = await queuePrintJobIfPaymentReady(collectedOrder.id, hubId, client);

    return {
      payment,
      order: autoQueue.order || collectedOrder,
      autoQueue,
      printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
    };
  });

  if (result?.notFound) {
    return res.status(404).json({ success: false, message: 'Order not found for this hub' });
  }

  res.json({
    success: true,
    message: result.autoQueue?.message || 'Payment collected.',
    ...result
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await saveOrderStatus(req.params.id, req.user.centreId, req.body.status);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found for this centre' });
  }

  res.json({ success: true, message: 'Order status updated', order });
});
