const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function checkBackendHealth() {
  const response = await fetch(`${API_URL}/api/health`);
  return response.json();
}

export default API_URL;
