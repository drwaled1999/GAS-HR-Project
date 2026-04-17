import axios from "axios";

function normalizeBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function resolveApiBase() {
  const fromWindow =
    typeof window !== "undefined" ? window.__API_BASE_URL__ : "";
  const fromEnv = import.meta?.env?.VITE_API_BASE_URL || "";

  return (
    normalizeBase(fromWindow) ||
    normalizeBase(fromEnv) ||
    "https://gas-hr-project-1.onrender.com"
  );
}

export const API_BASE = resolveApiBase();

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 30000,
});

function getToken() {
  const possibleKeys = [
    "token",
    "authToken",
    "accessToken",
    "hr_portal_auth",
    "employee_portal_auth",
    "auth",
    "user_auth",
    "portal_auth",
  ];

  for (const key of possibleKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    if (["token", "authToken", "accessToken"].includes(key)) {
      return raw;
    }

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string" && parsed.trim()) return parsed;
      if (parsed?.token) return parsed.token;
      if (parsed?.accessToken) return parsed.accessToken;
      if (parsed?.authToken) return parsed.authToken;
      if (parsed?.jwt) return parsed.jwt;
    } catch {
      if (raw.trim()) return raw;
    }
  }

  return "";
}

function buildAuthHeaders(extraHeaders = {}) {
  const token = getToken();

  if (!token) {
    return { ...extraHeaders };
  }

  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
}

function normalizeError(error, fallbackMessage = "Request failed") {
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

export async function apiFetch(url, options = {}) {
  try {
    const method = options.method || "GET";
    const headers = buildAuthHeaders(options.headers || {});
    const params = options.params;
    const data = options.body;

    const response = await api.request({
      url,
      method,
      headers,
      params,
      data,
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export function getProtectedFileUrl(filePath) {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  return `${API_BASE}${filePath}`;
}

/* =========================
   AUTH
========================= */

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

/* =========================
   USERS
========================= */

export async function getUsers() {
  try {
    const response = await api.get("/users", {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load users");
  }
}

export async function getUserById(userId) {
  try {
    const response = await api.get(`/users/${userId}`, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load user");
  }
}

export async function createUser(payload) {
  try {
    const response = await api.post("/users", payload, {
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to create user");
  }
}

export async function updateUser(userId, payload) {
  try {
    const response = await api.put(`/users/${userId}`, payload, {
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update user");
  }
}

export async function saveUserPermissions(userId, permissions) {
  try {
    const response = await api.post(
      `/users/${userId}/permissions`,
      { permissions },
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to save permissions");
  }
}

export async function deleteUser(userId) {
  try {
    const response = await api.delete(`/users/${userId}`, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to delete user");
  }
}

/* =========================
   DASHBOARD
========================= */

export async function getDashboardSummary() {
  try {
    const response = await api.get("/dashboard/summary", {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load dashboard summary");
  }
}

/* =========================
   PROJECTS
========================= */

export async function getProjects() {
  try {
    const response = await api.get("/projects", {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load projects");
  }
}

export async function createProject(payload) {
  try {
    const response = await api.post("/projects", payload, {
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to create project");
  }
}

export async function updateProject(projectId, payload) {
  try {
    const response = await api.put(`/projects/${projectId}`, payload, {
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update project");
  }
}

export async function deleteProject(projectId) {
  try {
    const response = await api.delete(`/projects/${projectId}`, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to delete project");
  }
}

/* =========================
   ATTENDANCE
========================= */

export async function uploadAttendanceFile(formData) {
  try {
    const response = await api.post("/attendance/upload", formData, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to upload attendance file");
  }
}

export async function getAttendanceSheet(params = {}) {
  try {
    const response = await api.get("/attendance/sheet", {
      headers: buildAuthHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load attendance sheet");
  }
}

export async function updateAttendanceImportRow(rowId, payload) {
  try {
    const response = await api.put(`/attendance/import-row/${rowId}`, payload, {
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update attendance row");
  }
}

export async function approveAttendanceBatch(batchId, payload = {}) {
  try {
    const response = await api.post(
      `/attendance/batches/${batchId}/approve`,
      payload,
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to approve attendance batch");
  }
}

export async function getAttendanceIssues(params = {}) {
  try {
    const response = await api.get("/attendance/issues", {
      headers: buildAuthHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load attendance issues");
  }
}

export async function createAttendanceAdjustment(payload) {
  try {
    const response = await api.post("/attendance/adjustments", payload, {
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to create attendance adjustment");
  }
}

export async function reviewAttendanceAdjustment(adjustmentId, payload) {
  try {
    const response = await api.post(
      `/attendance/adjustments/${adjustmentId}/review`,
      payload,
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to review attendance adjustment");
  }
}

export async function exportAttendanceSheet(params = {}) {
  try {
    const response = await api.get("/attendance/export", {
      headers: buildAuthHeaders(),
      params,
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to export attendance");
  }
}

/* =========================
   REQUESTS
========================= */

export async function getRequestTypes() {
  try {
    const response = await api.get("/requests-center/types", {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load request types");
  }
}

export async function getRequestsList(params = {}) {
  try {
    const response = await api.get("/requests-center/list", {
      headers: buildAuthHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load requests");
  }
}

export async function getRequestBalances(params = {}) {
  try {
    const response = await api.get("/requests-center/balances", {
      headers: buildAuthHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load balances");
  }
}

export async function createRequest(formData) {
  try {
    const response = await api.post("/requests-center/leave", formData, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to create request");
  }
}

export async function reviewRequest(requestId, formData) {
  try {
    const response = await api.post(
      `/requests-center/leave/${requestId}/review`,
      formData,
      {
        headers: buildAuthHeaders(),
      }
    );
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to review request");
  }
}

export async function getManagedLeaveBalance(params = {}) {
  try {
    const response = await api.get("/requests-center/balances/manage", {
      headers: buildAuthHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load managed leave balance");
  }
}

export async function updateManagedLeaveBalance(payload = {}) {
  try {
    const response = await api.put("/requests-center/balances/manage", payload, {
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update managed leave balance");
  }
}

/* =========================
   NOTIFICATIONS
========================= */

export async function getNotifications() {
  try {
    const response = await api.get("/notifications", {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load notifications");
  }
}

export async function getUnreadNotificationsCount() {
  try {
    const response = await api.get("/notifications/unread-count", {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load unread notifications count");
  }
}

export async function markNotificationRead(notificationId) {
  try {
    const response = await api.post(
      `/notifications/${notificationId}/read`,
      {},
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to mark notification as read");
  }
}

export async function markAllNotificationsRead() {
  try {
    const response = await api.post(
      "/notifications/read-all",
      {},
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to mark all notifications as read");
  }
}

/* =========================
   PAYROLL
========================= */

export async function getPayrollSummary(params = {}) {
  try {
    const response = await api.get("/payroll/summary", {
      headers: buildAuthHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load payroll summary");
  }
}

export async function getPayslips(params = {}) {
  try {
    const response = await api.get("/payroll/payslips", {
      headers: buildAuthHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load payslips");
  }
}

/* =========================
   REPORTS
========================= */

export async function getReports(params = {}) {
  try {
    const response = await api.get("/reports", {
      headers: buildAuthHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load reports");
  }
}

/* =========================
   SECURITY
========================= */

export async function getSecurityOverview() {
  try {
    const response = await api.get("/security", {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load security overview");
  }
}

/* =========================
   SETTINGS
========================= */

export async function getSettings() {
  try {
    const response = await api.get("/settings", {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load settings");
  }
}

export async function updateSettings(payload) {
  try {
    const response = await api.put("/settings", payload, {
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update settings");
  }
}

export default api;
