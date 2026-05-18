import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("printeaseDesktop", {
  isDesktop: true,
  getDesktopStatus: () => ipcRenderer.invoke("desktop:status"),
  checkBackendHealth: () => ipcRenderer.invoke("backend:health"),
  listPrinters: () => ipcRenderer.invoke("printers:list"),
  testPrint: (payload) => ipcRenderer.invoke("printers:test-print", payload),
  stopPrinting: () => ipcRenderer.invoke("printing:stop"),
});
