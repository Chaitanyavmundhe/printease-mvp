import { app, BrowserWindow, ipcMain, session } from "electron";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diagnosePrinters, listPrinters, stopPrinting, testPrint } from "./printer/printExecutor.js";
import { confirmPairing, sendHeartbeat, startPairing } from "./agent/heartbeat.js";
import { createJobPoller, processNextJob } from "./agent/jobPoller.js";
import { syncPrinters } from "./agent/statusReporter.js";
import { getApiBaseUrl, getBackendUrl } from "./config/backend.js";
import { loadConfig, saveConfig, setConfigDirectory } from "./local/config.js";

const DEV_FRONTEND_URL = process.env.PRINTEASE_FRONTEND_URL || "http://127.0.0.1:5175";
const VERSION = "0.1.0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");

let mainWindow = null;
let ipcHandlersRegistered = false;
let latestPrinterResult = null;
let agentSession = {
  deviceId: "",
  deviceName: "",
  pairingCode: "",
  pairingSessionId: "",
  expiresAt: "",
  agentId: "",
  hubId: "",
  accessToken: "",
  pairedAt: "",
  lastHeartbeatAt: "",
};
let jobPoller = null;

function getProductionIndexPath() {
  return path.join(__dirname, "..", "frontend", "dist", "index.html");
}

function getDevServerErrorHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>PrintEase Desktop</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f8fafc;
        color: #0f172a;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(640px, calc(100vw - 48px));
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        background: #fff;
        padding: 32px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        color: #475569;
        line-height: 1.6;
      }
      pre {
        overflow-x: auto;
        border-radius: 12px;
        background: #0f172a;
        color: #e2e8f0;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Frontend dev server is not running</h1>
      <p>PrintEase Desktop loads the existing React frontend during development. Start it first, then reopen the desktop shell.</p>
      <pre>cd frontend
npm run dev</pre>
    </main>
  </body>
</html>`;
}

async function loadFrontend(window) {
  if (app.isPackaged) {
    await window.loadFile(getProductionIndexPath());
    return;
  }

  try {
    await window.loadURL(DEV_FRONTEND_URL);
  } catch {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getDevServerErrorHtml())}`);
  }
}

async function checkBackendHealth() {
  const backendUrl = getBackendUrl({ packaged: app.isPackaged });
  const apiBaseUrl = getApiBaseUrl({ packaged: app.isPackaged });

  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    const data = await response.json().catch(() => null);

    return {
      success: response.ok,
      status: response.status,
      backendUrl,
      apiBaseUrl,
      data,
    };
  } catch (error) {
    return {
      success: false,
      backendUrl,
      apiBaseUrl,
      error: error.message || "Could not reach backend health endpoint.",
    };
  }
}

async function reportPrinterDiagnostic(event, result) {
  try {
    await fetch(`${getApiBaseUrl({ packaged: app.isPackaged })}/desktop/printer-diagnostics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        event,
        deviceId: agentSession.deviceId || null,
        deviceName: agentSession.deviceName || null,
        platform: process.platform,
        version: VERSION,
        paired: Boolean(agentSession.accessToken),
        result,
      }),
    });
  } catch (error) {
    console.warn("[DESKTOP PRINTER DIAGNOSTIC REPORT FAILED]", error.message || error);
  }
}

function emitPrinterResult(result) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send("printers:updated", result);
    }
  }
}

async function refreshLocalPrinterResult(event) {
  const result = await listPrinters();
  latestPrinterResult = result;
  console.log("[DESKTOP PRINTERS]", JSON.stringify(result, null, 2));
  emitPrinterResult(result);
  await reportPrinterDiagnostic(event, result);
  return result;
}

function reportStartupPrinterDiagnostics() {
  refreshLocalPrinterResult("desktop:startup-list")
    .then((result) => {
      console.log("[DESKTOP STARTUP PRINTERS]", JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.warn("[DESKTOP STARTUP PRINTERS FAILED]", error.message || error);
    });

  diagnosePrinters()
    .then(async (result) => {
      console.log("[DESKTOP STARTUP PRINTER DIAGNOSTICS]", JSON.stringify(result, null, 2));
      await reportPrinterDiagnostic("desktop:startup-diagnose", result);
    })
    .catch((error) => {
      console.warn("[DESKTOP STARTUP PRINTER DIAGNOSTICS FAILED]", error.message || error);
    });
}

function sanitizeAgentSession() {
  return {
    success: true,
    deviceId: agentSession.deviceId,
    deviceName: agentSession.deviceName,
    pairingCode: agentSession.pairingCode,
    pairingSessionId: agentSession.pairingSessionId,
    expiresAt: agentSession.expiresAt,
    agentId: agentSession.agentId,
    hubId: agentSession.hubId,
    paired: Boolean(agentSession.accessToken),
    pairedAt: agentSession.pairedAt,
    lastHeartbeatAt: agentSession.lastHeartbeatAt,
    polling: Boolean(jobPoller?.isRunning),
  };
}

async function ensureDeviceIdentity(deviceName) {
  if (agentSession.deviceId && agentSession.deviceName) return;

  const savedConfig = await loadConfig();
  agentSession.deviceId = savedConfig.deviceId || randomUUID();
  agentSession.deviceName = deviceName || savedConfig.deviceName || os.hostname() || "PrintEase Desktop";

  await saveConfig({
    deviceId: agentSession.deviceId,
    deviceName: agentSession.deviceName,
    agentId: agentSession.agentId,
    hubId: agentSession.hubId,
  });
}

function requirePairedAgent() {
  if (!agentSession.accessToken) {
    return {
      success: false,
      message: "Pair this desktop with a print hub before using agent actions.",
      session: sanitizeAgentSession(),
    };
  }

  return null;
}

async function startAgentPairing(_event, payload = {}) {
  await ensureDeviceIdentity(payload.deviceName);

  const result = await startPairing({
    deviceId: agentSession.deviceId,
    agentName: agentSession.deviceName,
  });

  if (result.success) {
    agentSession.pairingCode = result.pairingCode || "";
    agentSession.pairingSessionId = result.pairingSessionId || "";
    agentSession.expiresAt = result.expiresAt || "";
  }

  return {
    ...result,
    session: sanitizeAgentSession(),
  };
}

async function confirmAgentPairing() {
  await ensureDeviceIdentity();

  if (!agentSession.pairingSessionId) {
    return {
      success: false,
      paired: false,
      message: "Start pairing before confirming.",
      session: sanitizeAgentSession(),
    };
  }

  const result = await confirmPairing({
    pairingSessionId: agentSession.pairingSessionId,
    deviceId: agentSession.deviceId,
  });

  if (result.success && result.paired && result.accessToken) {
    agentSession.accessToken = result.accessToken;
    agentSession.agentId = result.agentId || "";
    agentSession.hubId = result.hubId || result.shopId || "";
    agentSession.pairedAt = new Date().toISOString();
    agentSession.pairingCode = "";

    await saveConfig({
      deviceId: agentSession.deviceId,
      deviceName: agentSession.deviceName,
      agentId: agentSession.agentId,
      hubId: agentSession.hubId,
    });
  }

  return {
    ...result,
    accessToken: undefined,
    refreshToken: undefined,
    session: sanitizeAgentSession(),
  };
}

async function sendAgentHeartbeat() {
  const pairingError = requirePairedAgent();
  if (pairingError) return pairingError;

  const result = await sendHeartbeat({
    agentToken: agentSession.accessToken,
  });

  if (result.success) {
    agentSession.lastHeartbeatAt = new Date().toISOString();
  }

  return {
    ...result,
    session: sanitizeAgentSession(),
  };
}

async function syncAgentPrinters() {
  const pairingError = requirePairedAgent();
  if (pairingError) return pairingError;

  const printerResult = await listPrinters();
  if (!printerResult.success) return printerResult;

  const syncResult = await reportStatus({
    agentToken: agentSession.accessToken,
    printers: printerResult.printers,
    paused: false,
  });

  return {
    ...syncResult,
    localPrinters: printerResult.printers,
    session: sanitizeAgentSession(),
  };
}

async function pollAgentOnce(_event, payload = {}) {
  const pairingError = requirePairedAgent();
  if (pairingError) return pairingError;

  return processNextJob({
    agentToken: agentSession.accessToken,
    printerName: payload.printerName,
  });
}

function startAgentPolling(_event, payload = {}) {
  const pairingError = requirePairedAgent();
  if (pairingError) return pairingError;

  if (!jobPoller) {
    jobPoller = createJobPoller({
      agentToken: agentSession.accessToken,
      printerName: payload.printerName,
      intervalMs: payload.intervalMs,
    });
  }

  const result = jobPoller.start({
    agentToken: agentSession.accessToken,
    printerName: payload.printerName,
    intervalMs: payload.intervalMs,
  });

  return {
    ...result,
    session: sanitizeAgentSession(),
  };
}

function stopAgentPolling() {
  const result = jobPoller?.stop() || {
    success: true,
    message: "Job polling is not running.",
  };

  return {
    ...result,
    session: sanitizeAgentSession(),
  };
}

function registerIpcHandlers() {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  ipcMain.handle("desktop:status", async () => {
    const printerResult = latestPrinterResult || await refreshLocalPrinterResult("desktop:status");

    return {
      success: true,
      isDesktop: true,
      platform: process.platform,
      backendUrl: getBackendUrl({ packaged: app.isPackaged }),
      apiBaseUrl: getApiBaseUrl({ packaged: app.isPackaged }),
      version: VERSION,
      printerResult,
    };
  });

  ipcMain.handle("backend:health", () => checkBackendHealth());
  ipcMain.handle("printers:list", () => refreshLocalPrinterResult("printers:list"));
  ipcMain.handle("printers:diagnose", async () => {
    const result = await diagnosePrinters();
    console.log("[DESKTOP PRINTER DIAGNOSTICS]", JSON.stringify(result, null, 2));
    await reportPrinterDiagnostic("printers:diagnose", result);
    return result;
  });

  ipcMain.handle("printers:test-print", (_event, payload = {}) => {
    const printerName = typeof payload === "string" ? payload : payload?.printerName;
    return testPrint(printerName);
  });

  ipcMain.handle("printing:stop", () => stopPrinting());
  ipcMain.handle("agent:status", () => sanitizeAgentSession());
  ipcMain.handle("agent:start-pairing", startAgentPairing);
  ipcMain.handle("agent:confirm-pairing", confirmAgentPairing);
  ipcMain.handle("agent:heartbeat", sendAgentHeartbeat);
  ipcMain.handle("agent:sync-printers", syncAgentPrinters);
  ipcMain.handle("agent:poll-once", pollAgentOnce);
  ipcMain.handle("agent:start-polling", startAgentPolling);
  ipcMain.handle("agent:stop-polling", stopAgentPolling);
}

function isAllowedNavigation(url) {
  if (url.startsWith("data:text/html")) return true;
  if (app.isPackaged) return url.startsWith("file://");

  try {
    return new URL(url).origin === new URL(DEV_FRONTEND_URL).origin;
  } catch {
    return false;
  }
}

function createMainWindow() {
  console.log("[DESKTOP WINDOW]", {
    frontendUrl: DEV_FRONTEND_URL,
    preload: PRELOAD_PATH,
  });

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: "PrintEase Desktop",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("[DESKTOP PRELOAD ERROR]", {
      preloadPath,
      error: error?.stack || error?.message || String(error),
    });
  });
  mainWindow.webContents.on("console-message", (_event, _level, message) => {
    if (String(message).startsWith("[DESKTOP PRELOAD]")) {
      console.log(message);
    }
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on("did-fail-load", async (_event, _errorCode, _errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || app.isPackaged || !validatedURL.startsWith(DEV_FRONTEND_URL)) return;
    await mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getDevServerErrorHtml())}`);
  });
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents
      .executeJavaScript(`({
        hasBridge: Boolean(window.printeaseDesktop),
        isDesktop: Boolean(window.printeaseDesktop?.isDesktop),
        bridgeVersion: window.printeaseDesktop?.bridgeVersion || null,
        bridgeKeys: window.printeaseDesktop ? Object.keys(window.printeaseDesktop) : []
      })`)
      .then((bridgeState) => {
        console.log("[DESKTOP RENDERER]", {
          url: mainWindow.webContents.getURL(),
          ...bridgeState,
        });
      })
      .catch((error) => {
        console.warn("[DESKTOP RENDERER CHECK FAILED]", error.message || error);
      });

    if (latestPrinterResult) emitPrinterResult(latestPrinterResult);
  });

  loadFrontend(mainWindow);
}

app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  setConfigDirectory(app.getPath("userData"));
  await ensureDeviceIdentity();
  registerIpcHandlers();
  createMainWindow();
  setTimeout(reportStartupPrinterDiagnostics, 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
