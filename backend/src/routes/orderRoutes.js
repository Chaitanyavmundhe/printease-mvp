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

const router = express.Router();

router.post('/', optionalAuthMiddleware, createOrder);
router.get('/mine', authMiddleware, roleMiddleware('user'), getMyOrders);
router.get('/centre/mine', authMiddleware, roleMiddleware('hub'), getCentreOrders);
router.get('/:orderId/documents', authMiddleware, getOrderDocuments);
router.get('/:id', getOrderById);
router.post('/:id/collect-payment', authMiddleware, roleMiddleware('hub'), collectCashPayment);
router.patch('/:id/status', authMiddleware, roleMiddleware('hub'), updateOrderStatus);

export default router;
