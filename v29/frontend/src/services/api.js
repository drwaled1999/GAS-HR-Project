const API_BASE_URL =
  (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

function buildUrl(endpoint = "") {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

export async function apiFetch(endpoint, options = {}) {
  const url = buildUrl(endpoint);

  const config = {
    method: options.method || "GET",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    credentials: "include",
    ...options,
  };

  const response = await fetch(url, config);

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

export function getProtectedFileUrl(filePath = "") {
  if (!filePath) return "";
  const cleanPath = String(filePath).replace(/^\/+/, "");
  return `${API_BASE_URL}/files/${cleanPath}`;
}

export async function getSession() {
  return apiFetch("/auth/session");
}

export async function updateUser(userId, payload) {
  return apiFetch(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getUsers() {
  return apiFetch("/users");
}

export async function getUserById(userId) {
  return apiFetch(`/users/${userId}`);
}