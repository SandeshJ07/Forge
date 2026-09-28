import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { ExerciseListItem } from '@/components/ExerciseListItem';
import { useExercises } from '@/hooks/useExercises';
import { useCreateCustomPlan, useLatestPlan, useUpdatePlanContent } from '@/hooks/usePlans';
import { planGroups, WEEKDAY_ORDER, WEEKDAY_SHORT } from '@/lib/planGroups';
import { ApiError } from '@/lib/apiClient';
import type { CustomPlanInput, PlanExercise, PlanGroup, PlanPayload, WarmupExercise, Weekday } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const MIN_SEARCH_CHARS = 2;
const SEARCH_RESULT_LIMIT = 12;
const MAX_GROUPS = 14;
const MAX_EXERCISES = 30;

interface DraftExercise {
  key: string;
  name: string;
  sets: string;
  reps: string;
  rest: string; // seconds
  notes?: string;
  /** When editing: the plan's exercise, so fields this screen doesn't show (cues, intensity…) are kept. */
  base?: PlanExercise;
}

interface DraftGroup {
  key: string;
  name: string;
  focus: string;
  weekdays: Weekday[];
  warmup: WarmupExercise[];
  exercises: DraftExercise[];
  base?: PlanGroup;
}

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function draftExercise(name: string): DraftExercise {
  return { key: newKey(), name, sets: '3', reps: '8-12', rest: '90' };
}

function emptyGroup(index: number): DraftGroup {
  return { key: newKey(), name: `Day ${String.fromCharCode(65 + index)}`, focus: '', weekdays: [], warmup: [], exercises: [] };
}

function fromPlanGroup(group: PlanGroup): DraftGroup {
  return {
    key: newKey(),
    name: group.name,
    focus: group.focus ?? '',
    weekdays: group.weekdays ?? [],
    warmup: group.warmup ?? [],
    base: group,
    exercises: group.exercises.map((e) => ({
      base: e,
      key: newKey(),
      name: e.exercise_name,
      sets: String(e.sets),
      reps: e.reps,
      rest: String(e.rest_seconds),
      notes: e.notes,
    })),
  };
}

/** Checks the draft and turns it into the request body, or explains what's missing. */
function toInput(title: string, groups: DraftGroup[]): CustomPlanInput | string {
  if (!title.trim()) return 'Give your plan a name.';
  if (!groups.length) return 'Add at least one group.';
  const out: CustomPlanInput['groups'] = [];
  for (const g of groups) {
    const label = g.name.trim() || 'a group';
    if (!g.name.trim()) return 'Every group needs a name.';
    if (!g.exercises.length) return `Add at least one exercise to ${label}.`;
    const exercises: CustomPlanInput['groups'][number]['exercises'] = [];
    for (const e of g.exercises) {
      const sets = Number(e.sets);
      const rest = Number(e.rest);
      if (!Number.isInteger(sets) || sets < 1 || sets > 20) return `${e.name} in ${label}: sets must be 1–20.`;
      if (!e.reps.trim()) return `${e.name} in ${label}: enter the reps, e.g. 8-12.`;
      if (!Number.isInteger(rest) || rest < 0 || rest > 900) return `${e.name} in ${label}: rest must be 0–900 seconds.`;
      exercises.push({ exercise_name: e.name, sets, reps: e.reps.trim(), rest_seconds: rest, ...(e.notes ? { notes: e.notes } : {}) });
    }
    out.push({
      name: g.name.trim(),
      focus: g.focus.trim(),
      weekdays: g.weekdays,
      warmup: g.warmup.map((w) => ({ exercise_name: w.exercise_name, duration_or_reps: w.duration_or_reps ?? '' })),
      exercises,
    });
  }
  return { title: title.trim(), groups: out };
}

/**
 * The edited plan in full, for saving over the current one: each group and
 * exercise keeps everything this screen doesn't edit. An exercise whose name
 * changed loses its old link and cues; the server re-links it by name.
 */
function toPlanPayload(original: PlanPayload, groups: DraftGroup[], input: CustomPlanInput): PlanPayload {
  return {
    ...original,
    title: input.title,
    days: undefined,
    groups: input.groups.map((g, gi) => {
      const draft = groups[gi];
      return {
        ...(draft.base ?? {}),
        name: g.name,
        focus: g.focus,
        weekdays: g.weekdays,
        warmup: draft.warmup,
        exercises: g.exercises.map((e, ei) => {
          const base = draft.exercises[ei].base;
          const kept = base && base.exercise_name === e.exercise_name ? base : { exercise_id: null };
          return { ...kept, ...e };
        }),
      };
    }),
  };
}

/**
 * Build a plan by hand — no AI. Groups of exercises, each optionally mapped to
 * weekdays (one group per weekday), just like an AI plan. With ?from=latest it
 * starts from the current plan; saving always creates a new plan version.
 */
export default function CustomPlanScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const editing = from === 'latest';
  const { data: latestPlan } = useLatestPlan();
  const createPlan = useCreateCustomPlan();
  const updatePlan = useUpdatePlanContent();

  const [title, setTitle] = useState('My plan');
  const [groups, setGroups] = useState<DraftGroup[]>(() => [emptyGroup(0)]);
  const [searchGroup, setSearchGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (!editing || prefilled.current || !latestPlan) return;
    prefilled.current = true;
    setTitle(latestPlan.plan.title);
    const existing = planGroups(latestPlan.plan);
    if (existing.length) setGroups(existing.map(fromPlanGroup));
  }, [editing, latestPlan]);

  const query = search.trim();
  const { data: results, isFetching: searching } = useExercises(
    { search: query || undefined },
    { enabled: Boolean(searchGroup) && query.length >= MIN_SEARCH_CHARS }
  );

  function updateGroup(key: string, fn: (g: DraftGroup) => DraftGroup) {
    setGroups((gs) => gs.map((g) => (g.key === key ? fn(g) : g)));
    setErrorMessage(null);
  }

  function updateExercise(groupKey: string, exKey: string, patch: Partial<DraftExercise>) {
    updateGroup(groupKey, (g) => ({ ...g, exercises: g.exercises.map((e) => (e.key === exKey ? { ...e, ...patch } : e)) }));
  }

  function moveExercise(groupKey: string, index: number, delta: number) {
    updateGroup(groupKey, (g) => {
      const target = index + delta;
      if (target < 0 || target >= g.exercises.length) return g;
      const exercises = [...g.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...g, exercises };
    });
  }

  function toggleWeekday(groupKey: string, day: Weekday) {
    updateGroup(groupKey, (g) => ({
      ...g,
      weekdays: g.weekdays.includes(day)
        ? g.weekdays.filter((d) => d !== day)
        : WEEKDAY_ORDER.filter((d) => d === day || g.weekdays.includes(d)),
    }));
  }

  function addExercise(groupKey: string, name: string) {
    updateGroup(groupKey, (g) => ({ ...g, exercises: [...g.exercises, draftExercise(name)] }));
    setSearch('');
    setSearchGroup(null);
  }

  function openSearch(groupKey: string) {
    setSearch('');
    setSearchGroup(groupKey);
  }

  async function handleSave() {
    const input = toInput(title, groups);
    if (typeof input === 'string') {
      setErrorMessage(input);
      return;
    }
    setErrorMessage(null);
    try {
      if (editing && latestPlan) {
        await updatePlan.mutateAsync({ planId: latestPlan.id, plan: toPlanPayload(latestPlan.plan, groups, input) });
      } else {
        await createPlan.mutateAsync(input);
      }
      // Back to the Plan tab (already under this screen), which now shows the new plan.
      if (router.canGoBack()) router.back();
      else router.replace('/plan');
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not save the plan. Please try again.');
    }
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: editing ? 'Edit plan' : 'Build your plan' }} />
      <Text style={styles.intro}>
        {editing
          ? 'Change groups, days, exercises, sets, reps and rest. Your changes are saved to your current plan.'
          : 'Make your own exercise groups — like Push, Pull and Legs — and map each to the days you train. Groups for today are suggested when you log a workout.'}
      </Text>

      <TextField label="Plan name" value={title} onChangeText={setTitle} maxLength={80} />

      {groups.map((group, groupIndex) => {
        const takenElsewhere = new Set(groups.filter((g) => g.key !== group.key).flatMap((g) => g.weekdays));
        const searchingHere = searchGroup === group.key;
        return (
          <Card key={group.key} style={styles.groupCard}>
            <View style={styles.groupHead}>
              <Text style={styles.groupEyebrow}>Group {groupIndex + 1}</Text>
              {groups.length > 1 ? (
                <Pressable
                  onPress={() => setGroups((gs) => gs.filter((g) => g.key !== group.key))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${group.name || 'group'}`}
                  hitSlop={8}
                  style={styles.iconButton}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField
                  label="Name"
                  placeholder="e.g. Push"
                  value={group.name}
                  onChangeText={(name) => updateGroup(group.key, (g) => ({ ...g, name }))}
                  maxLength={60}
                />
              </View>
              <View style={styles.flex}>
                <TextField
                  label="Focus (optional)"
                  placeholder="e.g. Chest, Triceps"
                  value={group.focus}
                  onChangeText={(focus) => updateGroup(group.key, (g) => ({ ...g, focus }))}
                  maxLength={120}
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Days</Text>
              <ChipGroup>
                {WEEKDAY_ORDER.map((day) => (
                  <Chip
                    key={day}
                    label={WEEKDAY_SHORT[day]}
                    showCheck
                    selected={group.weekdays.includes(day)}
                    disabled={takenElsewhere.has(day)}
                    onPress={() => toggleWeekday(group.key, day)}
                  />
                ))}
              </ChipGroup>
              <Text style={styles.hint}>
                {group.weekdays.length ? 'Suggested on these days.' : 'No days — load it whenever you like.'}
                {takenElsewhere.size ? ' Days used by another group are greyed out.' : ''}
              </Text>
            </View>

            {group.warmup.length ? (
              <View style={styles.warmup}>
                <View style={styles.groupHead}>
                  <Text style={styles.warmupLabel}>Warm-up</Text>
                  <Text
                    style={styles.smallLink}
                    onPress={() => updateGroup(group.key, (g) => ({ ...g, warmup: [] }))}
                    accessibilityRole="button"
                  >
                    Remove
                  </Text>
                </View>
                {group.warmup.map((w, i) => (
                  <Text key={i} style={styles.muted}>
                    • {w.exercise_name}
                    {w.duration_or_reps ? ` — ${w.duration_or_reps}` : ''}
                  </Text>
                ))}
              </View>
            ) : null}

            {group.exercises.map((ex, exIndex) => (
              <View key={ex.key} style={styles.exercise}>
                <View style={styles.exerciseHead}>
                  <Text style={styles.exerciseName} numberOfLines={2}>
                    {ex.name}
                  </Text>
                  <IconButton
                    icon="chevron-up"
                    label={`Move ${ex.name} up`}
                    disabled={exIndex === 0}
                    onPress={() => moveExercise(group.key, exIndex, -1)}
                  />
                  <IconButton
                    icon="chevron-down"
                    label={`Move ${ex.name} down`}
                    disabled={exIndex === group.exercises.length - 1}
                    onPress={() => moveExercise(group.key, exIndex, 1)}
                  />
                  <IconButton
                    icon="close"
                    label={`Remove ${ex.name}`}
                    onPress={() => updateGroup(group.key, (g) => ({ ...g, exercises: g.exercises.filter((e) => e.key !== ex.key) }))}
                  />
                </View>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <TextField
                      label="Sets"
                      value={ex.sets}
                      onChangeText={(sets) => updateExercise(group.key, ex.key, { sets: sets.replace(/\D/g, '') })}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={styles.smallInput}
                    />
                  </View>
                  <View style={styles.flex}>
                    <TextField
                      label="Reps"
                      value={ex.reps}
                      onChangeText={(reps) => updateExercise(group.key, ex.key, { reps })}
                      placeholder="8-12"
                      maxLength={20}
                      style={styles.smallInput}
                    />
                  </View>
                  <View style={styles.flex}>
                    <TextField
                      label="Rest (sec)"
                      value={ex.rest}
                      onChangeText={(rest) => updateExercise(group.key, ex.key, { rest: rest.replace(/\D/g, '') })}
                      keyboardType="number-pad"
                      maxLength={3}
                      style={styles.smallInput}
                    />
                  </View>
                </View>
              </View>
            ))}

            {searchingHere ? (
              <View style={styles.searchBox}>
                <View style={styles.groupHead}>
                  <Text style={styles.fieldLabel}>Add an exercise</Text>
                  <Text style={styles.smallLink} onPress={() => setSearchGroup(null)} accessibilityRole="button">
                    Cancel
                  </Text>
                </View>
                <TextField
                  placeholder="Search exercises, e.g. bench press"
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                  autoCorrect={false}
                  accessibilityLabel="Search exercises"
                />
                {query.length < MIN_SEARCH_CHARS ? null : (
                  <>
                    {searching && !results ? <Text style={styles.muted}>Searching…</Text> : null}
                    {(results ?? []).slice(0, SEARCH_RESULT_LIMIT).map((exercise) => (
                      <ExerciseListItem key={exercise.id} exercise={exercise} onPress={() => addExercise(group.key, exercise.name)} />
                    ))}
                    {results && !results.length ? <Text style={styles.muted}>No exercises match “{query}”.</Text> : null}
                    <Pressable
                      onPress={() => addExercise(group.key, query)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.customAdd, pressed && styles.pressed]}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                      <Text style={styles.customAddText} numberOfLines={1}>
                        Add “{query}” as your own exercise
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : group.exercises.length < MAX_EXERCISES ? (
              <Button
                label="+ Add exercise"
                variant={group.exercises.length ? 'secondary' : 'primary'}
                size="small"
                onPress={() => openSearch(group.key)}
              />
            ) : null}
          </Card>
        );
      })}

      {groups.length < MAX_GROUPS ? (
        <Button label="+ Add another group" variant="secondary" onPress={() => setGroups((gs) => [...gs, emptyGroup(gs.length)])} />
      ) : null}

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </Card>
      ) : null}

      <Button
        label={editing ? 'Save changes' : 'Save plan'}
        onPress={handleSave}
        loading={createPlan.isPending || updatePlan.isPending}
        disabled={editing && !latestPlan}
      />
    </ScreenContainer>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  groupCard: { gap: spacing.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  groupEyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBlock: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  hint: { color: colors.textMuted, fontSize: 12 },
  muted: { color: colors.textMuted, fontSize: 13 },
  warmup: { backgroundColor: colors.background, borderRadius: radii.sm, padding: spacing.sm, gap: 2 },
  warmupLabel: { color: colors.warning, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  exercise: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  exerciseName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  smallInput: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, fontSize: 15 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.7 },
  smallLink: { color: colors.primary, fontSize: 13, fontWeight: '600', cursor: 'pointer' },
  searchBox: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  customAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    cursor: 'pointer',
  },
  customAddText: { flex: 1, color: colors.primary, fontSize: 14, fontWeight: '600' },
  errorCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderColor: 'rgba(255,92,92,0.35)' },
  errorText: { flex: 1, color: colors.danger, fontSize: 14 },
});
