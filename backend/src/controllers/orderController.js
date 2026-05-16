import {
  createOrder as saveOrder,
  findCentreByCode,
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
    documentId,
    documentName,
    pages,
    copies,
    colorType = 'bw',
    sideType = 'single',
    watermarkEnabled = false
  } = req.body;

  const centre = await findCentreByCode(centreCode);
  if (!centre) {
    return res.status(404).json({ success: false, message: 'Centre not found' });
  }

  if (!documentName || !pages || !copies) {
    return res.status(400).json({ success: false, message: 'Document name, pages, and copies are required' });
  }

  const price = calculatePrice({ centre, pages, copies, colorType, sideType, watermarkEnabled });
  const orderCode = generateOrderCode(centre.centreCode);

  const order = await saveOrder({
    id: generateId('order'),
    orderCode,
    userId: req.user?.id || null,
    centreId: centre.id,
    documentId: documentId || null,
    documentName,
    pages: Number(pages),
    copies: Number(copies),
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
