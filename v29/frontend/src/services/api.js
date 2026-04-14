export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

function buildUrl(endpoint = "") {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE}${normalizedEndpoint}`;
}

export async function apiFetch(endpoint, options = {}) {
  const url = buildUrl(endpoint);
  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    credentials: "include",
    body: options.body,
  });

  const contentType = response.headers.get("content-type") || "";

  let data;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof data === "string"
        ? data
        : data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function getProtectedFileUrl(path = "") {
  if (!path) return "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export async function getSession() {
  return apiFetch("/auth/session");
}

export async function downloadFile(endpoint, filename = "download") {
  const url = buildUrl(endpoint);

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(downloadUrl);
}

export async function getUsers(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch(`/users${suffix}`);
}

export async function getUserById(userId) {
  return apiFetch(`/users/${userId}`);
}

export async function updateUser(userId, payload) {
  return apiFetch(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}