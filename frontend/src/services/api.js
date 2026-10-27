const PRODUCTION_API_BASE_URL = "https://printease-backend-byex.onrender.com";
import { getCachedJson, invalidateCache } from "./requestCache";

function normalizeApiBaseUrl(url) {
  const value = String(url || "").trim().replace(/\/+$/, "");
  return value.endsWith("/api") ? value.slice(0, -4) : value;
}

const configuredApiUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
let API_BASE_URL = PRODUCTION_API_BASE_URL;

if (import.meta.env.DEV) {
  API_BASE_URL = "http://localhost:3000";
} else if (configuredApiUrl && configuredApiUrl !== PRODUCTION_API_BASE_URL) {
  console.warn(
    `[API CONFIG] Ignoring untrusted backend URL "${configuredApiUrl}". ` +
      "PrintEase frontend is pinned to the official Render backend."
  );
}

export default API_BASE_URL;

if (import.meta.env.DEV) {
  console.log("[API CONFIG]", {
    API_BASE_URL,
    VITE_API_URL: import.meta.env.VITE_API_URL || null,
    MODE: import.meta.env.MODE,
  });
}

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function getPrivateIdentity() {
  return JSON.stringify([
    localStorage.getItem("printease_token"),
    localStorage.getItem("printease_order_access_token"),
  ]);
}

function assertPrivateIdentity(identity) {
  if (getPrivateIdentity() !== identity) {
    throw new ApiError("Session changed. Please try again.", 401);
  }
}

function privateCacheKey(key) {
  return `${getPrivateIdentity()}:${key}`;
}

async function getPrivateCachedJson(key, fetcher, options) {
  const identity = getPrivateIdentity();
  const data = await getCachedJson(privateCacheKey(key), fetcher, options);
  assertPrivateIdentity(identity);
  return data;
}

function joinApiUrl(base, endpoint) {
  const cleanBase = base.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  if (cleanBase.endsWith("/api") && cleanEndpoint.startsWith("/api/")) {
    return `${cleanBase}${cleanEndpoint.slice(4)}`;
  }

  return `${cleanBase}${cleanEndpoint}`;
}

function createHeaders(options) {
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = localStorage.getItem("printease_token");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Anonymous access uses a scoped backend capability, not a fabricated login.
  // Reuse it for upload, checkout and document reads without overriding a caller.
  const orderAccessToken = localStorage.getItem("printease_order_access_token");
  if (orderAccessToken && !headers.has("x-order-access-token")) {
    headers.set("x-order-access-token", orderAccessToken);
  }

  return headers;
}

export async function apiRequest(endpoint, options = {}) {
  if (!endpoint || typeof endpoint !== "string") {
    throw new ApiError("Invalid API endpoint", 400);
  }

  try {
    if (!endpoint.startsWith("/")) {
      throw new ApiError(
        `Invalid API endpoint "${endpoint}". Endpoint must start with "/".`,
        400
      );
    }

    const url = joinApiUrl(API_BASE_URL, endpoint);
    const token = localStorage.getItem("printease_token");

    if (import.meta.env.DEV) {
      console.log("[API REQUEST]", {
        url,
        method: options.method || "GET",
        hasToken: Boolean(token),
      });
    }

    const response = await fetch(url, {
      ...options,
      headers: createHeaders(options),
    });

    let data = null;
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      data = await response.json().catch(() => ({
        message: "Invalid JSON response received from server",
      }));
    } else {
      const text = await response.text();
      data = { message: text || "Non-JSON response received from server" };
    }

    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.error("[API ERROR]", {
          url,
          status: response.status,
          message: data.message,
        });
      }

      throw new ApiError(
        data.message || `API request failed with status ${response.status}`,
        response.status,
        data
      );
    }

    if (import.meta.env.DEV) {
      console.log("[API SUCCESS]", {
        url,
        status: response.status,
      });
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (import.meta.env.DEV) {
      console.error("[API NETWORK ERROR]", {
        endpoint,
        baseUrl: API_BASE_URL,
        message: error.message,
      });
    }

    throw new ApiError(
      `Backend API is unreachable at ${API_BASE_URL}. Please check the backend server, CORS, and VITE_API_URL.`,
      0,
      error
    );
  }
}

export async function checkBackendHealth() {
  return apiRequest("/api/health");
}

export function getHubAgents() {
  return apiRequest("/api/hub-agents");
}

export function getHubAgentSummary() {
  return apiRequest("/api/hub-agents/summary");
}

export function updateHubLocation(payload) {
  return apiRequest("/api/centres/me/location", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function registerDesktopAgent(payload = {}) {
  return apiRequest("/api/hub-agents/desktop/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function pairAgent(pairingCode) {
  return apiRequest("/api/hub-agents/pair", {
    method: "POST",
    body: JSON.stringify({ pairingCode }),
  });
}

export function getPairingApprovalSession(sessionId) {
  return apiRequest(`/api/hub-agents/pair/session/${encodeURIComponent(sessionId)}`);
}

export function approveAgentPairing(pairingSessionId, approvalToken) {
  return apiRequest("/api/hub-agents/pair/approve", {
    method: "POST",
    body: JSON.stringify({ pairingSessionId, approvalToken }),
  });
}

export function rejectAgentPairing(pairingSessionId) {
  return apiRequest("/api/hub-agents/pair/reject", {
    method: "POST",
    body: JSON.stringify({ pairingSessionId }),
  });
}

export function pauseHubAgent(agentId) {
  return apiRequest(`/api/hub-agents/${agentId}/pause`, {
    method: "POST",
  });
}

export function resumeHubAgent(agentId) {
  return apiRequest(`/api/hub-agents/${agentId}/resume`, {
    method: "POST",
  });
}

export function revokeHubAgent(agentId) {
  return apiRequest(`/api/hub-agents/${agentId}/revoke`, {
    method: "POST",
  });
}

export function listHubPrintJobs() {
  return apiRequest("/api/hub-agents/print-jobs");
}



export function createManualPaymentRequest(printOrderId) {
  return apiRequest("/api/payments/manual-request", {
    method: "POST",
    body: JSON.stringify({ orderId: printOrderId }),
  });
}

export function collectManualPayment(orderId, { method = "cash", transactionNote = "", autoPrintAfterCollection = true } = {}) {
  return apiRequest(`/api/orders/${orderId}/collect-payment`, {
    method: "POST",
    body: JSON.stringify({ method, transactionNote, autoPrintAfterCollection }),
  });
}

export function sendOrderToAgent(orderId, target = {}) {
  return apiRequest(`/api/hub-agents/orders/${orderId}/send-to-agent`, {
    method: "POST",
    body: JSON.stringify({
      agentId: target.agentId,
      printerName: target.printerName,
    }),
  });
}

export function getOrderDocuments(orderId) {
  return apiRequest(`/api/orders/${encodeURIComponent(orderId)}/documents`);
}

export function getOrderStatus(orderId, { orderAccessToken } = {}) {
  return apiRequest(`/api/orders/${encodeURIComponent(orderId)}?_t=${Date.now()}`, {
    headers: orderAccessToken ? { "x-order-access-token": orderAccessToken } : {},
  });
}


export function reprintOrder(orderId, options = {}) {
  return apiRequest(`/api/orders/${encodeURIComponent(orderId)}/reprint`, {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export function getUserHistory({ force = false, userId = "me" } = {}) {
  return getPrivateCachedJson(
    `user-history:${userId}`,
    () => apiRequest("/api/user/history?compact=true&limit=20"),
    {
      ttlMs: 2 * 60 * 1000,
      force,
    }
  );
}

export function invalidateUserHistory(userId = "me") {
  invalidateCache(privateCacheKey(`user-history:${userId}`));
}

/**
 * Fetches full detail for a single order (lazy, on demand).
 * Cached per order ID for 5 minutes so repeat clicks don't re-fetch.
 */
export function getOrderDetail(orderId) {
  return getPrivateCachedJson(
    `order-detail:${orderId}`,
    () => apiRequest(`/api/user/history/${encodeURIComponent(orderId)}`).then((data) => data.order),
    { ttlMs: 5 * 60 * 1000 }
  );
}

export function invalidateOrderDetail(orderId) {
  invalidateCache(privateCacheKey(`order-detail:${orderId}`));
}

export function createDocumentSignedDownload(documentId, converted = false) {
  const query = converted ? "?converted=true" : "";
  return apiRequest(`/api/documents/${encodeURIComponent(documentId)}/signed-download${query}`, {
    method: "POST",
  });
}

const documentBlobCache = new Map();
let documentBlobIdentity = null;
const MAX_DOCUMENT_BLOB_CACHE_ENTRIES = 6;
const MAX_DOCUMENT_BLOB_CACHE_BYTES = 120 * 1024 * 1024;

function getDocumentBlobCacheBytes() {
  let total = 0;
  for (const blob of documentBlobCache.values()) {
    total += Number(blob?.size || 0);
  }
  return total;
}

function cacheDocumentBlob(cacheKey, blob) {
  if (documentBlobCache.has(cacheKey)) {
    documentBlobCache.delete(cacheKey);
  }

  documentBlobCache.set(cacheKey, blob);

  while (
    documentBlobCache.size > MAX_DOCUMENT_BLOB_CACHE_ENTRIES ||
    getDocumentBlobCacheBytes() > MAX_DOCUMENT_BLOB_CACHE_BYTES
  ) {
    const oldestKey = documentBlobCache.keys().next().value;
    if (!oldestKey || (oldestKey === cacheKey && documentBlobCache.size === 1)) break;
    documentBlobCache.delete(oldestKey);
  }
}

async function readMatchingDesktopPreview(documentId, document) {
  // Authorize via signed-download first, then reuse only bytes matching that
  // artifact's verified hash. A cached Office source/order render is not a
  // substitute for the converted PDF; never mutate the agent's cache here.
  if (!/^[a-f0-9]{64}$/i.test(document?.fileSha256 || '') || !globalThis.crypto?.subtle) return null;
  const cachedUrl = await getDesktopCachedDocumentUrl(documentId);
  if (!cachedUrl || !cachedUrl.startsWith('app://printease/cache/')) return null;
  try {
    const response = await fetch(cachedUrl);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return hash === document.fileSha256.toLowerCase()
      ? new Blob([bytes], { type: document.fileType || 'application/octet-stream' })
      : null;
  } catch {
    return null; // Cache misses/read failures fall back to the authorized link.
  }
}

async function fetchSignedDocumentBlob(documentId, converted = false, { preferDesktopCache = false } = {}) {
  // Private blobs cannot outlive their login/capability identity in memory.
  // Clear on identity change and reject an older request that finishes afterward.
  const identity = getPrivateIdentity();
  if (documentBlobIdentity !== identity) {
    documentBlobCache.clear();
    documentBlobIdentity = identity;
  }
  const cacheKey = String(documentId || "") + (converted ? "_converted" : "");
  if (documentBlobCache.has(cacheKey)) {
    return documentBlobCache.get(cacheKey);
  }

  const data = await createDocumentSignedDownload(documentId, converted);
  if (!data?.signedUrl) {
    throw new Error("Could not create secure document link.");
  }

  let blob = preferDesktopCache ? await readMatchingDesktopPreview(documentId, data.document) : null;
  if (!blob) {
    const response = await fetch(data.signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }
    blob = await response.blob();
  }
  const rawType = (blob.type || "").toLowerCase();
  const isGenericType = !rawType || rawType === "application/octet-stream";
  const bestType = isGenericType
    ? (data.document?.fileType || rawType || "application/octet-stream")
    : rawType;
  const typedBlob = bestType !== rawType
    ? new Blob([blob], { type: bestType })
    : blob;
  // A renamed Office response is not a PDF; reject it before caching/rendering.
  if (converted && !(await typedBlob.slice(0, 5).text()).startsWith("%PDF-")) {
    throw new Error("The converted printable PDF is not ready. Please retry after preparation finishes.");
  }
  assertPrivateIdentity(identity);
  if (documentBlobIdentity !== identity) throw new ApiError("Session changed. Open the document again.", 401);
  cacheDocumentBlob(cacheKey, typedBlob);
  return typedBlob;
}

export async function downloadDocumentBlob(documentId, converted = false) {
  return fetchSignedDocumentBlob(documentId, converted);
}

export async function getDesktopCachedDocumentUrl(documentId) {
  if (!window.printeaseDesktop?.getCachedDocumentUrl) return null;

  try {
    const result = await window.printeaseDesktop.getCachedDocumentUrl(documentId);
    return result?.success && result.url ? result.url : null;
  } catch {
    return null;
  }
}

export async function getDocumentPreviewBlob(documentId, converted = false) {
  return fetchSignedDocumentBlob(documentId, converted, { preferDesktopCache: true });
}

export async function getDocumentDownloadBlob(documentId, converted = false) {
  return downloadDocumentBlob(documentId, converted);
}

export function updateAfterOrderSettings(afterOrderSettings) {
  return apiRequest("/api/centres/me/after-order-settings", {
    method: "PATCH",
    body: JSON.stringify({ afterOrderSettings }),
  });
}
