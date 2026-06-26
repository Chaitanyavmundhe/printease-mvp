const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/routes/agentRoutes.js');
let code = fs.readFileSync(file, 'utf8');

const imports = `import {
  acceptJob,
  confirmPairing,
  getPredownloadCandidates,
  getNextJob,
  getPendingVerificationJobs,
  reportVerificationResult,
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
} from '../controllers/agentController.js';`;

code = code.replace(/import {[\s\S]*?} from '\.\.\/controllers\/agentController\.js';/, imports);

const routes = `router.get('/jobs/verify', agentAuthMiddleware, getPendingVerificationJobs);
router.post('/jobs/:jobId/verify-result', agentAuthMiddleware, reportVerificationResult);`;

code = code.replace(/router\.get\('\/jobs\/predownload', agentAuthMiddleware, getPredownloadCandidates\);/, 
  "router.get('/jobs/predownload', agentAuthMiddleware, getPredownloadCandidates);\n" + routes);

fs.writeFileSync(file, code);
