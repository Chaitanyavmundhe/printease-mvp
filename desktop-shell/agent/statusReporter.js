const { backendRequest, sendHeartbeat } = require("./heartbeat.js");
const { listPrinters } = require("../printer/printExecutor.js");

function buildStatusReport({ printers = [], jobs = [] } = {}) {
  return {
    platform: process.platform,
    printerCount: printers.length,
    activeJobCount: jobs.length,
    reportedAt: new Date().toISOString(),
  };
}

async function reportStatus() {
  return {
    success: false,
    error: "Agent token is required before reporting desktop status.",
  };
}

function normalizePrintersForBackend(printers) {
  if (!Array.isArray(printers)) return [];

  return printers.map((printer) => ({
    printerName: printer.printerName,
    systemPrinterId: printer.systemPrinterId || printer.printerName,
    status: printer.status || "unknown",
    isDefault: Boolean(printer.isDefault),
  }));
}

async function syncPrinters({ agentToken, printers } = {}) {
  if (!agentToken) {
    return {
      success: false,
      error: "Agent token is required before syncing printers.",
    };
  }

  try {
    return await backendRequest({
      endpoint: "/api/agents/printers",
      method: "POST",
      agentToken,
      body: {
        printers: normalizePrintersForBackend(printers),
      },
    });
  } catch (error) {
    return {
      success: false,
      error: error.message || "Could not sync printers.",
      status: error.status || 0,
    };
  }
}

async function reportDesktopStatus({ agentToken, device = {} } = {}) {
  if (!agentToken) return reportStatus();

  const printers = await listPrinters();
  const printerList = Array.isArray(printers) ? printers : [];
  const [heartbeat, printerSync] = await Promise.all([
    sendHeartbeat({ agentToken, device }),
    syncPrinters({ agentToken, printers: printerList }),
  ]);

  return {
    success: Boolean(heartbeat?.success && printerSync?.success),
    heartbeat,
    printerSync,
    statusReport: buildStatusReport({ printers: printerList }),
  };
}

module.exports = {
  buildStatusReport,
  reportDesktopStatus,
  reportStatus,
  syncPrinters,
};
