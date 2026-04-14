import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
  },
});

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

/**
 * مهم:
 * هذه الدالة مطلوبة لأن AuthContext.jsx يستوردها مباشرة
 */
export async function apiFetch(url, options = {}) {
  try {
    const method = options.method || "GET";
    const headers = buildAuthHeaders(options.headers || {});
    const data = options.body;

    const response = await api.request({
      url,
      method,
      headers,
      data,
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/* =========================
   AUTH
========================= */

export async function loginUser(payload) {
  try {
    const response = await api.post("/auth/login", payload);
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

export async function getUserById(id) {
  try {
    const response = await api.get(`/users/${id}`, {
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
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to create user");
  }
}

export async function updateUser(id, payload) {
  try {
    const response = await api.put(`/users/${id}`, payload, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update user");
  }
}

export async function deleteUser(id) {
  try {
    const response = await api.delete(`/users/${id}`, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to delete user");
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
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to create project");
  }
}

export async function updateProject(projectId, payload) {
  try {
    const response = await api.put(`/projects/${projectId}`, payload, {
      headers: buildAuthHeaders(),
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

export async function createPackage(payload) {
  try {
    const response = await api.post("/projects/packages", payload, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to create package");
  }
}

export async function updatePackage(packageId, payload) {
  try {
    const response = await api.put(`/projects/packages/${packageId}`, payload, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update package");
  }
}

export async function deletePackage(packageId) {
  try {
    const response = await api.delete(`/projects/packages/${packageId}`, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to delete package");
  }
}

/* =========================
   DASHBOARD
========================= */

export async function getDashboardSummary(username) {
  try {
    const response = await api.get("/dashboard/summary", {
      headers: buildAuthHeaders(),
      params: { username },
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load dashboard summary");
  }
}

/* =========================
   ATTENDANCE
========================= */

export async function uploadAttendanceFile(file, month, year, username) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("month", String(month));
    formData.append("year", String(year));
    formData.append("username", String(username || "system"));

    const response = await api.post("/attendance/upload", formData, {
      headers: buildAuthHeaders({
        "Content-Type": "multipart/form-data",
      }),
      timeout: 120000,
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to upload attendance file");
  }
}

export async function getAttendanceSheet({ month, year, batchId }) {
  try {
    const params = {
      month,
      year,
    };

    if (batchId) {
      params.batchId = batchId;
    }

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
    const response = await api.post(
      `/attendance/row/${rowId}/override`,
      payload,
      {
        headers: buildAuthHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update attendance row");
  }
}

export async function approveAttendanceBatch(batchId, payload) {
  try {
    const response = await api.post(
      `/attendance/approve/${batchId}`,
      payload,
      {
        headers: buildAuthHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to approve attendance batch");
  }
}

export default api;

export function getProtectedFileUrl(filePath) {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    "";

  if (!filePath) return "";

  return `${API_BASE}${filePath}?token=${token}`;
}



