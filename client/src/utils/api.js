const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

/**
 * Fetch wrapper with JWT authentication token injection
 */
export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('wasel_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: 'فشل في قراءة استجابة الخادم.',
  }));

  if (!response.ok) {
    // If unauthorized or token expired, optionally clear token
    if (response.status === 401 || response.status === 403) {
      if (data.message && data.message.includes('رمز الدخول')) {
        localStorage.removeItem('wasel_token');
        localStorage.removeItem('wasel_user');
      }
    }
    const err = new Error(data.message || 'حدث خطأ في الاتصال بالخادم');
    err.data = data;
    err.status = response.status;
    throw err;
  }

  return data;
}

export const api = {
  get: (url) => apiFetch(url, { method: 'GET' }),
  post: (url, body) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiFetch(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (url, body) => apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url) => apiFetch(url, { method: 'DELETE' }),
};
