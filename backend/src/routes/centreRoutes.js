import express from 'express';
import { getCentreByCode, getCentres, updateCentrePricing, updatePaymentMethod, deleteMyCentre } from '../controllers/centreController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import { centreLookupRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.get('/', getCentres);
router.get('/:code', centreLookupRateLimit, getCentreByCode);
router.patch('/me/pricing', authMiddleware, roleMiddleware('hub'), updateCentrePricing);
router.patch('/me/payment-method', authMiddleware, roleMiddleware('hub'), updatePaymentMethod);
router.delete('/me', authMiddleware, roleMiddleware('hub'), deleteMyCentre);

export default router;
