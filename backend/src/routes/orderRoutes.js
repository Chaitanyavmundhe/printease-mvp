import express from 'express';
import {
  collectCashPayment,
  createOrder,
  getCentreOrders,
  getMyOrders,
  getOrderDocuments,
  getOrderById,
  updateOrderStatus
} from '../controllers/orderController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import { guestOrderRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

const orderRateLimiter = (req, res, next) => {
  if (!req.user) return guestOrderRateLimit(req, res, next);
  return next();
};

router.post('/', optionalAuthMiddleware, orderRateLimiter, createOrder);
router.get('/mine', authMiddleware, roleMiddleware('user'), getMyOrders);
router.get('/centre/mine', authMiddleware, roleMiddleware('hub'), getCentreOrders);
router.get('/:orderId/documents', authMiddleware, getOrderDocuments);
router.get('/:id', optionalAuthMiddleware, getOrderById);
router.post('/:id/collect-payment', authMiddleware, roleMiddleware('hub'), collectCashPayment);
router.patch('/:id/status', authMiddleware, roleMiddleware('hub'), updateOrderStatus);

export default router;
