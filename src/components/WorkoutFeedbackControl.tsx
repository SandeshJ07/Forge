import { StyleSheet, Text, View } from 'react-native';
import { useRateWorkout } from '@/hooks/useWorkouts';
import type { Workout } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const FELT_OPTIONS: { value: NonNullable<Workout['felt_rating']>; label: string }[] = [
  { value: 'too_easy', label: 'Too easy' },
  { value: 'just_right', label: 'Just right' },
  { value: 'too_hard', label: 'Too hard' },
];

export function WorkoutFeedbackControl({ workout }: { workout: Workout }) {
  const rateWorkout = useRateWorkout();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>How did it feel?</Text>
      <View style={styles.row}>
        {FELT_OPTIONS.map((option) => (
          <Text
            key={option.value}
            onPress={() =>
              rateWorkout.mutate({
                workoutId: workout.id,
                fields: {
                  felt_rating: option.value,
                  perceived_exertion: workout.perceived_exertion,
                  enjoyed: workout.enjoyed,
                  notes: workout.notes,
                },
              })
            }
            style={[styles.chip, workout.felt_rating === option.value && styles.chipActive]}
          >
            {option.label}
          </Text>
        ))}
        <Text
          onPress={() =>
            rateWorkout.mutate({
              workoutId: workout.id,
              fields: {
                felt_rating: workout.felt_rating,
                perceived_exertion: workout.perceived_exertion,
                enjoyed: !workout.enjoyed,
                notes: workout.notes,
              },
            })
          }
          style={[styles.chip, workout.enjoyed && styles.chipActive]}
        >
          {workout.enjoyed ? '❤️ Enjoyed' : '🤍 Enjoyed?'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  chipActive: {
    color: '#fff',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
