import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Select } from '@/components/ui/Select';
import { ExerciseListItem } from '@/components/ExerciseListItem';
import { useEquipmentOptions, useExerciseFeedbackMap, useExercises, useMuscleGroupOptions } from '@/hooks/useExercises';
import { humanize } from '@/lib/format';
import { colors, spacing } from '@/constants/theme';

export default function GlossaryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<string | undefined>();

  const filters = useMemo(
    () => ({ search: search.trim() || undefined, muscleGroup, equipment }),
    [search, muscleGroup, equipment]
  );

  const { data: exercises, isLoading } = useExercises(filters);
  const { data: muscleGroups } = useMuscleGroupOptions();
  const { data: equipmentOptions } = useEquipmentOptions();
  const { data: feedbackMap } = useExerciseFeedbackMap();

  const hasFilters = Boolean(search || muscleGroup || equipment);

  function clearFilters() {
    setSearch('');
    setMuscleGroup(undefined);
    setEquipment(undefined);
  }

  return (
    <ScreenContainer scroll={false} style={styles.container}>
      <ScreenHeader
        title="Exercises"
        subtitle={exercises ? `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}` : undefined}
      />

      <View>
        <TextField
          placeholder="Search by name, e.g. squat"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          style={styles.searchInput}
        />
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        {search ? (
          <Pressable
            onPress={() => setSearch('')}
            accessibilityLabel="Clear search"
            hitSlop={10}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        <Select
          label="Muscle"
          allLabel="All muscles"
          options={(muscleGroups ?? []).map((m) => ({ value: m, label: humanize(m) }))}
          value={muscleGroup}
          onChange={setMuscleGroup}
        />
        <Select
          label="Equipment"
          allLabel="All equipment"
          options={(equipmentOptions ?? []).map((e) => ({ value: e, label: humanize(e) }))}
          value={equipment}
          onChange={setEquipment}
        />
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
          isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No exercises match these filters.</Text>
              {hasFilters ? (
                <Text style={styles.clearLink} onPress={clearFilters} accessibilityRole="link">
                  Clear filters
                </Text>
              ) : null}
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm + 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchInput: {
    paddingLeft: 42,
    paddingRight: 40,
  },
  searchIcon: {
    position: 'absolute',
    left: spacing.md,
    top: 17,
  },
  clearButton: {
    position: 'absolute',
    right: spacing.md,
    top: 17,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  loading: {
    marginTop: spacing.xl,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  clearLink: {
    color: colors.primary,
    fontWeight: '600',
    cursor: 'pointer',
  },
});
