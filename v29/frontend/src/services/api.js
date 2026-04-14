import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://gas-hr-project.onrender.com";

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

export async function apiFetch(url, options = {}) {
  try {
    const method = options.method || "GET";
    const headers = buildAuthHeaders(options.headers || {});
    const data = options.body;
    const params = options.params;

    const response = await api.request({
      url,
      method,
      headers,
      data,
      params,
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

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

export async function updateUser(userId, payload) {
  try {
    const response = await api.put(`/users/${userId}`, payload, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update user");
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
