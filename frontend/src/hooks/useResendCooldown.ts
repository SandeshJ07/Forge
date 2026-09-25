import { useCallback, useEffect, useState } from 'react';

/**
 * Seconds to wait between code emails. Mirrors the backend's
 * RESEND_COOLDOWN_SECONDS (app/services/email_codes.py), which enforces it.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Countdown for "Resend code" buttons: start() after each email; `remaining` ticks to 0. */
export function useResendCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until, now]);

  const start = useCallback((seconds: number = RESEND_COOLDOWN_SECONDS) => {
    const t = Date.now();
    setNow(t);
    setUntil(t + seconds * 1000);
  }, []);

  return { remaining: Math.max(0, Math.ceil((until - now) / 1000)), start };
}

/** "0:45" */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
