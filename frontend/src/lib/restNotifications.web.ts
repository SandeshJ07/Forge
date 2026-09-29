/**
 * Rest-timer alerts on the web, through the browser's notifications (shown by
 * the service worker in public/sw.js, which Android Chrome requires).
 *
 * - While resting with the app in the background: a quiet live countdown
 *   ("Rest · 1:23 left"), updated in place every second, that also says when
 *   rest ends ("back at 4:57 PM").
 * - When rest runs out while the app is in the background: "Rest over", with
 *   sound and vibration where the device allows.
 *
 * Browsers slow down or pause background pages to save battery (iPhone most
 * of all), so there the countdown can stop ticking and the rest-over alert
 * can arrive late; the "back at" time is always right.
 * On iPhone, web notifications only work in the installed (home screen) app.
 */
import type { RestAlert, RestAlertPermission } from './restNotifications';

const TAG = 'forge-rest';
const ICON = '/icon-192.png';

let current: RestAlert | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
const TICK_MS = 1000;
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

// Updates go out one at a time and in order, so a late countdown tick can't overwrite "Rest over".
let queue: Promise<void> = Promise.resolve();

function show(title: string, body: string, loud: boolean): Promise<void> {
  queue = queue.then(() => showNow(title, body, loud));
  return queue;
}

async function showNow(title: string, body: string, loud: boolean): Promise<void> {
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

function clear(): Promise<void> {
  queue = queue.then(clearNow);
  return queue;
}

async function clearNow(): Promise<void> {
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

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/** Shows (or quietly updates in place) the countdown; false once rest is over. */
function restingNotice(alert: RestAlert): boolean {
  const left = Math.ceil((alert.endsAt - Date.now()) / 1000);
  if (left <= 0) return false;
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, '0');
  void show(`Rest · ${m}:${s} left`, `Back at ${clockTime(alert.endsAt)} · ${alert.nextLabel}`, false);
  return true;
}

function stopTicker(): void {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

/** Live countdown while the app is in the background. */
function startTicker(): void {
  stopTicker();
  const alert = current;
  if (!alert || !restingNotice(alert)) return;
  ticker = setInterval(() => {
    if (current !== alert || !isHidden() || !restingNotice(alert)) stopTicker();
  }, TICK_MS);
}

function onVisibilityChange(): void {
  if (isHidden()) {
    startTicker();
  } else {
    stopTicker();
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
    stopTicker();
    void clear();
    return;
  }
  if (changed && isHidden()) startTicker(); // e.g. a new rest started while in the background
  const wait = alert.endsAt - Date.now();
  if (wait < -5000) return; // long over — nothing to announce
  timer = setTimeout(() => {
    timer = null;
    stopTicker();
    if (isHidden()) void show('Rest over — time to lift 💪', alert.nextLabel, true);
  }, Math.max(0, wait));
}
