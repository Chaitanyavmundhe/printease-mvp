import express from 'express';
import { getUserHistory, getOrderDetail } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/history', authMiddleware, roleMiddleware('user'), getUserHistory);
router.get('/history/:orderId', authMiddleware, roleMiddleware('user'), getOrderDetail);

export default router;
