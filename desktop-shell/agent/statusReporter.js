import { sendHeartbeat, backendRequest } from "./heartbeat.js";

function normalizePrinters(printers) {
  if (!Array.isArray(printers)) return [];

  return printers.map((printer) => ({
    printerName: printer.printerName,
    systemPrinterId: printer.systemPrinterId || printer.printerName,
    status: printer.status || "unknown",
    isDefault: Boolean(printer.isDefault),
  }));
}

export async function syncPrinters({ agentToken, printers = [] } = {}) {
  if (!agentToken) {
    return {
      success: false,
      message: "Pair the desktop before syncing printers.",
    };
  }

  try {
    return await backendRequest({
      endpoint: "/agent/printers",
      method: "POST",
      agentToken,
      body: {
        printers: normalizePrinters(printers),
      },
    });
  } catch (error) {
    return {
      success: false,
      message: error.message || "Could not sync printers.",
      status: error.status || 0,
    };
  }
}

export async function reportStatus({ agentToken, printers = [], paused = false } = {}) {
  if (!agentToken) {
    return {
      success: false,
      message: "Pair the desktop before reporting status.",
    };
  }

  const [heartbeat, printerSync] = await Promise.all([
    sendHeartbeat({ agentToken, paused }),
    syncPrinters({ agentToken, printers }),
  ]);

  return {
    success: Boolean(heartbeat.success && printerSync.success),
    heartbeat,
    printerSync,
  };
}
