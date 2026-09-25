import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Exercise, ExerciseFeedbackRating } from '@/types/database';
import { humanize } from '@/lib/format';
import { colors, radii, spacing } from '@/constants/theme';

interface ExerciseListItemProps {
  exercise: Exercise;
  feedback?: ExerciseFeedbackRating;
  onPress: () => void;
}


export function ExerciseListItem({ exercise, feedback, onPress }: ExerciseListItemProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, styles.hoverable, pressed && styles.pressed]}>
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
          {exercise.muscle_groups.map(humanize).join(', ')}
          {exercise.equipment ? ` · ${humanize(exercise.equipment)}` : ''}
        </Text>
      </View>
      {feedback === 'like' ? <Ionicons name="thumbs-up" size={16} color={colors.success} /> : null}
      {feedback === 'dislike' ? <Ionicons name="thumbs-down" size={16} color={colors.textMuted} /> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
  hoverable: {
    cursor: 'pointer',
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
  },
});
