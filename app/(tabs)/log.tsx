import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { WorkoutFeedbackControl } from '@/components/WorkoutFeedbackControl';
import { useRecentWorkouts } from '@/hooks/useWorkouts';
import { colors, spacing } from '@/constants/theme';

export default function LogScreen() {
  const { data: workouts, isLoading } = useRecentWorkouts();

  return (
    <ScreenContainer scroll={false} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Log</Text>
      </View>

      <FlatList
        data={workouts ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.workoutCard}>
            <Text style={styles.workoutTitle}>{item.title ?? 'Workout'}</Text>
            <Text style={styles.workoutMeta}>{new Date(item.date).toLocaleString()}</Text>
            {item.summary ? <Text style={styles.workoutSummary}>{item.summary}</Text> : null}
            <WorkoutFeedbackControl workout={item} />
          </Card>
        )}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.emptyText}>No workouts logged yet.</Text> : null
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  workoutCard: {
    gap: spacing.xs,
  },
  workoutTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  workoutMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  workoutSummary: {
    color: colors.text,
    fontSize: 14,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
