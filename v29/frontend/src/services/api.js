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

export async function uploadAttendanceFile(file) {
  const body = new FormData();
  body.append("file", file);

  return apiFetch("/attendance/upload", {
    method: "POST",
    body,
  });
}

export async function getAttendance(params = {}) {
  const search = new URLSearchParams();

  if (params.month) search.set("month", params.month);
  if (params.year) search.set("year", params.year);
  if (params.gasId) search.set("gasId", params.gasId);

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch(`/attendance${suffix}`);
}