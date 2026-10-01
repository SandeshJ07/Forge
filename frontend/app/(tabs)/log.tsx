import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { WorkoutFeedbackControl } from '@/components/WorkoutFeedbackControl';
import { StreakCard } from '@/components/StreakCard';
import { MonthPicker, startOfMonth } from '@/components/MonthPicker';
import { useWorkoutHistory, useWorkoutsInMonth } from '@/hooks/useWorkouts';
import { formatDay, formatDayTime } from '@/lib/format';
import { formatDistance, paceFor } from '@/lib/runTracking';
import { RouteSvg } from '@/components/RouteSvg';
import { useUnitStore } from '@/stores/useUnitStore';
import { colors, spacing } from '@/constants/theme';

/** Backend summaries read "3 sets logged manually" — every workout is manual, so drop the noise. */
function shortSummary(summary: string | null): string | null {
  return summary ? summary.replace(/ logged manually$/, '') : null;
}

export default function LogScreen() {
  const router = useRouter();
  const imperial = useUnitStore((s) => s.unitSystem) === 'imperial';
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  // A day tapped in the calendar narrows the list to that day; tapping it again shows the whole month.
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const { data: monthWorkouts, isLoading } = useWorkoutsInMonth(month);
  const workouts = useMemo(
    () =>
      selectedDay
        ? (monthWorkouts ?? []).filter((w) => new Date(w.date).toDateString() === selectedDay.toDateString())
        : monthWorkouts,
    [monthWorkouts, selectedDay]
  );

  function changeMonth(next: Date) {
    setSelectedDay(null);
    setMonth(next);
  }
  // The streak counts across all history; the calendar shows the chosen month.
  const { data: history } = useWorkoutHistory();
  const workoutDates = useMemo(
    () => [...new Set([...(history ?? []), ...(monthWorkouts ?? [])].map((w) => w.date))],
    [history, monthWorkouts]
  );
  const monthName = month.toLocaleDateString(undefined, { month: 'long' });

  return (
    <ScreenContainer scroll={false} style={styles.container}>
      <ScreenHeader
        title="Log"
        subtitle="Your training history"
        right={
          <View style={styles.headerActions}>
            <Button label="Record run" size="small" variant="secondary" onPress={() => router.push('/run')} />
            <Button label="Log workout" size="small" onPress={() => router.push('/workout/new')} />
          </View>
        }
      />

      <FlatList
        data={workouts ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.workoutCard}>
            <Pressable
              onPress={() => router.push(`/workout/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title ?? 'Workout'}, ${formatDayTime(item.date)}. View details`}
              style={({ pressed }) => [styles.workoutHead, pressed && styles.pressed]}
            >
              {item.run?.preview?.length ? (
                <RouteSvg segments={[item.run.preview]} width={56} height={56} strokeWidth={2} style={styles.thumb} />
              ) : null}
              <View style={styles.flex}>
                <Text style={styles.workoutTitle}>{item.title ?? 'Workout'}</Text>
                <Text style={styles.workoutMeta}>
                  {formatDayTime(item.date)}
                  {item.run
                    ? ` · ${formatDistance(item.run.distance_m, imperial)} · ${paceFor(
                        item.run.distance_m ? (item.run.moving_seconds / item.run.distance_m) * 1000 : null,
                        imperial
                      )}`
                    : shortSummary(item.summary)
                      ? ` · ${shortSummary(item.summary)}`
                      : ''}
                </Text>
              </View>
              <Text style={styles.detailsLink}>Details</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
            <WorkoutFeedbackControl workout={item} />
          </Card>
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <MonthPicker month={month} onChange={changeMonth} />
            <StreakCard
              workoutDates={workoutDates}
              month={month}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            {selectedDay ? (
              <View style={styles.filterRow}>
                <Text style={[styles.sectionTitle, styles.flex]}>
                  {workouts?.length
                    ? `${workouts.length} workout${workouts.length === 1 ? '' : 's'} on ${formatDay(selectedDay)}`
                    : formatDay(selectedDay)}
                </Text>
                <Text style={styles.detailsLink} onPress={() => setSelectedDay(null)} accessibilityRole="button">
                  Show all of {monthName}
                </Text>
              </View>
            ) : workouts?.length ? (
              <Text style={styles.sectionTitle}>
                {workouts.length} workout{workouts.length === 1 ? '' : 's'} in {monthName}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="barbell-outline" size={32} color={colors.textMuted} />
              {selectedDay ? (
                <>
                  <Text style={styles.emptyTitle}>Rest day</Text>
                  <Text style={styles.emptyText}>No workouts on {formatDay(selectedDay)}. Tap the day again to see the whole month.</Text>
                </>
              ) : history?.length ? (
                <>
                  <Text style={styles.emptyTitle}>No workouts in {monthName}</Text>
                  <Text style={styles.emptyText}>Pick another month above to see those sessions.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>No workouts yet</Text>
                  <Text style={styles.emptyText}>Log a session and it'll show up here, ready to rate.</Text>
                  <Button label="Log your first workout" onPress={() => router.push('/workout/new')} />
                </>
              )}
            </Card>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  listHeader: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumb: {
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  container: {
    gap: spacing.sm,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  workoutCard: {
    gap: spacing.xs,
  },
  workoutHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  pressed: {
    opacity: 0.7,
  },
  detailsLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  workoutTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  workoutMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
