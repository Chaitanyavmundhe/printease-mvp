import {
  createOrder as saveOrder,
  findCentreByCode,
  findCentreById,
  findOrderByIdOrCode,
  listOrdersByCentre,
  listOrdersByUser,
  updateOrderStatus as saveOrderStatus
} from '../db/repository.js';
import { calculatePrice } from '../utils/calculatePrice.js';
import { generateId, generateOrderCode, generateShortCode } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
  const pageCount = Number(pages);
  const copyCount = Number(copies);
  const allowedColorTypes = ['bw', 'color'];
  const allowedSideTypes = ['single', 'double'];

  if (!trimmedCentreCode && !hubId) {
    return res.status(400).json({ success: false, message: 'Centre code or hub ID is required' });
  }

  if (!documentName || !pages || !copies) {
    return res.status(400).json({ success: false, message: 'Document name, pages, and copies are required' });
  }

  if (!Number.isFinite(pageCount) || pageCount <= 0 || !Number.isFinite(copyCount) || copyCount <= 0) {
    return res.status(400).json({ success: false, message: 'Pages and copies must be positive numbers' });
  }

  if (!allowedColorTypes.includes(colorType) || !allowedSideTypes.includes(sideType)) {
    return res.status(400).json({ success: false, message: 'Invalid print options' });
  }

  const centre = hubId ? await findCentreById(hubId) : await findCentreByCode(trimmedCentreCode);
  if (!centre) {
    return res.status(404).json({ success: false, message: 'Centre not found' });
  }

  const price = calculatePrice({ centre, pages: pageCount, copies: copyCount, colorType, sideType, watermarkEnabled });
  const orderCode = generateOrderCode(centre.centreCode);

  const order = await saveOrder({
    id: generateId(),
    orderCode,
    userId: req.user?.id || null,
    centreId: centre.id,
    documentId: documentId || null,
    documentName,
    pages: pageCount,
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

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await saveOrderStatus(req.params.id, req.user.centreId, req.body.status);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found for this centre' });
  }

  res.json({ success: true, message: 'Order status updated', order });
});
