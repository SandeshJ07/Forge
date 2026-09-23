import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TextField } from '@/components/ui/TextField';
import { ExerciseListItem } from '@/components/ExerciseListItem';
import { useEquipmentOptions, useExerciseFeedbackMap, useExercises, useMuscleGroupOptions } from '@/hooks/useExercises';
import { colors, spacing } from '@/constants/theme';

export default function GlossaryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<string | undefined>();

  const filters = useMemo(
    () => ({ search: search || undefined, muscleGroup, equipment }),
    [search, muscleGroup, equipment]
  );

  const { data: exercises, isLoading } = useExercises(filters);
  const { data: muscleGroups } = useMuscleGroupOptions();
  const { data: equipmentOptions } = useEquipmentOptions();
  const { data: feedbackMap } = useExerciseFeedbackMap();

  return (
    <ScreenContainer scroll={false} style={styles.container}>
      <Text style={styles.heading}>Glossary</Text>
      <TextField placeholder="Search exercises" value={search} onChangeText={setSearch} />

      <View style={styles.chipsRow}>
        <FilterChip label="All muscles" active={!muscleGroup} onPress={() => setMuscleGroup(undefined)} />
        {(muscleGroups ?? []).slice(0, 8).map((m) => (
          <FilterChip key={m} label={m} active={muscleGroup === m} onPress={() => setMuscleGroup(m)} />
        ))}
      </View>

      <View style={styles.chipsRow}>
        <FilterChip label="All equipment" active={!equipment} onPress={() => setEquipment(undefined)} />
        {(equipmentOptions ?? []).slice(0, 8).map((e) => (
          <FilterChip key={e} label={e} active={equipment === e} onPress={() => setEquipment(e)} />
        ))}
      </View>

      <FlatList
        data={exercises ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExerciseListItem
            exercise={item}
            feedback={feedbackMap?.[item.id]}
            onPress={() => router.push(`/exercise/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.emptyText}>No exercises match these filters.</Text> : null
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    textTransform: 'capitalize',
    overflow: 'hidden',
  },
  chipActive: {
    color: '#fff',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
