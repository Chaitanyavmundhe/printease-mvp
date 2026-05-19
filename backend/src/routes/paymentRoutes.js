import express from 'express';
import {
  createRazorpayOrder,
  createRazorpayPaymentLink,
  verifyRazorpayPayment
} from '../controllers/paymentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/razorpay/order', authMiddleware, createRazorpayOrder);
router.post('/razorpay/verify', authMiddleware, verifyRazorpayPayment);
router.post('/razorpay/payment-link', authMiddleware, createRazorpayPaymentLink);

export default router;
