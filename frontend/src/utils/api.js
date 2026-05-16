const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const apiBaseUrls = [
  configuredApiBaseUrl,
  "http://localhost:5000/api",
  "http://localhost:5001/api",
].filter((url, index, urls) => url && urls.indexOf(url) === index);

function createHeaders(options) {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = localStorage.getItem("printease_token");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

export async function apiRequest(path, options = {}) {
  let lastNetworkError;

  for (const [index, baseUrl] of apiBaseUrls.entries()) {
    let response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: createHeaders(options),
      });
    } catch (error) {
      lastNetworkError = error;
      continue;
    }

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await response.json().catch(() => ({})) : {};

    if (!response.ok) {
      if (!data.message && index < apiBaseUrls.length - 1) continue;
      throw new Error(data.message || "Request failed. Please try again.");
    }

    return data;
  }

  throw new Error(
    `Cannot reach backend API. Tried ${apiBaseUrls.join(", ")}. ${lastNetworkError?.message || ""}`.trim()
  );
}
