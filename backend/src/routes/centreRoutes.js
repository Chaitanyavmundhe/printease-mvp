import express from 'express';
import { getCentreByCode, getCentres, updateCentrePricing, updatePaymentMethod } from '../controllers/centreController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', getCentres);
router.get('/:code', getCentreByCode);
router.patch('/me/pricing', authMiddleware, roleMiddleware('centre'), updateCentrePricing);
router.patch('/me/payment-method', authMiddleware, roleMiddleware('centre'), updatePaymentMethod);

export default router;
