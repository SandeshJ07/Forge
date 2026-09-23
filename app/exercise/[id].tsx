import { Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { useExercise, useExerciseFeedbackMap, useSetExerciseFeedback } from '@/hooks/useExercises';
import type { ExerciseFeedbackRating } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const FEEDBACK_OPTIONS: { rating: ExerciseFeedbackRating; label: string; icon: string }[] = [
  { rating: 'dislike', label: 'Dislike', icon: '👎' },
  { rating: 'neutral', label: 'Neutral', icon: '➖' },
  { rating: 'like', label: 'Like', icon: '👍' },
];

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: exercise, isLoading } = useExercise(id);
  const { data: feedbackMap } = useExerciseFeedbackMap();
  const setFeedback = useSetExerciseFeedback();

  const currentFeedback = id ? feedbackMap?.[id] : undefined;

  if (isLoading || !exercise) {
    return (
      <ScreenContainer>
        <Text style={styles.meta}>Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {exercise.media_url ? (
        <Image source={{ uri: exercise.media_url }} style={styles.media} resizeMode="cover" />
      ) : null}

      <Text style={styles.name}>{exercise.name}</Text>
      <Text style={styles.meta}>
        {exercise.muscle_groups.join(', ')}
        {exercise.equipment ? ` · ${exercise.equipment}` : ''}
        {exercise.difficulty ? ` · ${exercise.difficulty}` : ''}
      </Text>

      <Card style={styles.feedbackCard}>
        <Text style={styles.cardTitle}>How do you feel about this exercise?</Text>
        <View style={styles.feedbackRow}>
          {FEEDBACK_OPTIONS.map((option) => (
            <Text
              key={option.rating}
              onPress={() => setFeedback.mutate({ exerciseId: exercise.id, rating: option.rating })}
              style={[
                styles.feedbackButton,
                currentFeedback === option.rating && styles.feedbackButtonActive,
              ]}
            >
              {option.icon} {option.label}
            </Text>
          ))}
        </View>
      </Card>

      {exercise.secondary_muscle_groups?.length ? (
        <Card>
          <Text style={styles.cardTitle}>Secondary muscles</Text>
          <Text style={styles.bodyText}>{exercise.secondary_muscle_groups.join(', ')}</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Instructions</Text>
        {exercise.instructions.map((step, index) => (
          <Text key={index} style={styles.stepText}>
            {index + 1}. {step}
          </Text>
        ))}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  media: {
    width: '100%',
    height: 240,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    textTransform: 'capitalize',
  },
  feedbackCard: {
    gap: spacing.sm,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  feedbackButton: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    overflow: 'hidden',
  },
  feedbackButtonActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: 14,
    textTransform: 'capitalize',
  },
  stepText: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
});
