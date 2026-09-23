import { useAuthStore } from '@/stores/useAuthStore';
import { clearStoredSession, saveSession } from '@/lib/tokenStorage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error('Missing EXPO_PUBLIC_API_URL. Copy .env.example to .env and point it at your backend.');
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Refreshes the access token using the stored refresh token. Deduplicated
 * via refreshPromise so concurrent 401s from several in-flight requests
 * only trigger one refresh call, not one per request.
 */
async function refreshAccessToken(): Promise<boolean> {
  const session = useAuthStore.getState().session;
  if (!session) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refreshToken }),
        });
        if (!res.ok) return false;

        const data = await res.json();
        const newSession = { userId: data.user_id, accessToken: data.access_token, refreshToken: data.refresh_token };
        await saveSession(newSession);
        useAuthStore.getState().setSession(newSession);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Set true for multipart/form-data uploads — body is passed through as FormData, no JSON stringify/Content-Type. */
  isFormData?: boolean;
  /** Skip attaching Authorization — only auth/sign-up and auth/sign-in need this. */
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = 'GET', body, isFormData = false, skipAuth = false } = options;
  const session = useAuthStore.getState().session;

  const headers: Record<string, string> = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (!skipAuth && session) headers.Authorization = `Bearer ${session.accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (res.status === 401 && !skipAuth && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, options, true);

    await clearStoredSession();
    useAuthStore.getState().setSession(null);
    throw new ApiError(401, 'Session expired');
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = typeof data === 'object' && data !== null && 'detail' in data ? String(data.detail) : String(data);
    throw new ApiError(res.status, message);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Partial<RequestOptions>) =>
    request<T>(path, { method: 'POST', body, ...options }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export function apiFileUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
