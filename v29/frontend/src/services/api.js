export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

function buildUrl(endpoint = "") {
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  return `${API_BASE}${normalizedEndpoint}`;
}
// ✅ رفع ملف البصمة
export async function uploadAttendanceFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch("/attendance/upload", {
    method: "POST",
    body: formData,
  });
}

// ✅ جلب الحضور
export async function getAttendance(params = {}) {
  const search = new URLSearchParams();

  if (params.month) search.set("month", params.month);
  if (params.year) search.set("year", params.year);

  const query = search.toString();
  const url = query ? `/attendance?${query}` : "/attendance";

  return apiFetch(url);
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

/**
 * يبني رابط كامل لملف محمي أو صورة أو PDF
 * أمثلة:
 * getProtectedFileUrl("/files/request/123")
 * getProtectedFileUrl("uploads/a.pdf")
 */
export function getProtectedFileUrl(path = "") {
  if (!path) return "";

  const normalizedPath = String(path).startsWith("/")
    ? String(path)
    : `/${String(path)}`;

  return `${API_BASE}${normalizedPath}`;
}

/**
 * تنزيل ملف من السيرفر
 * مثال:
 * await downloadFile(`/files/request/${id}`, "request.pdf");
 */
export async function downloadFile(endpoint, filename = "download") {
  const url = buildUrl(endpoint);
  const token = getAuthToken();

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(objectUrl);
}

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

export async function getUsers(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch(`/users${suffix}`);
}

export async function getUserById(userId) {
  return apiFetch(`/users/${userId}`);
}

export async function createUser(payload) {
  return apiFetch("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

export async function getProjects() {
  return apiFetch("/projects");
}

export async function createProject(payload) {
  return apiFetch("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProject(projectId, payload) {
  return apiFetch(`/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(projectId) {
  return apiFetch(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function createPackage(payload) {
  return apiFetch("/projects/packages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePackage(packageId, payload) {
  return apiFetch(`/projects/packages/${packageId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deletePackage(packageId) {
  return apiFetch(`/projects/packages/${packageId}`, {
    method: "DELETE",
  });
}