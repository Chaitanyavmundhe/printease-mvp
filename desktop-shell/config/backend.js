const PRODUCTION_BACKEND_URL = "https://printease-backend-byex.onrender.com";
const LOCAL_BACKEND_URL = "http://127.0.0.1:5005";

function normalizeUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function isElectronDevRuntime() {
  return Boolean(process.defaultApp || process.env.NODE_ENV === "development" || process.env.ELECTRON_IS_DEV === "1");
}

export function getBackendUrl({ packaged } = {}) {
  const configuredUrl = normalizeUrl(
    process.env.PRINTEASE_BACKEND_URL || process.env.VITE_API_URL || process.env.BACKEND_URL
  );

  if (configuredUrl) return configuredUrl;

  const isPackaged = typeof packaged === "boolean" ? packaged : !isElectronDevRuntime();
  return isPackaged ? PRODUCTION_BACKEND_URL : LOCAL_BACKEND_URL;
}

export function getApiBaseUrl(options) {
  return `${getBackendUrl(options)}/api`;
}
