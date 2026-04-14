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

  if (!token) return { ...extraHeaders };

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

// ✅ Attendance Upload
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

// ✅ Get Sheet
export async function getAttendanceSheet(params) {
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

export default api;
