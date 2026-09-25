import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { WorkoutFeedbackControl } from '@/components/WorkoutFeedbackControl';
import { useRecentWorkouts } from '@/hooks/useWorkouts';
import { formatDayTime } from '@/lib/format';
import { colors, spacing } from '@/constants/theme';

/** Backend summaries read "3 sets logged manually" — every workout is manual, so drop the noise. */
function shortSummary(summary: string | null): string | null {
  return summary ? summary.replace(/ logged manually$/, '') : null;
}

export default function LogScreen() {
  const router = useRouter();
  const { data: workouts, isLoading } = useRecentWorkouts();

  return (
    <ScreenContainer scroll={false} style={styles.container}>
      <ScreenHeader
        title="Log"
        subtitle="Your training history"
        right={<Button label="Log workout" onPress={() => router.push('/workout/new')} />}
      />

      <FlatList
        data={workouts ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.workoutCard}>
            <View style={styles.workoutHead}>
              <View style={styles.flex}>
                <Text style={styles.workoutTitle}>{item.title ?? 'Workout'}</Text>
                <Text style={styles.workoutMeta}>
                  {formatDayTime(item.date)}
                  {shortSummary(item.summary) ? ` · ${shortSummary(item.summary)}` : ''}
                </Text>
              </View>
            </View>
            <WorkoutFeedbackControl workout={item} />
          </Card>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="barbell-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No workouts yet</Text>
              <Text style={styles.emptyText}>Log a session and it'll show up here, ready to rate.</Text>
              <Button label="Log your first workout" onPress={() => router.push('/workout/new')} />
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
