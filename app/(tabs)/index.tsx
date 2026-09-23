import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRecentWorkouts } from '@/hooks/useWorkouts';
import { useLatestPlan } from '@/hooks/usePlans';
import { usePersonalRecords } from '@/hooks/usePersonalRecords';
import { PersonalRecordRow } from '@/components/PersonalRecordRow';
import { colors, spacing } from '@/constants/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { data: workouts } = useRecentWorkouts();
  const { data: latestPlan } = useLatestPlan();
  const { data: records } = usePersonalRecords();

  const stats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const last7 = (workouts ?? []).filter((w) => new Date(w.date).getTime() >= sevenDaysAgo);
    return {
      workoutsThisWeek: last7.length,
      lastWorkout: workouts?.[0] ?? null,
    };
  }, [workouts]);

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Home</Text>

      <Card style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{stats.workoutsThisWeek}</Text>
          <Text style={styles.statLabel}>Workouts this week</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>
            {stats.lastWorkout ? new Date(stats.lastWorkout.date).toLocaleDateString() : '—'}
          </Text>
          <Text style={styles.statLabel}>Last workout</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Recent activity</Text>
        {(workouts ?? []).slice(0, 5).map((w) => (
          <View key={w.id} style={styles.activityRow}>
            <Text style={styles.activityTitle}>{w.title ?? w.source}</Text>
            <Text style={styles.activityMeta}>
              {new Date(w.date).toLocaleDateString()} · {w.source}
            </Text>
          </View>
        ))}
        {!workouts?.length ? <Text style={styles.emptyText}>No workouts logged yet.</Text> : null}
      </Card>

      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Recent PRs</Text>
          <Text style={styles.historyLink} onPress={() => router.push('/records')}>
            View all
          </Text>
        </View>
        {(records ?? []).slice(0, 3).map((record) => (
          <PersonalRecordRow key={record.exercise_id} record={record} />
        ))}
        {!records?.length ? <Text style={styles.emptyText}>No records yet.</Text> : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>
          {latestPlan ? 'Your current plan' : 'No plan yet'}
        </Text>
        <Text style={styles.emptyText}>
          {latestPlan
            ? latestPlan.plan.title
            : 'Generate an AI training plan based on your workout history and preferences.'}
        </Text>
        <Button
          label={latestPlan ? 'View plan' : 'Generate a plan'}
          onPress={() => router.push('/(tabs)/plan')}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  activityRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
  },
});
