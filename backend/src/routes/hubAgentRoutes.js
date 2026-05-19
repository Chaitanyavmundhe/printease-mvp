import express from 'express';
import {
  getHubAgentSummary,
  listHubAgents,
  listHubPrintJobs,
  pairAgentToHub,
  getPairingSessionDetails,
  approveAgentPairing,
  rejectAgentPairing,
  pauseAgent,
  resumeAgent,
  revokeHubAgent,
  sendOrderToAgent
} from '../controllers/hubAgentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authMiddleware, roleMiddleware('hub'));

router.get('/summary', getHubAgentSummary);
router.get('/print-jobs', listHubPrintJobs);
router.get('/', listHubAgents);
router.get('/pair/session/:sessionId', getPairingSessionDetails);
router.post('/pair', pairAgentToHub);
router.post('/pair/approve', approveAgentPairing);
router.post('/pair/reject', rejectAgentPairing);
router.post('/:agentId/pause', pauseAgent);
router.post('/:agentId/resume', resumeAgent);
router.post('/:agentId/revoke', revokeHubAgent);
router.post('/orders/:orderId/send-to-agent', sendOrderToAgent);

export default router;
