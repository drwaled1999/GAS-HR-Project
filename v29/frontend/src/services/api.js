import axios from "axios";

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "https://gas-hr-project.onrender.com").trim();

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
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

export async function apiFetch(url, options = {}) {
  try {
    const method = options.method || "GET";
    const isFormData = options.body instanceof FormData;

    const headers = buildAuthHeaders({
      ...(options.headers || {}),
      ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}),
    });

    const response = await api.request({
      url,
      method,
      headers,
      params: options.params || {},
      data: options.body || undefined,
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
  const token = getToken();

  if (!filePath) return "";

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  return `${API_BASE}${filePath}${filePath.includes("?") ? "&" : "?"}token=${token}`;
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

export async function uploadAttendanceFile(file, month, year, username) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("month", String(month));
    formData.append("year", String(year));
    formData.append("username", String(username || "system"));

    const response = await api.post("/attendance/upload", formData, {
      headers: buildAuthHeaders(),
      timeout: 120000,
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to upload attendance CSV");
  }
}

export async function getAttendanceSheet({
  month,
  year,
  batchId,
  employeeCode,
  employeeName,
  employeeView,
}) {
  try {
    const params = {};

    if (month !== undefined && month !== null && month !== "") {
      params.month = month;
    }

    if (year !== undefined && year !== null && year !== "") {
      params.year = year;
    }

    if (batchId) {
      params.batchId = batchId;
    }

    if (employeeCode) {
      params.employeeCode = employeeCode;
    }

    if (employeeName) {
      params.employeeName = employeeName;
    }

    if (employeeView !== undefined) {
      params.employeeView = employeeView;
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
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
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

export async function getAvailableAttendanceUsers(batchId, search = "") {
  try {
    const response = await api.get(`/attendance/sheet/${batchId}/available-users`, {
      headers: buildAuthHeaders(),
      params: { search },
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load available users");
  }
}

export async function addUserToAttendanceSheet(batchId, payload) {
  try {
    const response = await api.post(
      `/attendance/sheet/${batchId}/add-user`,
      payload,
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to add user to attendance sheet");
  }
}

export async function excludeUserFromAttendanceSheet(batchId, payload) {
  try {
    const response = await api.post(
      `/attendance/sheet/${batchId}/exclude-user`,
      payload,
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to exclude user from attendance sheet");
  }
}

export async function includeUserBackToAttendanceSheet(batchId, payload) {
  try {
    const response = await api.post(
      `/attendance/sheet/${batchId}/include-user`,
      payload,
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to include user back to attendance sheet");
  }
}

export async function markAttendanceUserStatus(payload) {
  try {
    const response = await api.post(
      `/attendance/sheet/mark-user-status`,
      payload,
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update employee status");
  }
}

export async function directUpdateAttendance(payload) {
  try {
    const response = await api.post(
      `/attendance/direct-update`,
      payload,
      {
        headers: buildAuthHeaders({
          "Content-Type": "application/json",
        }),
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update attendance directly");
  }
}

export async function getManagedLeaveBalance(employeeId) {
  try {
    const response = await api.get(`/requests-center/balances/manage`, {
      headers: buildAuthHeaders(),
      params: { employeeId },
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load employee leave balance");
  }
}

export async function updateManagedLeaveBalance(payload) {
  try {
    const response = await api.put(`/requests-center/balances/manage`, payload, {
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update employee leave balance");
  }
}

export default api;
