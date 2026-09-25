import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { PlanPayload } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { formatWeekdays, planGroups, todayWeekday } from '@/lib/planGroups';
import { colors, radii, spacing } from '@/constants/theme';

interface PlanViewProps {
  plan: PlanPayload;
  /** Shows a compact per-group "Start workout" button when provided. */
  onStartGroup?: (groupIndex: number) => void;
  /** Label for that button, e.g. "Resume workout" while a session is running. */
  startLabel?: (groupIndex: number) => string;
}

/** A plan's exercise groups. */
export function PlanView({ plan, onStartGroup, startLabel }: PlanViewProps) {
  const router = useRouter();
  const today = todayWeekday();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{plan.title}</Text>
      <Text style={styles.rationale}>{plan.rationale}</Text>

      {planGroups(plan).map((day, index) => (
        <View key={index} style={styles.dayCard}>
          <View style={styles.groupHead}>
            <Text style={styles.dayLabel}>{day.name}</Text>
            <View style={[styles.dayBadge, day.weekdays.includes(today) && styles.dayBadgeToday]}>
              <Text style={[styles.dayBadgeText, day.weekdays.includes(today) && styles.dayBadgeTextToday]}>
                {formatWeekdays(day.weekdays) ?? 'Any day'}
              </Text>
            </View>
          </View>
          {day.focus ? <Text style={styles.dayFocus}>{day.focus}</Text> : null}

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

          {onStartGroup ? (
            <View style={styles.startRow}>
              <Button label={startLabel?.(index) ?? 'Start workout'} size="small" onPress={() => onStartGroup(index)} />
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
    flexShrink: 1,
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
    marginTop: spacing.xs,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
  },
  dayBadgeToday: {
    backgroundColor: colors.primaryMuted,
  },
  dayBadgeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  dayBadgeTextToday: {
    color: colors.primary,
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
