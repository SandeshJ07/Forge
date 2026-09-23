import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { clearStoredSession, saveSession } from '@/lib/tokenStorage';
import { useAuthStore, type Session } from '@/stores/useAuthStore';
import { useUnitStore } from '@/stores/useUnitStore';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
}

function toSession(data: TokenResponse): Session {
  return { userId: data.user_id, accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function signUp(email: string, password: string): Promise<void> {
  const data = await apiClient.post<TokenResponse>('/auth/sign-up', { email, password }, { skipAuth: true });
  const session = toSession(data);
  await saveSession(session);
  useAuthStore.getState().setSession(session);
}

export async function signIn(email: string, password: string): Promise<void> {
  const data = await apiClient.post<TokenResponse>('/auth/sign-in', { email, password }, { skipAuth: true });
  const session = toSession(data);
  await saveSession(session);
  useAuthStore.getState().setSession(session);
}

/**
 * The one true sign-out path. Only one account can be logged in per device
 * at a time, so switching accounts is just: fully tear down account A's
 * local state, then land back on sign-in for account B to log into. Every
 * call site (Settings sign-out, Settings "switch account") should go
 * through this rather than clearing the store directly, so nothing is left
 * half-cleared.
 */
export async function signOutAndReset(queryClient: QueryClient): Promise<void> {
  await clearStoredSession();
  useAuthStore.getState().setSession(null);
  queryClient.clear();
  useUnitStore.getState().setUnitSystem('metric');
}
