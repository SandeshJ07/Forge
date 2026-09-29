import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  elapsedSeconds,
  hasWorkoutInProgress,
  isPaused,
  restRemainingSeconds,
  useWorkoutSessionStore,
} from '@/stores/useWorkoutSessionStore';
import { playRestChime } from '@/lib/restChime';
import { initRestAlerts, syncRestAlert } from '@/lib/restNotifications';
import { useRestAlertStore } from '@/stores/useRestAlertStore';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { colors, radii, spacing } from '@/constants/theme';

/** Re-renders every `ms` while mounted — for live clocks. */
export function useNow(ms = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * Mounted once for the signed-in app. Fires the rest-over chime wherever the
 * user is (even browsing other tabs), and — off the workout screen — shows a
 * "workout in progress" pill to jump back.
 */
export function WorkoutSessionOverlay() {
  const session = useWorkoutSessionStore((s) => s.session);
  const markChimed = useWorkoutSessionStore((s) => s.markChimed);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const now = useNow(session ? 500 : 60_000);

  const rest = session?.rest ?? null;
  // Frozen while paused, so the chime can't fire during a pause.
  const restRemaining = rest ? restRemainingSeconds(rest, now) : 0;

  useEffect(() => {
    if (rest && !rest.chimed && restRemaining <= 0) {
      playRestChime();
      markChimed();
    }
  }, [rest, restRemaining, markChimed]);

  // Rest alerts in the phone's / browser's notifications, for when the app is in the background.
  const alertsOn = useRestAlertStore((s) => s.enabled);
  const restPaused = rest?.pausedRemainingMs != null;
  const restEndsAt = rest?.endsAt;
  const restNext = rest?.nextLabel ?? '';
  useEffect(() => {
    initRestAlerts();
  }, []);
  useEffect(() => {
    syncRestAlert(alertsOn && restEndsAt && !restPaused ? { endsAt: restEndsAt, nextLabel: restNext } : null);
  }, [alertsOn, restEndsAt, restPaused, restNext]);

  if (!session || !hasWorkoutInProgress(session) || pathname.startsWith('/workout/new')) return null;

  const paused = isPaused(session);
  const position = isDesktopWeb
    ? { top: spacing.lg, right: spacing.xl }
    : { top: insets.top + spacing.sm, left: spacing.md, right: spacing.md };

  return (
    <Pressable
      onPress={() => router.push('/workout/new')}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Workout paused. Open it' : 'Workout in progress. Open it'}
      style={[styles.pill, position]}
    >
      <View style={[styles.dot, paused && styles.dotPaused]} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {session.title}
        </Text>
        <Text style={styles.meta}>
          {formatClock(elapsedSeconds(session, now))}
          {paused ? ' · Paused' : rest ? (restRemaining > 0 ? ` · Rest ${formatClock(restRemaining)}` : ' · Rest over — go!') : ''}
        </Text>
      </View>
      <Text style={styles.resume}>Resume</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    cursor: 'pointer',
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  dotPaused: {
    backgroundColor: colors.warning,
  },
  text: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  resume: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
