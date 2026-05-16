const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export default API_BASE_URL;

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API request failed");
  }

  return data;
}

export async function checkBackendHealth() {
  return apiRequest("/api/health");
}