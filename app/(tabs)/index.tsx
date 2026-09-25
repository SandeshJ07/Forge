import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRecentWorkouts, useStatsOverview, useWorkoutHistory } from '@/hooks/useWorkouts';
import { usePersonalRecords } from '@/hooks/usePersonalRecords';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { PersonalRecordRow } from '@/components/PersonalRecordRow';
import { InstallPwaPrompt } from '@/components/InstallPwaPrompt';
import { StreakCard } from '@/components/StreakCard';
import { ProgressStatsCard } from '@/components/ProgressStatsCard';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDay, formatDaysAgo } from '@/lib/format';
import { hasWorkoutInProgress, useWorkoutSessionStore } from '@/stores/useWorkoutSessionStore';
import { colors, radii, spacing } from '@/constants/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const isDesktopWeb = useIsDesktopWeb();
  const username = useAuthStore((s) => s.session?.username);
  const { data: workouts, isLoading: workoutsLoading } = useRecentWorkouts();
  const inProgress = hasWorkoutInProgress(useWorkoutSessionStore((s) => s.session));
  const { data: records } = usePersonalRecords();
  const { data: history } = useWorkoutHistory();
  const { data: overview } = useStatsOverview();
  const workoutDates = useMemo(() => (history ?? workouts ?? []).map((w) => w.date), [history, workouts]);

  const stats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      workoutsThisWeek: (workouts ?? []).filter((w) => new Date(w.date).getTime() >= sevenDaysAgo).length,
      lastWorkout: workouts?.[0] ?? null,
    };
  }, [workouts]);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const isNewUser = !workoutsLoading && !workouts?.length;

  const recordsCard = (
    <Card style={styles.sectionCard}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Personal records</Text>
        {records?.length ? (
          <Text style={styles.link} onPress={() => router.push('/records')} accessibilityRole="link">
            See all
          </Text>
        ) : null}
      </View>
      {(records ?? []).slice(0, 3).map((record) => (
        <PersonalRecordRow key={record.exercise_id} record={record} />
      ))}
      {!records?.length ? (
        <Text style={styles.mutedText}>Log a set with weight and your best lifts will show up here.</Text>
      ) : null}
    </Card>
  );

  return (
    <ScreenContainer>
      <ScreenHeader title={username ? `Hi, ${username}` : 'Home'} subtitle={today} />
      <InstallPwaPrompt />

      {isNewUser ? (
        <Card style={styles.welcomeCard}>
          <Ionicons name="barbell" size={28} color={colors.primary} />
          <Text style={styles.welcomeTitle}>Log your first workout</Text>
          <Text style={styles.mutedText}>
            Every set you log feeds your personal records and makes your next plan smarter.
          </Text>
          <Button label="Log a workout" onPress={() => router.push('/workout/new')} />
        </Card>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatTile label="This week" value={String(stats.workoutsThisWeek)} hint="workouts" />
            <StatTile
              label="Last workout"
              value={stats.lastWorkout ? formatDaysAgo(stats.lastWorkout.date) : '—'}
              hint={stats.lastWorkout?.title ?? undefined}
            />
            <StatTile label="Records" value={String(records?.length ?? 0)} hint="exercises" />
          </View>
          <Button
            label={inProgress ? 'Resume workout' : 'Log workout'}
            onPress={() => router.push('/workout/new')}
          />
          <StreakCard workoutDates={workoutDates} />
          {overview ? <ProgressStatsCard stats={overview} /> : null}
        </>
      )}

      {recordsCard}

      {workouts?.length ? (
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Recent workouts</Text>
            <Text style={styles.link} onPress={() => router.navigate('/log')} accessibilityRole="link">
              See all
            </Text>
          </View>
          {workouts.slice(0, 5).map((w) => (
            <Pressable
              key={w.id}
              onPress={() => router.navigate('/log')}
              style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}
            >
              <View style={styles.activityIcon}>
                <Ionicons name="barbell-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.activityTitle}>{w.title ?? 'Workout'}</Text>
                <Text style={styles.activityMeta}>{formatDay(w.date)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>
      ) : null}
    </ScreenContainer>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.statHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  welcomeCard: {
    gap: spacing.sm,
    borderColor: colors.primaryMuted,
  },
  welcomeTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm + 4,
    gap: 2,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  statHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  column: {
    flex: 1,
  },
  sectionCard: {
    gap: spacing.sm,
    flexGrow: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(61,220,132,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  badgeBusy: {
    color: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  planTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  link: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    cursor: 'pointer',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    cursor: 'pointer',
  },
  pressed: {
    opacity: 0.7,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  activityMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  mutedText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
