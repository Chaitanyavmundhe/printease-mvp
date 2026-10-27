import express from 'express';
import {
  acceptJob,
  confirmPairing,
  getPredownloadCandidates,
  getPendingVerificationJobs,
  reportVerificationResult,
  getNextJob,
  getAgentConfig,
  heartbeat,
  markCompleted,
  markCancelled,
  markDownloading,
  markFailed,
  markPrinting,
  startPairing,
  syncPrinters,
  reportPreparationResult
} from '../controllers/agentController.js';
import { getNextConversionJob } from '../controllers/agentConversionController.js';
// Uses the router's agent authentication, separate from the hub user's login.
import { getAgentJobStatus } from '../controllers/agentJobStatusController.js';
import { agentAuthMiddleware } from '../middleware/agentAuthMiddleware.js';
import { agentPairingRateLimit } from '../middleware/rateLimitMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { withAgentUploadCapacity } from '../middleware/uploadCapacity.js';

const router = express.Router();

router.post('/pair/start', agentPairingRateLimit, startPairing);
router.post('/pair/confirm', agentPairingRateLimit, confirmPairing);

router.post('/heartbeat', agentAuthMiddleware, heartbeat);
router.get('/config', agentAuthMiddleware, getAgentConfig);
router.post('/printers', agentAuthMiddleware, syncPrinters);
router.get('/jobs/predownload', agentAuthMiddleware, getPredownloadCandidates);
router.get('/jobs/verify', agentAuthMiddleware, getPendingVerificationJobs);
router.post('/jobs/:jobId/verify-result', agentAuthMiddleware, withAgentUploadCapacity(upload.single('printReadyFile'), reportVerificationResult));
router.get('/jobs/next', agentAuthMiddleware, getNextJob);
router.get('/jobs/:jobId', agentAuthMiddleware, getAgentJobStatus);
router.post('/jobs/:jobId/accepted', agentAuthMiddleware, acceptJob);
router.post('/jobs/:jobId/downloading', agentAuthMiddleware, markDownloading);
router.post('/jobs/:jobId/printing', agentAuthMiddleware, markPrinting);
router.post('/jobs/:jobId/completed', agentAuthMiddleware, markCompleted);
router.post('/jobs/:jobId/failed', agentAuthMiddleware, markFailed);
router.post('/jobs/:jobId/cancelled', agentAuthMiddleware, markCancelled);

router.post('/preparation-result', agentAuthMiddleware, withAgentUploadCapacity(upload.single('printReadyFile'), reportPreparationResult));
router.get('/conversion-jobs/next', agentAuthMiddleware, getNextConversionJob);

export default router;
