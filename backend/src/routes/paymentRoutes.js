import express from 'express';
import { createPayment, verifyPayment } from '../controllers/paymentController.js';

const router = express.Router();

router.post('/create', createPayment);
router.post('/verify-demo', verifyPayment);

export default router;
