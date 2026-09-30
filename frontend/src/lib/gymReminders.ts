/**
 * Gym reminders on iOS / Android: repeating local notifications, one per chosen
 * weekday, scheduled on the device — they arrive with the app closed and need
 * no server. The web version (web push through the server) is gymReminders.web.ts.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Weekday } from '@/types/database';

export interface GymReminderSchedule {
  /** Local "HH:MM". */
  time: string;
  days: Weekday[];
}

export type ReminderSetup = 'ok' | 'denied' | 'unsupported' | 'server-off';

const CHANNEL = 'gym-reminder';
const ID_PREFIX = 'gym-reminder-';
// expo-notifications weekdays: 1 = Sunday … 7 = Saturday.
const EXPO_WEEKDAY: Record<Weekday, number> = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };

async function cancelAll(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/** Asks for permission if needed, then (re)schedules the reminders. Call from a tap. */
export async function enableGymReminder(schedule: GymReminderSchedule): Promise<ReminderSetup> {
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  await syncGymReminder(schedule);
  return 'ok';
}

/** Replaces the scheduled reminders with this schedule (null = none). */
export async function syncGymReminder(schedule: GymReminderSchedule | null): Promise<void> {
  await cancelAll();
  if (!schedule || !schedule.days.length) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Gym reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const [hour, minute] = schedule.time.split(':').map(Number);
  await Promise.all(
    schedule.days.map((day) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${day}`,
        content: { title: 'Time to train 💪', body: 'Your workout is waiting — open Forge to start today’s session.' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: EXPO_WEEKDAY[day],
          hour,
          minute,
          ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
        },
      })
    )
  );
}

export async function disableGymReminder(): Promise<void> {
  await cancelAll();
}

/** Shows a reminder right away, so the user can see what it looks like. */
export async function testGymReminder(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Reminders are on ✅', body: 'You’ll get a nudge like this at your gym time.' },
    trigger: null,
  });
}
