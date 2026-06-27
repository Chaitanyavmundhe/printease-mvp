const fs = require('fs');

const authExports = ['startPairing', 'confirmPairing', 'heartbeat', 'getAgentConfig'];
const printerExports = ['syncPrinters'];
const jobsExports = ['getNextJob', 'getPredownloadCandidates', 'acceptJob', 'markDownloading', 'markPrinting', 'markCompleted', 'markFailed', 'markCancelled'];
const prepExports = ['reportPreparationResult', 'getPendingVerificationJobs', 'reportVerificationResult'];

function cleanFile(filePath, keepExports) {
  let code = fs.readFileSync(filePath, 'utf8');
  // We want to find "export const <name> =" and if <name> is NOT in keepExports, remove the 'export ' part!
  // That will make it local. Then we can use a basic regex. Or better, just delete the block?
  // It's safer to just remove 'export '. ESLint can then remove unused variables.
  const regex = /export const ([a-zA-Z0-9_]+)/g;
  code = code.replace(regex, (match, name) => {
    if (keepExports.includes(name)) return match;
    return `const ${name}`; // Removes the export!
  });
  fs.writeFileSync(filePath, code);
}

cleanFile('src/controllers/agent/agentAuth.js', authExports);
cleanFile('src/controllers/agent/agentPrinters.js', printerExports);
cleanFile('src/controllers/agent/agentJobs.js', jobsExports);
cleanFile('src/controllers/agent/agentPreparation.js', prepExports);

console.log("Exports stripped.");
