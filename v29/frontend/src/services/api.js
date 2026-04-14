export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

// ================== Helper ==================
function buildUrl(endpoint = "") {
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  return `${API_BASE}${normalizedEndpoint}`;
}

function getAuthToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

// ================== Core Fetch ==================
export async function apiFetch(endpoint, options = {}) {
  const url = buildUrl(endpoint);
  const isFormData = options.body instanceof FormData;
  const token = getAuthToken();

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

// ================== AUTH ==================
export async function login(payload) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  return apiFetch("/auth/logout", {
    method: "POST",
  });
}

// ================== USERS ==================
export async function getUsers() {
  return apiFetch("/users");
}

export async function updateUser(id, payload) {
  return apiFetch(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id) {
  return apiFetch(`/users/${id}`, {
    method: "DELETE",
  });
}

// ================== ATTENDANCE ==================
export async function uploadAttendanceFile(file, month, year) {
  const body = new FormData();
  body.append("file", file);
  body.append("month", month);
  body.append("year", year);

  return apiFetch("/attendance/upload", {
    method: "POST",
    body,
  });
}

export async function getAttendanceSheet(month, year) {
  return apiFetch(`/attendance/sheet?month=${month}&year=${year}`);
}

export async function approveAttendance(batchId, payload) {
  return apiFetch(`/attendance/approve/${batchId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ================== FILES ==================
export function getProtectedFileUrl(path) {
  if (!path) return "";
  return `${API_BASE}${path}`;
}