/**
 * Rest-timer alerts on iOS / Android: a local notification scheduled for the
 * moment rest ends, so it arrives on time even with the app in the background
 * or the phone locked. While the app is open, the in-app chime plays instead.
 * The web version is restNotifications.web.ts.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export interface RestAlert {
  /** When rest ends (epoch ms). */
  endsAt: number;
  /** What's next, e.g. "Bench Press (Barbell) · set 2 of 4". */
  nextLabel: string;
}

export type RestAlertPermission = 'granted' | 'denied' | 'default' | 'unsupported';

const CHANNEL = 'rest-timer';
let scheduledId: string | null = null;
let scheduledFor: number | null = null;
let initialised = false;

function toPermission(status: Notifications.PermissionStatus, canAskAgain: boolean): RestAlertPermission {
  if (status === 'granted') return 'granted';
  return status === 'denied' && !canAskAgain ? 'denied' : 'default';
}

export function initRestAlerts(): void {
  if (initialised) return;
  initialised = true;
  // In the app, the chime and rest bar already say it — no banner on top.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 120, 250],
      sound: 'default',
    }).catch(() => {});
  }
}

export async function getRestAlertPermission(): Promise<RestAlertPermission> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return toPermission(status, canAskAgain);
}

export async function requestRestAlertPermission(): Promise<RestAlertPermission> {
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
  return toPermission(status, canAskAgain);
}

/** Keeps the scheduled alert in step with the rest timer; null when not resting (or paused, or alerts off). */
export function syncRestAlert(alert: RestAlert | null): void {
  if (alert?.endsAt === scheduledFor) return;
  const previous = scheduledId;
  scheduledId = null;
  scheduledFor = alert?.endsAt ?? null;
  if (previous) Notifications.cancelScheduledNotificationAsync(previous).catch(() => {});
  if (!alert || alert.endsAt <= Date.now() + 1000) return;
  Notifications.scheduleNotificationAsync({
    content: { title: 'Rest over — time to lift 💪', body: alert.nextLabel, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(alert.endsAt),
      ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
    },
  })
    .then((id) => {
      // A newer sync may have happened meanwhile.
      if (scheduledFor === alert.endsAt) scheduledId = id;
      else Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    })
    .catch(() => {});
}
