import axios from "axios";

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "https://gas-hr-project.onrender.com").trim();

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 120000,
});

// =======================
// 🔐 TOKEN
// =======================
function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function buildAuthHeaders(extraHeaders = {}) {
  const token = getToken();

  if (!token) return { ...extraHeaders };

  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
}

// =======================
// ⚠️ ERROR HANDLER
// =======================
function normalizeError(error, fallbackMessage = "Request failed") {
  console.error("API ERROR:", error);

  if (error?.response?.data?.message) {
    return new Error(error.response.data.message);
  }

  if (error?.response?.data?.error) {
    return new Error(error.response.data.error);
  }

  if (error?.message) {
    return new Error(error.message);
  }

  return new Error(fallbackMessage);
}

// =======================
// 🚀 MAIN FETCH
// =======================
export async function apiFetch(url, options = {}) {
  try {
    const method = options.method || "GET";

    const headers = buildAuthHeaders({
      ...(options.headers || {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    });

    const response = await api.request({
      url,
      method,
      headers,
      params: options.params || {},
      data: options.body ? JSON.parse(JSON.stringify(options.body)) : undefined,
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

// =======================
// 🔐 AUTH
// =======================
export async function loginUser(payload) {
  try {
    const response = await api.post("/auth/login", payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Login failed");
  }
}

export async function getSession() {
  try {
    const response = await api.get("/auth/session", {
      headers: buildAuthHeaders(),
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load session");
  }
}

// =======================
// 📂 FILE URL
// =======================
export function getProtectedFileUrl(filePath) {
  const token = getToken();

  if (!filePath) return "";

  if (filePath.startsWith("http")) {
    return filePath;
  }

  return `${API_BASE}${filePath}?token=${token}`;
}

// =======================
// 👤 USERS
// =======================
export async function getUsers() {
  return apiFetch("/users");
}

export async function getUserById(userId) {
  return apiFetch(`/users/${userId}`);
}

export async function createUser(payload) {
  return apiFetch("/users", {
    method: "POST",
    body: payload,
  });
}

export async function updateUser(userId, payload) {
  return apiFetch(`/users/${userId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function saveUserPermissions(userId, permissions) {
  return apiFetch(`/users/${userId}/permissions`, {
    method: "POST",
    body: { permissions },
  });
}

export async function deleteUser(userId) {
  return apiFetch(`/users/${userId}`, {
    method: "DELETE",
  });
}

// =======================
// 🟢 ATTENDANCE
// =======================
export async function uploadAttendanceFile(file, month, year, username) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("month", String(month));
    formData.append("year", String(year));
    formData.append("username", String(username || "system"));

    const response = await api.post("/attendance/upload", formData, {
      headers: buildAuthHeaders(),
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to upload attendance CSV");
  }
}

export async function getAttendanceSheet(params) {
  return apiFetch("/attendance/sheet", {
    params,
  });
}

export async function updateAttendanceImportRow(rowId, payload) {
  return apiFetch(`/attendance/row/${rowId}/override`, {
    method: "POST",
    body: payload,
  });
}

export async function approveAttendanceBatch(batchId, payload) {
  return apiFetch(`/attendance/approve/${batchId}`, {
    method: "POST",
    body: payload,
  });
}

export async function getAttendanceIssues(month, year) {
  return apiFetch(`/attendance/issues`, {
    params: { month, year },
  });
}

export async function directUpdateAttendance(payload) {
  return apiFetch(`/attendance/direct-update`, {
    method: "POST",
    body: payload,
  });
}