import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Exercise, PlanExercise, PlanGroup, PlanPayload } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ExerciseListItem } from '@/components/ExerciseListItem';
import { useExercises } from '@/hooks/useExercises';
import { formatWeekdays, planGroups, todayWeekday } from '@/lib/planGroups';
import { TRACKING_FIELDS } from '@/lib/tracking';
import { colors, radii, spacing } from '@/constants/theme';

const MIN_SEARCH_CHARS = 2;

interface PlanViewProps {
  plan: PlanPayload;
  /** Shows a compact per-group "Start workout" button when provided. */
  onStartGroup?: (groupIndex: number) => void;
  /** Label for that button, e.g. "Resume workout" while a session is running. */
  startLabel?: (groupIndex: number) => string;
  /** Edit mode: sets, reps, rest, order, and adding/removing exercises. Called with the whole edited plan. */
  onChange?: (plan: PlanPayload) => void;
}

function formatRest(seconds: number): string {
  return seconds >= 60 && seconds % 30 === 0 ? `${seconds / 60} min` : `${seconds}s`;
}

/** A plan's exercise groups; editable when onChange is given. */
export function PlanView({ plan, onStartGroup, startLabel, onChange }: PlanViewProps) {
  const router = useRouter();
  const today = todayWeekday();
  const groups = planGroups(plan);
  const editing = Boolean(onChange);

  function updateGroup(groupIndex: number, fn: (group: PlanGroup) => PlanGroup) {
    const next = groups.map((g, i) => (i === groupIndex ? fn(g) : g));
    // Edits always save in the groups shape (older per-day plans are converted on the way).
    onChange?.({ ...plan, groups: next, days: undefined });
  }

  function updateExercise(groupIndex: number, exerciseIndex: number, patch: Partial<PlanExercise>) {
    updateGroup(groupIndex, (g) => ({
      ...g,
      exercises: g.exercises.map((e, i) => (i === exerciseIndex ? { ...e, ...patch } : e)),
    }));
  }

  function moveExercise(groupIndex: number, exerciseIndex: number, delta: -1 | 1) {
    updateGroup(groupIndex, (g) => {
      const to = exerciseIndex + delta;
      if (to < 0 || to >= g.exercises.length) return g;
      const exercises = [...g.exercises];
      [exercises[exerciseIndex], exercises[to]] = [exercises[to], exercises[exerciseIndex]];
      return { ...g, exercises };
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{plan.title}</Text>
      <Text style={styles.rationale}>{plan.rationale}</Text>
      {plan.progression ? (
        <View style={styles.progression}>
          <Ionicons name="trending-up" size={16} color={colors.primary} />
          <Text style={styles.progressionText}>{plan.progression}</Text>
        </View>
      ) : null}

      {groups.map((day, index) => (
        <View key={index} style={styles.dayCard}>
          <View style={styles.groupHead}>
            <Text style={styles.dayLabel}>{day.name}</Text>
            <View style={[styles.dayBadge, day.weekdays.includes(today) && styles.dayBadgeToday]}>
              <Text style={[styles.dayBadgeText, day.weekdays.includes(today) && styles.dayBadgeTextToday]}>
                {formatWeekdays(day.weekdays) ?? 'Any day'}
              </Text>
            </View>
          </View>
          {day.focus || day.estimated_minutes ? (
            <Text style={styles.dayFocus}>
              {[day.focus, day.estimated_minutes ? `~${day.estimated_minutes} min` : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          {day.warmup?.length ? (
            <View style={styles.warmupSection}>
              <Text style={styles.warmupLabel}>Warm-up</Text>
              {day.warmup.map((item, warmupIndex) => (
                <View key={warmupIndex} style={styles.warmupRow}>
                  <View style={styles.flex}>
                    <Pressable
                      disabled={!item.exercise_id || editing}
                      accessibilityRole={item.exercise_id && !editing ? 'link' : undefined}
                      onPress={() => router.push(`/exercise/${item.exercise_id}`)}
                      style={item.exercise_id && !editing ? styles.linkCursor : null}
                    >
                      <Text style={styles.warmupItem}>
                        <Text style={styles.warmupName}>{item.exercise_name}</Text> — {item.duration_or_reps}
                      </Text>
                    </Pressable>
                    {item.how_to ? <Text style={styles.howTo}>{item.how_to}</Text> : null}
                    {item.notes ? <Text style={styles.exerciseNotes}>{item.notes}</Text> : null}
                  </View>
                  {editing ? (
                    <IconButton
                      icon="close"
                      label={`Remove ${item.exercise_name} from the warm-up`}
                      onPress={() => updateGroup(index, (g) => ({ ...g, warmup: g.warmup.filter((_, i) => i !== warmupIndex) }))}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {day.exercises.map((exercise, exerciseIndex) => (
            <View key={exerciseIndex} style={styles.exerciseRow}>
              <View style={styles.exerciseTop}>
                <Pressable
                  disabled={!exercise.exercise_id || editing}
                  accessibilityRole={exercise.exercise_id && !editing ? 'link' : undefined}
                  onPress={() => router.push(`/exercise/${exercise.exercise_id}`)}
                  style={[styles.exerciseHead, exercise.exercise_id && !editing ? styles.linkCursor : null]}
                >
                  <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                  {exercise.exercise_id && !editing ? (
                    <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                  ) : null}
                </Pressable>
                {editing ? (
                  <View style={styles.editActions}>
                    <IconButton
                      icon="chevron-up"
                      label={`Move ${exercise.exercise_name} up`}
                      disabled={exerciseIndex === 0}
                      onPress={() => moveExercise(index, exerciseIndex, -1)}
                    />
                    <IconButton
                      icon="chevron-down"
                      label={`Move ${exercise.exercise_name} down`}
                      disabled={exerciseIndex === day.exercises.length - 1}
                      onPress={() => moveExercise(index, exerciseIndex, 1)}
                    />
                    <IconButton
                      icon="trash-outline"
                      label={`Remove ${exercise.exercise_name}`}
                      danger
                      onPress={() =>
                        updateGroup(index, (g) => ({ ...g, exercises: g.exercises.filter((_, i) => i !== exerciseIndex) }))
                      }
                    />
                  </View>
                ) : null}
              </View>

              {editing ? (
                <ExerciseEditor exercise={exercise} onChange={(patch) => updateExercise(index, exerciseIndex, patch)} />
              ) : (
                <Text style={styles.exerciseMeta}>
                  <Text style={styles.exerciseDose}>
                    {exercise.sets} × {exercise.reps}
                  </Text>
                  {exercise.intensity ? `  ·  ${exercise.intensity}` : ''}
                  {exercise.rest_seconds ? `  ·  rest ${formatRest(exercise.rest_seconds)}` : ''}
                </Text>
              )}
              {exercise.how_to ? <Text style={styles.howTo}>{exercise.how_to}</Text> : null}
              {exercise.notes ? <Text style={styles.exerciseNotes}>{exercise.notes}</Text> : null}
            </View>
          ))}

          {editing ? (
            <AddExercise
              onAdd={(e) =>
                updateGroup(index, (g) => ({
                  ...g,
                  exercises: [
                    ...g.exercises,
                    {
                      exercise_id: e.id,
                      exercise_name: e.name,
                      tracking: e.tracking_type,
                      sets: TRACKING_FIELDS[e.tracking_type].time ? 1 : 3,
                      reps: TRACKING_FIELDS[e.tracking_type].time ? (e.tracking_type === 'duration' ? '45 s' : '20 min') : '8-12',
                      rest_seconds: 90,
                    },
                  ],
                }))
              }
            />
          ) : null}

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

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.iconButton, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.text} />
    </Pressable>
  );
}

/** Sets stepper plus target and rest inputs for one exercise in edit mode. */
function ExerciseEditor({ exercise, onChange }: { exercise: PlanExercise; onChange: (patch: Partial<PlanExercise>) => void }) {
  return (
    <View style={styles.editorRow}>
      <View style={styles.editorField}>
        <Text style={styles.editorLabel}>Sets</Text>
        <View style={styles.stepper}>
          <IconButton
            icon="remove"
            label={`Fewer sets of ${exercise.exercise_name}`}
            disabled={exercise.sets <= 1}
            onPress={() => onChange({ sets: Math.max(1, exercise.sets - 1) })}
          />
          <Text style={styles.stepperValue}>{exercise.sets}</Text>
          <IconButton
            icon="add"
            label={`More sets of ${exercise.exercise_name}`}
            disabled={exercise.sets >= 10}
            onPress={() => onChange({ sets: Math.min(10, exercise.sets + 1) })}
          />
        </View>
      </View>
      <View style={[styles.editorField, styles.flex]}>
        <Text style={styles.editorLabel}>Target</Text>
        <TextInput
          value={exercise.reps}
          onChangeText={(reps) => onChange({ reps })}
          placeholder="8-12"
          placeholderTextColor={colors.textMuted}
          style={styles.editorInput}
          accessibilityLabel={`${exercise.exercise_name} target reps or time`}
        />
      </View>
      <View style={styles.editorField}>
        <Text style={styles.editorLabel}>Rest (s)</Text>
        <TextInput
          value={String(exercise.rest_seconds ?? '')}
          onChangeText={(v) => onChange({ rest_seconds: Math.min(600, Number(v.replace(/\D/g, '')) || 0) })}
          keyboardType="number-pad"
          placeholder="90"
          placeholderTextColor={colors.textMuted}
          style={[styles.editorInput, styles.restInput]}
          accessibilityLabel={`${exercise.exercise_name} rest in seconds`}
        />
      </View>
    </View>
  );
}

function AddExercise({ onAdd }: { onAdd: (exercise: Exercise) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = search.trim();
  const { data: results, isFetching } = useExercises(
    { search: query || undefined },
    { enabled: open && query.length >= MIN_SEARCH_CHARS }
  );

  if (!open) {
    return (
      <Text style={styles.addLink} onPress={() => setOpen(true)} accessibilityRole="button">
        + Add exercise
      </Text>
    );
  }
  return (
    <View style={styles.addBox}>
      <View style={styles.exerciseTop}>
        <View style={styles.flex}>
          <TextField
            placeholder="Search exercises"
            value={search}
            onChangeText={setSearch}
            autoFocus
            autoCorrect={false}
            accessibilityLabel="Search exercises to add"
          />
        </View>
        <Text style={styles.cancelLink} onPress={() => { setOpen(false); setSearch(''); }} accessibilityRole="button">
          Cancel
        </Text>
      </View>
      {query.length < MIN_SEARCH_CHARS ? null : isFetching && !results ? (
        <Text style={styles.exerciseMeta}>Searching…</Text>
      ) : results?.length ? (
        results.slice(0, 8).map((e) => (
          <ExerciseListItem
            key={e.id}
            exercise={e}
            onPress={() => {
              onAdd(e);
              setOpen(false);
              setSearch('');
            }}
          />
        ))
      ) : (
        <Text style={styles.exerciseMeta}>No exercises match “{query}”.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: spacing.md },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  rationale: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  progression: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryMuted,
  },
  progressionText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 },
  dayCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  dayLabel: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  dayFocus: { color: colors.primary, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  warmupSection: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  warmupLabel: { color: colors.warning, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  warmupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  warmupItem: { color: colors.textMuted, fontSize: 13 },
  warmupName: { color: colors.text, fontWeight: '600' },
  howTo: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  startRow: { marginTop: spacing.xs },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dayBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, backgroundColor: colors.background },
  dayBadgeToday: { backgroundColor: colors.primaryMuted },
  dayBadgeText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  dayBadgeTextToday: { color: colors.primary },
  exerciseRow: { paddingVertical: spacing.sm, gap: 3, borderTopWidth: 1, borderTopColor: colors.border },
  exerciseTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseName: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  exerciseHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkCursor: { cursor: 'pointer' },
  exerciseDose: { color: colors.text, fontWeight: '700' },
  exerciseMeta: { color: colors.textMuted, fontSize: 13 },
  exerciseNotes: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  editActions: { flexDirection: 'row', gap: 4 },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  disabled: { opacity: 0.35 },
  editorRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: 4 },
  editorField: { gap: 4 },
  editorLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38 },
  stepperValue: { color: colors.text, fontSize: 15, fontWeight: '700', minWidth: 18, textAlign: 'center' },
  editorInput: {
    height: 38,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 15,
    minWidth: 0,
  },
  restInput: { width: 64, textAlign: 'center' },
  addLink: { color: colors.primary, fontSize: 14, fontWeight: '600', paddingVertical: spacing.xs, cursor: 'pointer' },
  addBox: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  cancelLink: { color: colors.textMuted, fontSize: 14, fontWeight: '600', cursor: 'pointer' },
});
