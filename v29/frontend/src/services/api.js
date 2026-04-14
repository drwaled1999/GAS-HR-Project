export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

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

// Auth
export async function getSession() {
  return apiFetch("/auth/session");
}

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

// Users
export async function getUsers(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch(`/users${suffix}`);
}

export async function updateUser(userId, payload) {
  return apiFetch(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(userId) {
  return apiFetch(`/users/${userId}`, {
    method: "DELETE",
  });
}

// Attendance
export async function uploadAttendanceFile(file, month, year, username = "") {
  const body = new FormData();
  body.append("file", file);
  body.append("month", String(month || ""));
  body.append("year", String(year || ""));
  body.append("username", username);

  return apiFetch("/attendance/upload", {
    method: "POST",
    body,
  });
}

export async function getAttendanceSheet(params = {}) {
  const search = new URLSearchParams();

  if (params.month) search.set("month", params.month);
  if (params.year) search.set("year", params.year);
  if (params.batchId) search.set("batchId", params.batchId);

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch(`/attendance/sheet${suffix}`);
}

export async function approveAttendanceBatch(batchId, payload) {
  return apiFetch(`/attendance/approve/${batchId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}