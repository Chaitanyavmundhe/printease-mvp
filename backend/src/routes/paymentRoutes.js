import express from 'express';
import {
  createRazorpayOrder,
  createRazorpayUpiQr,
  getPaymentConfig,
  razorpayWebhook,
  verifyDemoPayment,
  verifyRazorpayPayment
} from '../controllers/paymentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { paymentRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/razorpay/webhook', razorpayWebhook);
router.get('/config', getPaymentConfig);
router.post('/razorpay/order', authMiddleware, paymentRateLimit, createRazorpayOrder);
router.post('/razorpay/verify', authMiddleware, paymentRateLimit, verifyRazorpayPayment);
router.post('/razorpay/upi-qr', authMiddleware, paymentRateLimit, createRazorpayUpiQr);

/**
 * Compatibility only. Disabled unless DEMO_PAYMENT_ENABLED=true.
 */
router.post('/verify-demo', authMiddleware, paymentRateLimit, verifyDemoPayment);

export default router;
