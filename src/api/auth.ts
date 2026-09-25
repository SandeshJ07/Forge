import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { clearStoredSession, saveSession } from '@/lib/tokenStorage';
import { useAuthStore, type Session } from '@/stores/useAuthStore';
import { useUnitStore } from '@/stores/useUnitStore';
import { useWorkoutSessionStore } from '@/stores/useWorkoutSessionStore';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
  username: string;
}

function toSession(data: TokenResponse): Session {
  return { userId: data.user_id, username: data.username, accessToken: data.access_token, refreshToken: data.refresh_token };
}

async function applySession(data: TokenResponse): Promise<void> {
  const session = toSession(data);
  await saveSession(session);
  useAuthStore.getState().setSession(session);
}

/**
 * Creates the account and sends a 6-digit verification code to the given
 * email. Does NOT sign the user in — sign-up is verification-gated, so no
 * usable session exists until verifyEmail() succeeds.
 */
export async function signUp(email: string, username: string, password: string): Promise<void> {
  await apiClient.post('/auth/sign-up', { email, username, password }, { skipAuth: true });
}

/** Completes sign-up: exchanges the emailed code for a real session. */
export async function verifyEmail(email: string, code: string): Promise<void> {
  const data = await apiClient.post<TokenResponse>('/auth/verify-email', { email, code }, { skipAuth: true });
  await applySession(data);
}

export async function resendVerificationCode(email: string): Promise<void> {
  await apiClient.post('/auth/resend-verification', { email }, { skipAuth: true });
}

/** identifier can be either a username or an email address — the backend accepts both. */
export async function signIn(identifier: string, password: string): Promise<void> {
  const data = await apiClient.post<TokenResponse>('/auth/sign-in', { identifier, password }, { skipAuth: true });
  await applySession(data);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email }, { skipAuth: true });
}

/** Completes a password reset: exchanges the emailed code + new password for a real session. */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const data = await apiClient.post<TokenResponse>(
    '/auth/reset-password',
    { email, code, new_password: newPassword },
    { skipAuth: true }
  );
  await applySession(data);
}

/** Changes the signed-in account's username and updates the stored session to match. */
export async function updateUsername(username: string): Promise<void> {
  const data = await apiClient.patch<{ username: string }>('/auth/username', { username });
  const current = useAuthStore.getState().session;
  if (!current) return;
  const session = { ...current, username: data.username };
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
  useWorkoutSessionStore.getState().end(); // an in-progress workout belongs to the account signing out
}
