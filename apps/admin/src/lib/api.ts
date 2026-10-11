const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/admin';

// /api/admin/* responses are raw (not the {success,data} envelope
// SAAS/frontend's business routes use) -- this is a brand-new app with no
// existing frontend contract to match, so it follows this backend's other
// un-enveloped routes (e.g. /api/intent-requests) instead.
export class ApiError extends Error {}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit & { data?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem('adminAccessToken');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.data && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    body: options.data ? JSON.stringify(options.data) : options.body,
  });

  if (response.status === 401) {
    localStorage.removeItem('adminAccessToken');
    localStorage.removeItem('adminUser');
    window.location.href = '/login';
    throw new ApiError('Session expired');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error?.message || data?.error || `Request failed (${response.status})`);
  }
  return data as T;
}
