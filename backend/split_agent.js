const fs = require('fs');
const code = fs.readFileSync('src/controllers/agentController.js', 'utf8');

const authExports = ['startPairing', 'confirmPairing', 'heartbeat', 'getAgentConfig'];
const printerExports = ['syncPrinters'];
const jobsExports = ['getNextJob', 'getPredownloadCandidates', 'acceptJob', 'markDownloading', 'markPrinting', 'markCompleted', 'markFailed', 'markCancelled'];
const prepExports = ['reportPreparationResult', 'getPendingVerificationJobs', 'reportVerificationResult'];

const newController = `export { startPairing, confirmPairing, heartbeat, getAgentConfig } from './agent/agentAuth.js';
export { syncPrinters } from './agent/agentPrinters.js';
export { getNextJob, getPredownloadCandidates, acceptJob, markDownloading, markPrinting, markCompleted, markFailed, markCancelled } from './agent/agentJobs.js';
export { reportPreparationResult, getPendingVerificationJobs, reportVerificationResult } from './agent/agentPreparation.js';
`;

fs.writeFileSync('src/controllers/agentController.js', newController);
console.log("agentController.js is now a proxy!");
