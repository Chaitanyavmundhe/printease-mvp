const { contextBridge, ipcRenderer } = require("electron");

try {
  console.log(`[DESKTOP PRELOAD] loading ${window.location.href}`);

  const bridge = {
    isDesktop: true,
    bridgeVersion: "0.1.0-cjs",
    getDesktopStatus: () => ipcRenderer.invoke("desktop:status"),
    checkBackendHealth: () => ipcRenderer.invoke("backend:health"),
    listPrinters: () => ipcRenderer.invoke("printers:list"),
    onPrintersUpdated: (callback) => {
      const listener = (_event, result) => callback(result);
      ipcRenderer.on("printers:updated", listener);
      return () => ipcRenderer.removeListener("printers:updated", listener);
    },
    diagnosePrinters: () => ipcRenderer.invoke("printers:diagnose"),
    testPrint: (payload) => ipcRenderer.invoke("printers:test-print", payload),
    stopPrinting: () => ipcRenderer.invoke("printing:stop"),
    getAgentStatus: () => ipcRenderer.invoke("agent:status"),
    startPairing: (payload) => ipcRenderer.invoke("agent:start-pairing", payload),
    confirmPairing: () => ipcRenderer.invoke("agent:confirm-pairing"),
    sendHeartbeat: () => ipcRenderer.invoke("agent:heartbeat"),
    syncPrinters: () => ipcRenderer.invoke("agent:sync-printers"),
    pollPrintJobs: (payload) => ipcRenderer.invoke("agent:poll-once", payload),
    startJobPolling: (payload) => ipcRenderer.invoke("agent:start-polling"),
    stopJobPolling: () => ipcRenderer.invoke("agent:stop-polling"),
  };

  contextBridge.exposeInMainWorld("printeaseDesktop", bridge);
  console.log(`[DESKTOP PRELOAD] bridge exposed ${bridge.bridgeVersion}`);
} catch (error) {
  console.error(`[DESKTOP PRELOAD] failed ${error?.stack || error?.message || String(error)}`);
  throw error;
}
