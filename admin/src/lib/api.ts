const API_BASE_URL = 'https://hariharapura-temple-api.onrender.com/api';

export function getAdminToken() {
  return localStorage.getItem('temple_admin_token');
}

export function clearAdminSession() {
  localStorage.removeItem('temple_admin_token');
  localStorage.removeItem('temple_admin_user');
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();

  const headers = new Headers(options.headers);

  /*
   * IMPORTANT:
   * When body is FormData, do NOT manually set
   * Content-Type. The browser will automatically
   * set multipart/form-data with the correct boundary.
   */
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set(
      'Authorization',
      `Bearer ${token}`
    );
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message || 'Request failed'
    );
  }

  return data as T;
}