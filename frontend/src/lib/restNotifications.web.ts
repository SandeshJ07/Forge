/**
 * Rest-timer alerts on the web, through the browser's notifications (shown by
 * the service worker in public/sw.js, which Android Chrome requires).
 *
 * - While resting with the app in the background: a quiet "Resting — back at
 *   4:57 PM" notification, so the lock screen / shade shows when rest ends.
 * - When rest runs out while the app is in the background: "Rest over", with
 *   sound and vibration where the device allows.
 *
 * Browsers pause background pages to save battery (iPhone most of all), so the
 * rest-over alert can arrive late there; the "back at" time is always right.
 * On iPhone, web notifications only work in the installed (home screen) app.
 */
import type { RestAlert, RestAlertPermission } from './restNotifications';

const TAG = 'forge-rest';
const ICON = '/icon-192.png';

let current: RestAlert | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js'));
  } catch {
    return null;
  }
}

async function show(title: string, body: string, loud: boolean): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body,
    tag: TAG,
    icon: ICON,
    badge: ICON,
    renotify: loud,
    silent: !loud,
    requireInteraction: loud,
    data: { url: '/workout/new' },
    ...(loud ? { vibrate: [250, 120, 250] } : {}),
  };
  const reg = await registration();
  try {
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options); // desktop browsers without a worker
  } catch {
    // Notifications blocked or unavailable — the in-app timer still works.
  }
}

async function clear(): Promise<void> {
  const reg = await registration();
  if (!reg) return;
  try {
    (await reg.getNotifications({ tag: TAG })).forEach((n) => n.close());
  } catch {
    // ignore
  }
}

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function restingNotice(alert: RestAlert): void {
  const left = Math.max(0, Math.round((alert.endsAt - Date.now()) / 1000));
  if (left <= 0) return;
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, '0');
  void show(`Resting — back at ${clockTime(alert.endsAt)}`, `${m}:${s} left · ${alert.nextLabel}`, false);
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    if (current) restingNotice(current);
  } else {
    void clear(); // back in the app: its own timer takes over
  }
}

export function initRestAlerts(): void {
  if (!supported() || listening) return;
  listening = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (Notification.permission === 'granted') void registration();
}

export async function getRestAlertPermission(): Promise<RestAlertPermission> {
  if (!supported()) return 'unsupported';
  return Notification.permission;
}

/** Call from a tap — browsers only show the permission prompt for a user gesture. */
export async function requestRestAlertPermission(): Promise<RestAlertPermission> {
  if (!supported()) return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted') await registration();
  return result;
}

/** Keeps the alerts in step with the rest timer; null when not resting (or paused, or alerts off). */
export function syncRestAlert(alert: RestAlert | null): void {
  if (timer) clearTimeout(timer);
  timer = null;
  const changed = current?.endsAt !== alert?.endsAt;
  current = alert;
  if (!alert) {
    void clear();
    return;
  }
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  if (changed && hidden) restingNotice(alert); // e.g. +15s pressed from elsewhere
  const wait = alert.endsAt - Date.now();
  if (wait < -5000) return; // long over — nothing to announce
  timer = setTimeout(() => {
    timer = null;
    if (document.visibilityState === 'hidden') void show('Rest over — time to lift 💪', alert.nextLabel, true);
  }, Math.max(0, wait));
}
