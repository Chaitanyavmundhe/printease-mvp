const OFFICIAL_RENDER_BACKEND_URL = "https://printease-backend-byex.onrender.com";

function normalizeBackendUrl(url) {
  const value = String(url || "").trim().replace(/\/+$/, "");

  if (!value) return "";

  // Desktop APIs expect backend origin, not /api base URL.
  // Prevent accidental /api/api/health if VITE_API_URL includes /api.
  return value.endsWith("/api") ? value.slice(0, -4) : value;
}

function isLocalBackendUrl(url) {
  try {
    const { hostname } = new URL(url);
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

export function getBackendUrl() {
  const configuredUrl = normalizeBackendUrl(
    process.env.PRINTEASE_BACKEND_URL || process.env.VITE_API_URL || process.env.BACKEND_URL
  );

  // Desktop shell must use online Render backend by default.
  // Local backend is allowed only when explicitly requested.
  if (configuredUrl) {
    if (isLocalBackendUrl(configuredUrl) && process.env.PRINTEASE_ALLOW_LOCAL_BACKEND !== "1") {
      console.warn(
        `[DESKTOP BACKEND CONFIG] Ignoring local backend URL "${configuredUrl}". ` +
          "Set PRINTEASE_ALLOW_LOCAL_BACKEND=1 only when intentionally testing local backend."
      );
      return OFFICIAL_RENDER_BACKEND_URL;
    }

    return configuredUrl;
  }

  return OFFICIAL_RENDER_BACKEND_URL;
}

export function getApiBaseUrl() {
  return `${getBackendUrl()}/api`;
}
