const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { listPrinters, stopPrinting, testPrint } = require("./printer/printExecutor.js");

const BACKEND_URL = "https://printease-backend-byex.onrender.com";
const DEV_FRONTEND_URL = process.env.PRINTEASE_FRONTEND_URL || "http://localhost:5173";

let mainWindow = null;
let ipcHandlersRegistered = false;

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
        background: #ffffff;
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

function registerIpcHandlers() {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  ipcMain.handle("desktop:status", () => ({
    isDesktop: true,
    backendUrl: BACKEND_URL,
    platform: process.platform,
  }));

  ipcMain.handle("printers:list", async () => listPrinters());

  ipcMain.handle("printers:test-print", async (_event, payload = {}) => {
    const printerName = typeof payload === "string" ? payload : payload?.printerName;
    return testPrint(printerName);
  });

  ipcMain.handle("printing:stop", async () => stopPrinting());
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
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: "PrintEase Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on("did-fail-load", async (_event, _errorCode, _errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || app.isPackaged || !validatedURL.startsWith(DEV_FRONTEND_URL)) return;
    await mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getDevServerErrorHtml())}`);
  });

  if (!app.isPackaged && process.env.PRINTEASE_OPEN_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  loadFrontend(mainWindow);
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

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
