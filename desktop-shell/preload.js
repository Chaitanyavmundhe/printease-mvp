const { contextBridge, ipcRenderer } = require("electron");

const desktopApi = Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: "0.1.0",
  listPrinters: async () => ipcRenderer.invoke("printers:list"),
  testPrint: async (payload) => ipcRenderer.invoke("printers:test-print", payload),
  stopPrinting: async () => ipcRenderer.invoke("printing:stop"),
  getDesktopStatus: async () => ipcRenderer.invoke("desktop:status"),
});

contextBridge.exposeInMainWorld("printeaseDesktop", desktopApi);
