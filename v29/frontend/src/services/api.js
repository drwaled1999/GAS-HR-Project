export const API_BASE = 'http://localhost:4000';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || 'حدث خطأ في الطلب';
    throw new Error(message);
  }
  return data;
}

function getAccessToken() {
  const raw = localStorage.getItem('hr_portal_auth');
  if (!raw) return null;
  try {
    return JSON.parse(raw).accessToken;
  } catch {
    return null;
  }
}

export function getProtectedFileUrl(path) {
  const token = getAccessToken();
  if (!token) return `${API_BASE}${path}`;
  const separator = path.includes('?') ? '&' : '?';
  return `${API_BASE}${path}${separator}access_token=${encodeURIComponent(token)}`;
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const token = getAccessToken();
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  return parseResponse(response);
}
