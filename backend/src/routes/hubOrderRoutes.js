import express from 'express';
import {
  updateHubOrderConfiguration,
  getHubOrderConfigurationHistory,
  confirmBill
} from '../controllers/hubOrderConfigurationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Enforce authentication and role validation for all sub-routes
router.use(authMiddleware, roleMiddleware('hub'));

router.patch('/:orderId/configuration', updateHubOrderConfiguration);
router.get('/:orderId/configuration-history', getHubOrderConfigurationHistory);
router.post('/:orderId/confirm-bill', confirmBill);

export default router;
