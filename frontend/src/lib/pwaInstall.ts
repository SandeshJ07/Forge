import { Platform } from 'react-native';
import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallState {
  /** Chrome/Edge/Samsung's deferred install prompt, if the browser offered one. */
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  /** The user said "Not now" to an install nudge. Shared by the sign-in nudge and the Home banner. */
  nudgeDismissed: boolean;
}

const NUDGE_DISMISSED_KEY = 'forge_pwa_prompt_dismissed';

function readNudgeDismissed(): boolean {
  try {
    return window.localStorage?.getItem(NUDGE_DISMISSED_KEY) === 'true';
  } catch {
    return false; // storage blocked (private mode) — worst case the nudge shows again next visit
  }
}

const usePwaStore = create<PwaInstallState>(() => ({ deferredPrompt: null, installed: false, nudgeDismissed: true }));

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/**
 * Registered once, at app start (imported from app/_layout.tsx). The browser
 * fires `beforeinstallprompt` a single time, right after load — a listener
 * that only exists while one screen is mounted would usually miss it — so
 * it's captured here and shared through usePwaInstall().
 */
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  usePwaStore.setState({ installed: isStandalone(), nudgeDismissed: readNudgeDismissed() });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep the browser's own mini-infobar out of the way; we show our own UI
    usePwaStore.setState({ deferredPrompt: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => usePwaStore.setState({ installed: true, deferredPrompt: null }));
}

export type InstallMethod = 'prompt' | 'ios' | 'manual';

/** Remember that the user declined (or already acted on) an install nudge, on this device. */
export function dismissInstallNudge(): void {
  usePwaStore.setState({ nudgeDismissed: true });
  try {
    window.localStorage?.setItem(NUDGE_DISMISSED_KEY, 'true');
  } catch {
    // Storage blocked — the in-memory flag still hides it for this session.
  }
}

export function usePwaInstall() {
  const { deferredPrompt, installed, nudgeDismissed } = usePwaStore();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIos = /iphone|ipad|ipod/i.test(ua);

  // 'prompt': real one-tap install (Android Chrome, Edge, Samsung Internet).
  // 'ios': Safari has no install API — show Share → Add to Home Screen steps.
  // 'manual': browser hasn't offered a prompt (yet); point at its menu.
  const method: InstallMethod = deferredPrompt ? 'prompt' : isIos ? 'ios' : 'manual';

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferredPrompt) return 'unavailable';
    let outcome: 'accepted' | 'dismissed';
    try {
      await deferredPrompt.prompt();
      ({ outcome } = await deferredPrompt.userChoice);
    } catch {
      // The browser can refuse (not a user gesture, prompt already used, …).
      // Callers fall back to showing manual instructions.
      usePwaStore.setState({ deferredPrompt: null });
      return 'unavailable';
    }
    // A prompt can only be used once; the browser may offer a fresh one later.
    usePwaStore.setState({ deferredPrompt: null, installed: outcome === 'accepted' });
    return outcome;
  }

  // Instructions to show when there's no prompt, or the prompt was refused.
  const fallbackMethod: Exclude<InstallMethod, 'prompt'> = isIos ? 'ios' : 'manual';

  return {
    supported: Platform.OS === 'web',
    installed,
    nudgeDismissed,
    method,
    fallbackMethod,
    isIos,
    promptInstall,
  };
}
