import { StyleSheet, Text, View } from 'react-native';
import type { PlanPayload } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

export function PlanView({ plan }: { plan: PlanPayload }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{plan.title}</Text>
      <Text style={styles.rationale}>{plan.rationale}</Text>

      {plan.days.map((day, index) => (
        <View key={index} style={styles.dayCard}>
          <Text style={styles.dayLabel}>{day.day_label}</Text>
          <Text style={styles.dayFocus}>{day.focus}</Text>

          {day.warmup?.length ? (
            <View style={styles.warmupSection}>
              <Text style={styles.warmupLabel}>Warm-up</Text>
              {day.warmup.map((item, warmupIndex) => (
                <Text key={warmupIndex} style={styles.warmupItem}>
                  • {item.exercise_name} — {item.duration_or_reps}
                  {item.notes ? ` (${item.notes})` : ''}
                </Text>
              ))}
            </View>
          ) : null}

          {day.exercises.map((exercise, exerciseIndex) => (
            <View key={exerciseIndex} style={styles.exerciseRow}>
              <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
              <Text style={styles.exerciseMeta}>
                {exercise.sets} × {exercise.reps} · rest {exercise.rest_seconds}s
              </Text>
              {exercise.notes ? <Text style={styles.exerciseNotes}>{exercise.notes}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  rationale: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  dayCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  dayLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  dayFocus: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  warmupSection: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: 2,
    marginBottom: spacing.xs,
  },
  warmupLabel: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  warmupItem: {
    color: colors.textMuted,
    fontSize: 13,
  },
  exerciseRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  exerciseNotes: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
