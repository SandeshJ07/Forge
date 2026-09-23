import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Exercise, ExerciseFeedbackRating } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

interface ExerciseListItemProps {
  exercise: Exercise;
  feedback?: ExerciseFeedbackRating;
  onPress: () => void;
}

const FEEDBACK_ICON: Record<ExerciseFeedbackRating, string> = {
  like: '👍',
  dislike: '👎',
  neutral: '',
};

export function ExerciseListItem({ exercise, feedback, onPress }: ExerciseListItemProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {exercise.media_url ? (
        <Image source={{ uri: exercise.media_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {exercise.muscle_groups.join(', ')} {exercise.equipment ? `· ${exercise.equipment}` : ''}
        </Text>
      </View>
      {feedback && feedback !== 'neutral' ? (
        <Text style={styles.feedbackIcon}>{FEEDBACK_ICON[feedback]}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
  },
  thumbnailPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  feedbackIcon: {
    fontSize: 18,
  },
});
