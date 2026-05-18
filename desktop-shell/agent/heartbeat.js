const DEFAULT_BACKEND_URL = "https://printease-backend-byex.onrender.com";
const AGENT_VERSION = "0.1.0";

function createHeartbeatPayload(device = {}) {
  return {
    platform: process.platform,
    status: device.status || "online",
    paused: Boolean(device.paused),
    version: device.version || AGENT_VERSION,
    deviceName: device.deviceName || "PrintEase Desktop",
  };
}

function cleanBackendUrl() {
  return DEFAULT_BACKEND_URL;
}

function createHeaders(agentToken) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (agentToken) {
    headers.Authorization = `Bearer ${agentToken}`;
  }

  return headers;
}

async function backendRequest({ endpoint, method = "GET", agentToken, body }) {
  const response = await fetch(`${cleanBackendUrl()}${endpoint}`, {
    method,
    headers: createHeaders(agentToken),
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Backend request failed with status ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function startPairing({ deviceId, agentName = "PrintEase Desktop", platform = process.platform, version = AGENT_VERSION } = {}) {
  return backendRequest({
    endpoint: "/api/agents/pair/start",
    method: "POST",
    body: {
      deviceId,
      agentName,
      platform,
      version,
    },
  });
}

async function confirmPairing({ pairingSessionId, deviceId } = {}) {
  return backendRequest({
    endpoint: "/api/agents/pair/confirm",
    method: "POST",
    body: {
      pairingSessionId,
      deviceId,
    },
  });
}

async function sendHeartbeat({ agentToken, device = {} } = {}) {
  if (!agentToken) {
    return {
      success: false,
      error: "Agent token is required before sending heartbeat.",
    };
  }

  try {
    return await backendRequest({
      endpoint: "/api/agents/heartbeat",
      method: "POST",
      agentToken,
      body: createHeartbeatPayload(device),
    });
  } catch (error) {
    return {
      success: false,
      error: error.message || "Could not send heartbeat.",
      status: error.status || 0,
    };
  }
}

module.exports = {
  backendRequest,
  confirmPairing,
  createHeartbeatPayload,
  sendHeartbeat,
  startPairing,
};
