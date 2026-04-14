import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://gas-hr-project.onrender.com";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    ""
  );
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, ...extra }
    : { ...extra };
}

function normalizeError(error, fallback = "Request failed") {
  if (error?.response?.data?.message) {
    return new Error(error.response.data.message);
  }
  if (error?.response?.data?.error) {
    return new Error(error.response.data.error);
  }
  return new Error(error?.message || fallback);
}

export async function uploadAttendanceFile(file, month, year, username) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("month", String(month));
    formData.append("year", String(year));
    formData.append("username", String(username || "system"));

    const response = await api.post("/attendance/upload", formData, {
      headers: authHeaders({ "Content-Type": "multipart/form-data" }),
      timeout: 120000,
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Upload failed");
  }
}

export async function getAttendanceSheet({ month, year, batchId }) {
  try {
    const params = { month, year };
    if (batchId) params.batchId = batchId;

    const response = await api.get("/attendance/sheet", {
      params,
      headers: authHeaders(),
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Sheet failed");
  }
}

export async function updateAttendanceImportRow(rowId, payload) {
  try {
    const response = await api.patch(`/attendance/row/${rowId}`, payload, {
      headers: authHeaders({ "Content-Type": "application/json" }),
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Update row failed");
  }
}

export async function approveAttendanceBatch(batchId, payload) {
  try {
    const response = await api.post(`/attendance/approve/${batchId}`, payload, {
      headers: authHeaders({ "Content-Type": "application/json" }),
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Approve failed");
  }
}

export { api };