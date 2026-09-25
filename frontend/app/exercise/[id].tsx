import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { useExercise, useExerciseFeedbackMap, useSetExerciseFeedback } from '@/hooks/useExercises';
import type { ExerciseFeedbackRating } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const FEEDBACK_OPTIONS: {
  rating: ExerciseFeedbackRating;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { rating: 'dislike', label: 'Avoid', icon: 'thumbs-down-outline', iconActive: 'thumbs-down' },
  { rating: 'neutral', label: 'Neutral', icon: 'remove-circle-outline', iconActive: 'remove-circle' },
  { rating: 'like', label: 'Like', icon: 'thumbs-up-outline', iconActive: 'thumbs-up' },
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
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
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
        <Text style={styles.cardTitle}>Include this in your plans?</Text>
        <Text style={styles.cardHint}>Liked exercises are favoured when your plan is generated; avoided ones are left out.</Text>
        <View style={styles.feedbackRow}>
          {FEEDBACK_OPTIONS.map((option) => {
            const active = currentFeedback === option.rating;
            return (
              <Pressable
                key={option.rating}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFeedback.mutate({ exerciseId: exercise.id, rating: option.rating })}
                style={[styles.feedbackButton, active && styles.feedbackButtonActive]}
              >
                <Ionicons
                  name={active ? option.iconActive : option.icon}
                  size={18}
                  color={active ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.feedbackLabel, active && styles.feedbackLabelActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
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
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  media: {
    width: '100%',
    aspectRatio: 16 / 10,
    maxHeight: 380,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    cursor: 'pointer',
  },
  feedbackLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackLabelActive: {
    color: colors.text,
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
  cardHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -spacing.xs,
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
