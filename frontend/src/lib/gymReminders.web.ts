/**
 * Gym reminders on the web, through web push: the browser subscribes with the
 * server's VAPID key, the server stores the subscription and sends the reminder
 * at the user's time (POST /reminders/dispatch, run by a cron), and the service
 * worker (public/sw.js) shows it — even with Forge closed.
 * On iPhone, web push only works in the installed (home screen) app.
 */
import { fetchPushConfig, removePushSubscription, savePushSubscription, sendTestPush } from '@/api/reminders';
import type { GymReminderSchedule, ReminderSetup } from './gymReminders';

export type { GymReminderSchedule, ReminderSetup } from './gymReminders';

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (!existing) await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

/** Asks for permission if needed and registers this browser for reminders. Call from a tap. */
export async function enableGymReminder(_schedule: GymReminderSchedule): Promise<ReminderSetup> {
  if (!supported()) return 'unsupported';
  const config = await fetchPushConfig();
  if (!config.enabled || !config.public_key) return 'server-off';
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const reg = await registration();
  let subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    // Subscribed with an older server key: start over with the current one.
    const current = subscription.options.applicationServerKey;
    const expected = keyToBytes(config.public_key);
    const same =
      current && new Uint8Array(current).length === expected.length && new Uint8Array(current).every((b, i) => b === expected[i]);
    if (!same) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(config.public_key) });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'unsupported';
  await savePushSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
  return 'ok';
}

/** The server holds the schedule (on the profile); nothing to do in the browser. */
export async function syncGymReminder(_schedule: GymReminderSchedule | null): Promise<void> {}

export async function disableGymReminder(): Promise<void> {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  await removePushSubscription(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}

export async function testGymReminder(): Promise<void> {
  await sendTestPush();
}
