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

export function getProtectedFileUrl(filePath) {
  if (!filePath) return "";

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  return `${API_BASE}${filePath}`;
}

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

export default api;
