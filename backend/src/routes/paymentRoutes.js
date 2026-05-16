import express from 'express';
import { createPayment, verifyPayment } from '../controllers/paymentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create', authMiddleware, createPayment);
router.post('/verify-demo', authMiddleware, verifyPayment);

export default router;
