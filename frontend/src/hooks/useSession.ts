import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { loadStoredSession } from '@/lib/tokenStorage';

/**
 * Mounted once at the app root. There's no server-side "auth state change"
 * push here (unlike Supabase's listener) — the backend is stateless JWTs,
 * so this just hydrates useAuthStore from whatever was persisted locally on
 * a previous sign-in. apiClient handles refreshing an expired access token
 * transparently on subsequent requests.
 */
export function useSessionListener() {
  const setSession = useAuthStore((s) => s.setSession);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  useEffect(() => {
    loadStoredSession().then((stored) => {
      setSession(stored);
      setInitializing(false);
    });
  }, [setSession, setInitializing]);
}
