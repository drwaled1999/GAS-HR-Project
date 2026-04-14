const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

function buildUrl(endpoint = '') {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
}

export async function apiFetch(endpoint, options = {}) {
  const url = buildUrl(endpoint);

  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    credentials: 'include',
    body: options.body,
  });

  const contentType = response.headers.get('content-type') || '';

  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof data === 'string'
        ? data
        : data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function getProtectedFileUrl(path = '') {
  if (!path) return '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function getSession() {
  return apiFetch('/auth/session');
}