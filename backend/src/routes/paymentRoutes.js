import express from 'express';
import { createManualPaymentRequest, getPaymentConfig } from '../controllers/paymentController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';
import { paymentRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();
router.get('/config', getPaymentConfig);
router.post('/manual-request', optionalAuthMiddleware, paymentRateLimit, createManualPaymentRequest);

// Old clients/webhooks fail closed, regardless of stale gateway/demo env flags.
// No provider SDK, signature callback or payment mutation runs here.
router.use(['/razorpay', '/verify-demo'], (_req, res) => {
  res.status(410).json({
    success: false,
    code: 'ONLINE_PAYMENTS_REMOVED',
    message: 'Online and demo payments are unavailable. Request manual payment at the centre.',
  });
});
export default router;
