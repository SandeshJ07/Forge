import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { PlanPayload } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { colors, radii, spacing } from '@/constants/theme';

interface PlanViewProps {
  plan: PlanPayload;
  /** Shows a per-group "Log this workout" button when provided. */
  onStartDay?: (dayIndex: number) => void;
  /** Label for that button, e.g. "Resume workout" while a session is running. */
  startLabel?: (dayIndex: number) => string;
}

export function PlanView({ plan, onStartDay, startLabel }: PlanViewProps) {
  const router = useRouter();

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
              <Pressable
                disabled={!exercise.exercise_id}
                accessibilityRole={exercise.exercise_id ? 'link' : undefined}
                onPress={() => router.push(`/exercise/${exercise.exercise_id}`)}
                style={[styles.exerciseHead, exercise.exercise_id ? styles.exerciseHeadLink : null]}
              >
                <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                {exercise.exercise_id ? <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} /> : null}
              </Pressable>
              <Text style={styles.exerciseMeta}>
                <Text style={styles.exerciseDose}>
                  {exercise.sets} × {exercise.reps}
                </Text>
                {'  ·  '}rest {exercise.rest_seconds >= 60 && exercise.rest_seconds % 30 === 0
                  ? `${exercise.rest_seconds / 60} min`
                  : `${exercise.rest_seconds}s`}
              </Text>
              {exercise.notes ? <Text style={styles.exerciseNotes}>{exercise.notes}</Text> : null}
            </View>
          ))}

          {onStartDay ? (
            <View style={styles.startRow}>
              <Button label={startLabel?.(index) ?? 'Log this workout'} onPress={() => onStartDay(index)} />
            </View>
          ) : null}
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
  startRow: {
    marginTop: spacing.sm,
  },
  exerciseRow: {
    paddingVertical: spacing.sm,
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  exerciseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exerciseHeadLink: {
    cursor: 'pointer',
  },
  exerciseDose: {
    color: colors.text,
    fontWeight: '700',
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
