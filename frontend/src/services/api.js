const DEFAULT_API_BASE_URL = "https://printease-backend-byex.onrender.com";
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE_URL = (configuredApiUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

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
      `Backend API is unreachable at ${API_BASE_URL}. Please check Render backend, CORS, Vercel VITE_API_URL, and deployment status.`,
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

export function pairAgent(pairingCode) {
  return apiRequest("/api/hub-agents/pair", {
    method: "POST",
    body: JSON.stringify({ pairingCode }),
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

export function sendOrderToAgent(orderId, target = {}) {
  return apiRequest(`/api/hub-agents/orders/${orderId}/send-to-agent`, {
    method: "POST",
    body: JSON.stringify({
      agentId: target.agentId,
      printerName: target.printerName,
    }),
  });
}
