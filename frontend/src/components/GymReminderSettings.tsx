import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { TimePickerField } from '@/components/ui/TimePickerField';
import { useLatestPlan } from '@/hooks/usePlans';
import { useUpsertUserProfile } from '@/hooks/useUserProfile';
import { disableGymReminder, enableGymReminder, syncGymReminder, testGymReminder } from '@/lib/gymReminders';
import { planGroups, WEEKDAY_ORDER, WEEKDAY_SHORT } from '@/lib/planGroups';
import { ApiError } from '@/lib/apiClient';
import type { UserProfile, Weekday } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const DEFAULT_TIME = '18:00';
const WEEKDAYS_ONLY: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
// No "time hasn't happened yet" limit — this is a time of day to repeat, not a past moment.
const NO_MAX = new Date(8.64e15);

function toDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function toTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

const SETUP_MESSAGES = {
  denied: 'Notifications are blocked for Forge. Allow them in your browser or phone settings, then try again.',
  unsupported:
    Platform.OS === 'web'
      ? "This browser can't receive reminders. On iPhone, add Forge to your home screen first and open it from there."
      : "This device can't show reminders.",
  'server-off': "Reminders aren't set up on the server yet.",
} as const;

/** "Remind me to train" — a time of day and the weekdays it repeats on. */
export function GymReminderSettings({ profile }: { profile: UserProfile | undefined }) {
  const upsertProfile = useUpsertUserProfile();
  const { data: latestPlan } = useLatestPlan();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const time = profile?.gym_reminder_time ?? null;
  const days = profile?.gym_reminder_days ?? [];
  const on = Boolean(time);

  // Keep the device's scheduled reminders in step with the saved schedule (native; a no-op on web).
  useEffect(() => {
    if (!profile) return;
    syncGymReminder(time && days.length ? { time, days } : null).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.gym_reminder_time, profile?.gym_reminder_days?.join(',')]);

  async function save(fields: Partial<UserProfile>) {
    await upsertProfile.mutateAsync({ ...fields, timezone: deviceTimezone() });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.', isError: true });
    } finally {
      setBusy(false);
    }
  }

  function turnOn() {
    run(async () => {
      // Start from the plan's training days, else weekdays.
      const planDays = [...new Set(planGroups(latestPlan?.plan).flatMap((g) => g.weekdays ?? []))];
      const startDays = days.length ? days : planDays.length ? WEEKDAY_ORDER.filter((d) => planDays.includes(d)) : WEEKDAYS_ONLY;
      const startTime = time ?? DEFAULT_TIME;
      const result = await enableGymReminder({ time: startTime, days: startDays });
      if (result !== 'ok') {
        setMessage({ text: SETUP_MESSAGES[result], isError: true });
        return;
      }
      await save({ gym_reminder_time: startTime, gym_reminder_days: startDays });
    });
  }

  function turnOff() {
    run(async () => {
      await disableGymReminder();
      await save({ gym_reminder_time: null });
    });
  }

  function toggleDay(day: Weekday) {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    run(() => save({ gym_reminder_days: WEEKDAY_ORDER.filter((d) => next.includes(d)) }));
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.title}>Remind me to train</Text>
          <Text style={styles.hint}>
            {on
              ? `${days.length ? days.map((d) => WEEKDAY_SHORT[d]).join(', ') : 'No days picked'} at ${toDate(time as string).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
              : 'A notification at your gym time on the days you pick.'}
          </Text>
        </View>
        <Switch
          value={on}
          onValueChange={(value) => (value ? turnOn() : turnOff())}
          disabled={busy || !profile}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel="Gym reminder"
        />
      </View>

      {on && time ? (
        <>
          <TimePickerField
            label="Reminder time"
            value={toDate(time)}
            maxDate={NO_MAX}
            onChange={(date) => run(() => save({ gym_reminder_time: toTime(date) }))}
          />
          <View style={styles.days}>
            <Text style={styles.label}>On these days</Text>
            <ChipGroup>
              {WEEKDAY_ORDER.map((d) => (
                <Chip key={d} label={WEEKDAY_SHORT[d]} showCheck selected={days.includes(d)} onPress={() => toggleDay(d)} />
              ))}
            </ChipGroup>
            {!days.length ? <Text style={styles.warning}>Pick at least one day to get reminders.</Text> : null}
          </View>
          <Text
            style={styles.link}
            onPress={() => run(async () => {
              await testGymReminder();
              setMessage({ text: 'Test reminder sent — it should appear in a moment.', isError: false });
            })}
            accessibilityRole="button"
          >
            Send a test reminder
          </Text>
        </>
      ) : null}

      {message ? <Text style={message.isError ? styles.error : styles.success}>{message.text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  days: { gap: spacing.xs },
  warning: { color: colors.warning, fontSize: 13 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600', cursor: 'pointer' },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontSize: 13 },
});
