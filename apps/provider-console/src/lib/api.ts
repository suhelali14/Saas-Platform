const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4200/api/provider';

// provider-api returns raw JSON, not an envelope.
export class ApiError extends Error {}

/**
 * Mutations currently in flight, keyed by method + endpoint + body.
 *
 * Spamming a button fired one request per click: three taps on "Dispense"
 * decremented stock three times, three taps on "Add item" put three lines
 * on a bill. Disabling the button in each component is the obvious fix, but
 * it has to be remembered at 56 call sites and at every one written later —
 * and one forgotten spot is a duplicated clinical record.
 *
 * So the guard lives here instead. An identical mutation that is already in
 * flight returns the *same* promise rather than issuing a second request,
 * which protects every call site at once, including ones that predate this
 * comment and ones nobody has written yet.
 *
 * Deliberate limits:
 *  - **Mutations only.** A repeated GET is harmless, and collapsing those
 *    would serve stale data from a "refresh" button.
 *  - **Only while in flight.** Nothing is cached; the entry is dropped the
 *    moment the request settles, so a deliberate second save a second later
 *    goes through normally.
 *  - **Body is part of the key.** Adding two *different* line items in
 *    quick succession is two distinct requests and both proceed.
 *
 * The one thing this collapses that might be wanted: adding two *identical*
 * items by double-clicking inside the same second. For a clinic that is the
 * bug, not the feature.
 */
const inFlight = new Map<string, Promise<unknown>>();

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function apiFetch<T = any>(endpoint: string, options: RequestInit & { data?: unknown } = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();

  if (MUTATING.has(method)) {
    const key = `${method} ${endpoint} ${options.data ? JSON.stringify(options.data) : ''}`;
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const request = performFetch<T>(endpoint, options).finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
  }

  return performFetch<T>(endpoint, options);
}

async function performFetch<T>(endpoint: string, options: RequestInit & { data?: unknown }): Promise<T> {
  const token = localStorage.getItem('providerAccessToken');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.data && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    body: options.data ? JSON.stringify(options.data) : options.body,
  });

  if (response.status === 401) {
    localStorage.removeItem('providerAccessToken');
    window.location.href = '/login';
    throw new ApiError('Session expired');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error?.message || data?.error || `Request failed (${response.status})`);
  }
  return data as T;
}

/**
 * Uploads a file. Kept separate from `apiFetch` because a FormData body
 * cannot be JSON-stringified for the dedupe key, and because the browser
 * must set its own multipart Content-Type boundary.
 *
 * Deduped by endpoint and file identity: the same file to the same endpoint
 * twice in flight is a double-click, not two uploads.
 */
export async function apiUpload<T = any>(endpoint: string, file: File, fields?: Record<string, string>): Promise<T> {
  const key = `UPLOAD ${endpoint} ${file.name} ${file.size} ${file.lastModified}`;
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const request = (async () => {
    const token = localStorage.getItem('providerAccessToken');
    const body = new FormData();
    // Text fields before the file: @fastify/multipart streams parts in
    // order, and a field after the file is not parsed by the time the
    // handler reads it.
    for (const [k, v] of Object.entries(fields ?? {})) body.append(k, v);
    body.append('file', file);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(data?.error || `Upload failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  return request;
}
