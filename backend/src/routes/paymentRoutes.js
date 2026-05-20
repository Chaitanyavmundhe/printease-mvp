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

const router = express.Router();

router.post('/razorpay/webhook', razorpayWebhook);
router.get('/config', getPaymentConfig);
router.post('/razorpay/order', authMiddleware, createRazorpayOrder);
router.post('/razorpay/verify', authMiddleware, verifyRazorpayPayment);
router.post('/razorpay/upi-qr', authMiddleware, createRazorpayUpiQr);

/**
 * Compatibility only. Disabled unless DEMO_PAYMENT_ENABLED=true.
 */
router.post('/verify-demo', authMiddleware, verifyDemoPayment);

export default router;