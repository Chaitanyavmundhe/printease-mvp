import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("printeaseDesktop", {
  isDesktop: true,
  getDesktopStatus: () => ipcRenderer.invoke("desktop:status"),
  checkBackendHealth: () => ipcRenderer.invoke("backend:health"),
  listPrinters: () => ipcRenderer.invoke("printers:list"),
  testPrint: (payload) => ipcRenderer.invoke("printers:test-print", payload),
  stopPrinting: () => ipcRenderer.invoke("printing:stop"),
  getAgentStatus: () => ipcRenderer.invoke("agent:status"),
  startPairing: (payload) => ipcRenderer.invoke("agent:start-pairing", payload),
  confirmPairing: () => ipcRenderer.invoke("agent:confirm-pairing"),
  sendHeartbeat: () => ipcRenderer.invoke("agent:heartbeat"),
  syncPrinters: () => ipcRenderer.invoke("agent:sync-printers"),
  pollPrintJobs: (payload) => ipcRenderer.invoke("agent:poll-once", payload),
  startJobPolling: (payload) => ipcRenderer.invoke("agent:start-polling", payload),
  stopJobPolling: () => ipcRenderer.invoke("agent:stop-polling"),
});
