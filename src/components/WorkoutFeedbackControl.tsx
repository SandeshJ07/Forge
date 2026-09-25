import { StyleSheet, Text, View } from 'react-native';
import { useRateWorkout } from '@/hooks/useWorkouts';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import type { Workout } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const FELT_OPTIONS: { value: NonNullable<Workout['felt_rating']>; label: string }[] = [
  { value: 'too_easy', label: 'Too easy' },
  { value: 'just_right', label: 'Just right' },
  { value: 'too_hard', label: 'Too hard' },
];

export function WorkoutFeedbackControl({ workout }: { workout: Workout }) {
  const rateWorkout = useRateWorkout();

  function rate(fields: Partial<Pick<Workout, 'felt_rating' | 'enjoyed'>>) {
    rateWorkout.mutate({
      workoutId: workout.id,
      fields: {
        felt_rating: workout.felt_rating,
        perceived_exertion: workout.perceived_exertion,
        enjoyed: workout.enjoyed,
        notes: workout.notes,
        ...fields,
      },
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>How did it feel?</Text>
      <ChipGroup>
        {FELT_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={workout.felt_rating === option.value}
            // Tapping the active rating again clears it.
            onPress={() => rate({ felt_rating: workout.felt_rating === option.value ? null : option.value })}
          />
        ))}
        <Chip
          label="Enjoyed it"
          icon={workout.enjoyed ? 'heart' : 'heart-outline'}
          selected={Boolean(workout.enjoyed)}
          onPress={() => rate({ enjoyed: !workout.enjoyed })}
        />
      </ChipGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
