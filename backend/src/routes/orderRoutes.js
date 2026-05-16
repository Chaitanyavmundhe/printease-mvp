import express from 'express';
import {
  createOrder,
  getCentreOrders,
  getMyOrders,
  getOrderById,
  updateOrderStatus
} from '../controllers/orderController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.post('/', optionalAuthMiddleware, createOrder);
router.get('/mine', authMiddleware, roleMiddleware('user'), getMyOrders);
router.get('/centre/mine', authMiddleware, roleMiddleware('hub'), getCentreOrders);
router.get('/:id', getOrderById);
router.patch('/:id/status', authMiddleware, roleMiddleware('hub'), updateOrderStatus);

export default router;
