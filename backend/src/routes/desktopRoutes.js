import express from 'express';
import {
  desktopHeartbeat,
  getDesktopDeviceStatus,
  registerDesktopDevice
} from '../controllers/desktopController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { agentAuthMiddleware } from '../middleware/agentAuthMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.post('/device/register', authMiddleware, roleMiddleware('hub'), registerDesktopDevice);
router.post('/device/heartbeat', agentAuthMiddleware, desktopHeartbeat);
router.get('/device/status', agentAuthMiddleware, getDesktopDeviceStatus);

export default router;
