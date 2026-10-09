import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ExerciseListItem } from '@/components/ExerciseListItem';
import { useExerciseAlternatives } from '@/hooks/useExercises';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import type { Exercise } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

interface ExerciseAlternativesSheetProps {
  visible: boolean;
  exerciseId: string | null;
  exerciseName: string;
  onClose: () => void;
  /** What tapping an alternative does, e.g. swap it into the workout or open its page. */
  onPick: (exercise: Exercise) => void;
  /** One line under the title saying what a tap does. */
  hint: string;
}

/** Exercises that work the same muscles as this one — for a busy machine, missing equipment or a niggle. */
export function ExerciseAlternativesSheet({ visible, exerciseId, exerciseName, onClose, onPick, hint }: ExerciseAlternativesSheetProps) {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const { data, isPending, isError, refetch } = useExerciseAlternatives(exerciseId, { enabled: visible });

  return (
    <Modal visible={visible} transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, isDesktopWeb && styles.backdropCentered]} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, isDesktopWeb ? styles.dialog : { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        >
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.title}>Alternatives</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                to {exerciseName}
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.muted}>{hint}</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {isPending ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
            ) : isError ? (
              <Text style={styles.muted}>
                Couldn't load alternatives.{' '}
                <Text style={styles.link} onPress={() => refetch()} accessibilityRole="button">
                  Try again
                </Text>
              </Text>
            ) : data?.length ? (
              data.map((exercise) => <ExerciseListItem key={exercise.id} exercise={exercise} onPress={() => onPick(exercise)} />)
            ) : (
              <Text style={styles.muted}>No alternatives found for this exercise.</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdropCentered: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  dialog: { width: 520, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  link: { color: colors.primary, fontWeight: '700' },
  list: { flexGrow: 0 },
  listContent: { gap: spacing.sm, paddingTop: spacing.xs },
  loading: { paddingVertical: spacing.lg },
});
