import express from 'express';
import {
  desktopHeartbeat,
  getDesktopDeviceStatus,
  logDesktopPrinterDiagnostics,
  registerDesktopDevice,
  syncDesktopEvents,
  syncDesktopOrders,
  syncDesktopPrintJobs,
  updateDesktopPrintJobStatus
} from '../controllers/desktopController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { agentAuthMiddleware } from '../middleware/agentAuthMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import { diagnosticsRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/printer-diagnostics', diagnosticsRateLimit, logDesktopPrinterDiagnostics);
router.post('/device/register', authMiddleware, roleMiddleware('hub'), registerDesktopDevice);
router.post('/device/heartbeat', agentAuthMiddleware, desktopHeartbeat);
router.get('/device/status', agentAuthMiddleware, getDesktopDeviceStatus);
router.get('/orders', agentAuthMiddleware, syncDesktopOrders);
router.get('/print-jobs', agentAuthMiddleware, syncDesktopPrintJobs);
router.post('/print-jobs/:jobId/status', agentAuthMiddleware, updateDesktopPrintJobStatus);
router.post('/sync/events', agentAuthMiddleware, syncDesktopEvents);

export default router;
