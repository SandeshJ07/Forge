import { apiClient } from '@/lib/apiClient';

export interface PushConfig {
  /** False when the server has no VAPID keys — web reminders can't be delivered. */
  enabled: boolean;
  public_key: string | null;
}

export async function fetchPushConfig(): Promise<PushConfig> {
  return apiClient.get<PushConfig>('/reminders/push-config');
}

/** Registers this browser's push subscription (PushSubscription.toJSON()) for the signed-in user. */
export async function savePushSubscription(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await apiClient.post('/reminders/subscriptions', subscription);
}

export async function removePushSubscription(endpoint: string) {
  await apiClient.post('/reminders/subscriptions/remove', { endpoint });
}

/** Pushes a test reminder to every browser this user turned reminders on in. */
export async function sendTestPush() {
  await apiClient.post('/reminders/test', {});
}
