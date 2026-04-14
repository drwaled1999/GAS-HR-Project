export const API_BASE =
  import.meta.env.VITE_API_URL || 'https://gas-hr-project.onrender.com';
export const getProtectedFileUrl = (filePath) => {
  return '${import.meta.env.VITE_API_URL}/files/${filePath}';
};

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let data = {};

  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    const message = data.message || 'Request failed';
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

export async function downloadFile(path, filename = 'file.xlsx') {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    let message = 'Download failed';
    try {
      const data = await response.json();
      message = data.message || message;
    } catch {}
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(url);
}
