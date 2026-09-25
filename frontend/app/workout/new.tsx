import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { ExerciseListItem } from '@/components/ExerciseListItem';
import { formatClock, useNow } from '@/components/WorkoutSessionOverlay';
import { useExercises } from '@/hooks/useExercises';
import { useLatestPlan } from '@/hooks/usePlans';
import { useLogManualWorkout } from '@/hooks/useWorkouts';
import { usePersonalRecords } from '@/hooks/usePersonalRecords';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { useUnitStore } from '@/stores/useUnitStore';
import { useWorkoutSessionStore, type SessionExercise } from '@/stores/useWorkoutSessionStore';
import { primeRestChime } from '@/lib/restChime';
import { formatWeight, LB_PER_KG } from '@/lib/format';
import { ApiError } from '@/lib/apiClient';
import type { PlanDay } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const MIN_SEARCH_CHARS = 2;
const SEARCH_RESULT_LIMIT = 20;
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseNumber(value: string): number | null {
  const n = Number(value.trim().replace(',', '.'));
  return value.trim() && Number.isFinite(n) ? n : null;
}

function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** The plan group mapped to today's weekday ("Monday - Push" on a Monday), if the plan has one. */
function todaysGroupIndex(days: PlanDay[]): number {
  const today = WEEKDAY_NAMES[new Date().getDay()];
  return days.findIndex((d) => d.day_label.trim().toLowerCase().startsWith(today));
}

/**
 * The one place to log a workout: add exercises by search, take today's plan
 * suggestions, or load a whole plan group; tick sets off with a rest timer
 * between them. Progress lives in useWorkoutSessionStore, so it survives
 * leaving the screen or reloading.
 */
export default function LogWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const unitSystem = useUnitStore((s) => s.unitSystem);
  const weightUnit = unitSystem === 'imperial' ? 'lb' : 'kg';
  const now = useNow(500);

  const session = useWorkoutSessionStore((s) => s.session);
  const store = useWorkoutSessionStore();
  const { data: latestPlan } = useLatestPlan();
  const { data: records } = usePersonalRecords();
  const logWorkout = useLogManualWorkout();

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [summary, setSummary] = useState<{ sets: number; duration: number | null; prs: string[] } | null>(null);

  const query = search.trim();
  const { data: results, isFetching: searching } = useExercises(
    { search: query || undefined },
    { enabled: searchOpen && query.length >= MIN_SEARCH_CHARS }
  );

  const bestByExercise = useMemo(
    () => new Map((records ?? []).map((r) => [r.exercise_id, Number(r.best_weight_kg)])),
    [records]
  );

  const exercises = session?.exercises ?? [];
  const addedNames = new Set(exercises.map((e) => e.name.toLowerCase()));
  const planDays = latestPlan?.plan.days ?? [];
  const todayIndex = latestPlan ? todaysGroupIndex(planDays) : -1;
  const todayGroup = todayIndex >= 0 ? planDays[todayIndex] : null;
  const todayGroupLoaded = Boolean(latestPlan && session?.loadedGroups.includes(`${latestPlan.id}:${todayIndex}`));
  const showSuggestions = todayGroup && !todayGroupLoaded && todayGroup.exercises.some((e) => !addedNames.has(e.exercise_name.toLowerCase()));

  const date = session?.date ?? now;
  const loggingToday = isSameDay(date, now);
  const elapsed = session && exercises.length ? (now - session.startedAt) / 1000 : 0;
  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const rest = session?.rest ?? null;
  const restRemaining = rest ? (rest.endsAt - now) / 1000 : 0;

  function addFromSearch(exerciseId: string, name: string) {
    store.addExercise({ exerciseId, name, sets: 3 });
    setSearch('');
    setSearchOpen(false);
  }

  function loadGroup(dayIndex: number) {
    if (!latestPlan) return;
    store.addPlanGroup(latestPlan.id, dayIndex, planDays[dayIndex]);
    setGroupsOpen(false);
  }

  async function handleSave() {
    if (!session) return;
    setErrorMessage(null);
    const sets = session.exercises.flatMap((ex) =>
      ex.sets
        .filter((s) => s.done || s.weight.trim() || s.reps.trim())
        .map((s) => {
          const weight = parseNumber(s.weight);
          const reps = parseNumber(s.reps);
          return {
            exerciseId: ex.exerciseId,
            exerciseName: ex.name,
            weightKg: weight === null ? null : unitSystem === 'imperial' ? weight / LB_PER_KG : weight,
            reps: reps === null ? null : Math.round(reps),
            rpe: null,
          };
        })
    );
    if (!sets.length) {
      setErrorMessage('Enter at least one set (weight or reps), or tick one off, before saving.');
      return;
    }
    // Live sessions keep their real start time and duration; back-dated ones land at local noon.
    const workoutDate = loggingToday ? new Date(session.startedAt) : new Date(new Date(session.date).setHours(12, 0, 0, 0));
    const duration = loggingToday ? Math.round((Date.now() - session.startedAt) / 1000) : null;
    try {
      const result = await logWorkout.mutateAsync({
        title: session.title.trim() || 'Workout',
        date: workoutDate.toISOString(),
        durationSeconds: duration ?? undefined,
        sets,
      });
      const prIds = new Set(result.newPersonalRecordExerciseIds);
      setSummary({
        sets: sets.length,
        duration,
        prs: session.exercises.filter((e) => e.exerciseId && prIds.has(e.exerciseId)).map((e) => e.name),
      });
      store.end();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not save the workout. Your sets are kept — try again.');
    }
  }

  function handleDiscard() {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      setTimeout(() => setConfirmDiscard(false), 4000);
      return;
    }
    store.end();
    if (router.canGoBack()) router.back();
    else router.replace('/log');
  }

  if (summary) {
    return (
      <ScreenContainer>
        <Card style={styles.summaryCard}>
          <Ionicons name="trophy" size={40} color={colors.warning} />
          <Text style={styles.summaryTitle}>Workout saved 💪</Text>
          <Text style={styles.muted}>
            {summary.sets} set{summary.sets === 1 ? '' : 's'}
            {summary.duration ? ` in ${formatClock(summary.duration)}` : ''}
          </Text>
          {summary.prs.length ? (
            <View style={styles.prList}>
              <Text style={styles.prHeading}>New personal record{summary.prs.length === 1 ? '' : 's'}!</Text>
              {summary.prs.map((name) => (
                <Text key={name} style={styles.prName}>
                  🏆 {name}
                </Text>
              ))}
            </View>
          ) : null}
          <Button label="Done" onPress={() => router.replace('/log')} />
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenContainer>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Title" value={session?.title ?? 'Workout'} onChangeText={store.setTitle} />
          </View>
          <View style={styles.dateField}>
            <DatePickerField label="Date" value={new Date(date)} onChange={store.setDate} />
          </View>
        </View>

        {exercises.length && loggingToday ? (
          <View style={styles.statusRow}>
            <Text style={styles.muted}>
              {doneSets} of {totalSets} sets done
            </Text>
            <View style={styles.clock} accessibilityLabel={`Elapsed ${formatClock(elapsed)}`}>
              <Ionicons name="time-outline" size={15} color={colors.textMuted} />
              <Text style={styles.clockText}>{formatClock(elapsed)}</Text>
            </View>
          </View>
        ) : null}

        {showSuggestions && todayGroup ? (
          <Card style={[styles.card, styles.suggestCard]}>
            <View style={styles.suggestHead}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>Suggested for today</Text>
                <Text style={styles.cardTitle}>{todayGroup.day_label}</Text>
                <Text style={styles.muted}>{todayGroup.focus}</Text>
              </View>
              <Button label="Add all" onPress={() => loadGroup(todayIndex)} />
            </View>
            {todayGroup.exercises.map((e) => {
              const added = addedNames.has(e.exercise_name.toLowerCase());
              return (
                <View key={e.exercise_name} style={styles.suggestRow}>
                  <View style={styles.flex}>
                    <Text style={styles.suggestName}>{e.exercise_name}</Text>
                    <Text style={styles.muted}>
                      {e.sets} × {e.reps}
                    </Text>
                  </View>
                  <Pressable
                    disabled={added}
                    onPress={() =>
                      store.addExercise({
                        exerciseId: e.exercise_id,
                        name: e.exercise_name,
                        sets: e.sets,
                        targetReps: e.reps,
                        restSeconds: e.rest_seconds,
                        notes: e.notes,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={added ? `${e.exercise_name} added` : `Add ${e.exercise_name}`}
                    style={[styles.addChip, added && styles.addChipDone]}
                  >
                    <Ionicons name={added ? 'checkmark' : 'add'} size={18} color={added ? colors.success : colors.primary} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        ) : null}

        {session?.warmup.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Warm-up</Text>
            {session.warmup.map((w, i) => (
              <Pressable
                key={i}
                onPress={() => store.toggleWarmup(i)}
                style={styles.warmupRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: w.done }}
              >
                <Ionicons name={w.done ? 'checkbox' : 'square-outline'} size={20} color={w.done ? colors.success : colors.textMuted} />
                <Text style={[styles.warmupText, w.done && styles.struck]}>
                  {w.name} — {w.detail}
                </Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.key}
            exercise={ex}
            weightUnit={weightUnit}
            best={ex.exerciseId ? bestByExercise.get(ex.exerciseId) : undefined}
            bestLabel={(kg) => formatWeight(kg, unitSystem)}
            onChange={(i, field, value) => store.updateSet(ex.key, i, field, value)}
            onToggle={(i) => {
              primeRestChime(); // unlock audio on this tap so the chime can play later
              store.toggleSetDone(ex.key, i);
            }}
            onAddSet={() => store.addSet(ex.key)}
            onRemoveSet={(i) => store.removeSet(ex.key, i)}
            onRemove={() => store.removeExercise(ex.key)}
          />
        ))}

        {searchOpen ? (
          <Card style={styles.card}>
            <View style={styles.searchHead}>
              <Text style={styles.cardTitle}>Add an exercise</Text>
              <Text style={styles.link} onPress={() => { setSearchOpen(false); setSearch(''); }} accessibilityRole="button">
                Cancel
              </Text>
            </View>
            <View>
              <TextField
                placeholder="Search exercises, e.g. bench press"
                value={search}
                onChangeText={setSearch}
                autoFocus
                autoCorrect={false}
                style={styles.searchInput}
              />
              <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
            </View>
            {query.length < MIN_SEARCH_CHARS ? (
              <Text style={styles.muted}>Type at least {MIN_SEARCH_CHARS} letters to search the exercise library.</Text>
            ) : searching && !results ? (
              <Text style={styles.muted}>Searching…</Text>
            ) : results?.length ? (
              results.slice(0, SEARCH_RESULT_LIMIT).map((exercise) => (
                <ExerciseListItem key={exercise.id} exercise={exercise} onPress={() => addFromSearch(exercise.id, exercise.name)} />
              ))
            ) : (
              <Text style={styles.muted}>No exercises match “{query}”.</Text>
            )}
          </Card>
        ) : (
          <View style={styles.addRow}>
            <View style={styles.flex}>
              <Button label="+ Add exercise" variant={exercises.length ? 'secondary' : 'primary'} onPress={() => setSearchOpen(true)} />
            </View>
            {planDays.length ? (
              <View style={styles.flex}>
                <Button label="Load plan group" variant="secondary" onPress={() => setGroupsOpen(true)} />
              </View>
            ) : null}
          </View>
        )}

        {exercises.length ? (
          <>
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            <Button label="Save workout" onPress={handleSave} loading={logWorkout.isPending} />
            <Text style={[styles.discard, confirmDiscard && styles.discardConfirm]} onPress={handleDiscard} accessibilityRole="button">
              {confirmDiscard ? 'Tap again to discard this workout' : 'Discard workout'}
            </Text>
          </>
        ) : !searchOpen ? (
          <Text style={[styles.muted, styles.centered]}>
            Add exercises one by one{planDays.length ? ', or load a whole group from your plan' : ''}.
          </Text>
        ) : null}
        {rest ? <View style={{ height: 130 }} /> : null}
      </ScreenContainer>

      <PlanGroupsSheet
        visible={groupsOpen}
        days={planDays}
        loaded={(i) => Boolean(latestPlan && session?.loadedGroups.includes(`${latestPlan.id}:${i}`))}
        todayIndex={todayIndex}
        onPick={loadGroup}
        onClose={() => setGroupsOpen(false)}
      />

      {rest ? (
        <View
          style={[
            styles.restBar,
            isDesktopWeb ? styles.restBarDesktop : { paddingBottom: Math.max(insets.bottom, spacing.md) },
            restRemaining <= 0 && styles.restBarDone,
          ]}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.restTop}>
            <View style={styles.flex}>
              <Text style={styles.restLabel}>{restRemaining > 0 ? 'Rest' : 'Rest over — go!'}</Text>
              <Text style={styles.muted} numberOfLines={1}>
                {rest.nextLabel}
              </Text>
            </View>
            <Text style={styles.restClock}>{formatClock(Math.max(0, restRemaining))}</Text>
          </View>
          <View style={styles.restTrack}>
            <View style={[styles.restFill, { width: `${Math.max(0, Math.min(1, restRemaining / rest.totalSeconds)) * 100}%` }]} />
          </View>
          <View style={styles.restActions}>
            <RestButton label="−15s" onPress={() => store.adjustRest(-15)} />
            <RestButton label="+15s" onPress={() => store.adjustRest(15)} />
            <RestButton label={restRemaining > 0 ? 'Skip rest' : 'Dismiss'} onPress={store.skipRest} primary />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PlanGroupsSheet({
  visible,
  days,
  loaded,
  todayIndex,
  onPick,
  onClose,
}: {
  visible: boolean;
  days: PlanDay[];
  loaded: (index: number) => boolean;
  todayIndex: number;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  return (
    <Modal visible={visible} transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, isDesktopWeb && styles.backdropCentered]} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, isDesktopWeb ? styles.sheetDesktop : { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        >
          <View style={styles.searchHead}>
            <Text style={styles.cardTitle}>Load a plan group</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.muted}>Adds every exercise in the group, with its sets, reps and rest.</Text>
          {days.map((day, i) => {
            const isLoaded = loaded(i);
            return (
              <Pressable
                key={i}
                disabled={isLoaded}
                onPress={() => onPick(i)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.groupRow, pressed && styles.pressed, isLoaded && styles.groupRowLoaded]}
              >
                <View style={styles.flex}>
                  <Text style={styles.suggestName}>
                    {day.day_label}
                    {i === todayIndex ? '  · Today' : ''}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {day.exercises.length} exercises · {day.focus}
                  </Text>
                </View>
                <Ionicons
                  name={isLoaded ? 'checkmark-circle' : 'add-circle-outline'}
                  size={24}
                  color={isLoaded ? colors.success : colors.primary}
                />
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ExerciseCard({
  exercise,
  weightUnit,
  best,
  bestLabel,
  onChange,
  onToggle,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  exercise: SessionExercise;
  weightUnit: string;
  best?: number;
  bestLabel: (kg: number) => string;
  onChange: (setIndex: number, field: 'weight' | 'reps', value: string) => void;
  onToggle: (setIndex: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onRemove: () => void;
}) {
  const allDone = exercise.sets.every((s) => s.done);
  const meta = [
    exercise.targetReps ? `${exercise.sets.length} × ${exercise.targetReps}` : null,
    `rest ${formatClock(exercise.restSeconds)}`,
    best ? `best ${bestLabel(best)}` : null,
  ].filter(Boolean);
  return (
    <Card style={[styles.card, allDone && styles.cardDone]}>
      <View style={styles.exerciseHead}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{exercise.name}</Text>
          <Text style={styles.muted}>{meta.join(' · ')}</Text>
        </View>
        {allDone ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : null}
        <Text style={styles.removeLink} onPress={onRemove} accessibilityRole="button">
          Remove
        </Text>
      </View>
      {exercise.notes ? <Text style={styles.notes}>{exercise.notes}</Text> : null}

      <View style={styles.setRow}>
        <Text style={[styles.colLabel, styles.setCol]}>Set</Text>
        <Text style={[styles.colLabel, styles.inputCol]}>{weightUnit}</Text>
        <Text style={[styles.colLabel, styles.inputCol]}>Reps</Text>
        <View style={styles.checkCol} />
      </View>
      {exercise.sets.map((set, i) => (
        <View key={i} style={[styles.setRow, set.done && styles.setRowDone]}>
          <Pressable
            onLongPress={() => onRemoveSet(i)}
            accessibilityLabel={`Set ${i + 1}. Long-press to remove`}
            style={styles.setCol}
          >
            <Text style={styles.setNumber}>{i + 1}</Text>
          </Pressable>
          <TextInput
            value={set.weight}
            onChangeText={(v) => onChange(i, 'weight', v)}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={[styles.input, styles.inputCol]}
            accessibilityLabel={`${exercise.name} set ${i + 1} weight`}
          />
          <TextInput
            value={set.reps}
            onChangeText={(v) => onChange(i, 'reps', v)}
            placeholder={/\d+/.exec(exercise.targetReps)?.[0] ?? '0'}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={[styles.input, styles.inputCol]}
            accessibilityLabel={`${exercise.name} set ${i + 1} reps`}
          />
          <Pressable
            onPress={() => onToggle(i)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: set.done }}
            accessibilityLabel={`${exercise.name} set ${i + 1} done`}
            hitSlop={6}
            style={[styles.check, styles.checkCol, set.done && styles.checkDone]}
          >
            <Ionicons name="checkmark" size={18} color={set.done ? '#fff' : colors.textMuted} />
          </Pressable>
        </View>
      ))}
      <Text style={styles.link} onPress={onAddSet} accessibilityRole="button">
        + Add set
      </Text>
    </Card>
  );
}

function RestButton({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.restButton, primary && styles.restButtonPrimary, pressed && styles.pressed]}
    >
      <Text style={[styles.restButtonText, primary && styles.restButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  centered: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  dateField: { width: 180 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: colors.textMuted, fontSize: 13 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: spacing.xs, cursor: 'pointer' },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  clockText: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  card: { gap: spacing.sm },
  cardDone: { borderColor: 'rgba(61,220,132,0.4)' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  suggestCard: { borderColor: colors.primaryMuted },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suggestName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  addChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  addChipDone: { borderColor: colors.success },
  warmupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4, cursor: 'pointer' },
  warmupText: { color: colors.text, fontSize: 14, flex: 1 },
  struck: { color: colors.textMuted, textDecorationLine: 'line-through' },
  exerciseHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  removeLink: { color: colors.danger, fontSize: 13, fontWeight: '600', cursor: 'pointer' },
  notes: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
  setRowDone: { backgroundColor: 'rgba(61,220,132,0.08)' },
  colLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  setCol: { width: 32, alignItems: 'center' },
  inputCol: { flex: 1 },
  checkCol: { width: 44 },
  setNumber: { color: colors.textMuted, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 0,
  },
  check: {
    height: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  searchHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchInput: { paddingLeft: 42 },
  searchIcon: { position: 'absolute', left: spacing.md, top: 17 },
  addRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  error: { color: colors.danger, fontSize: 14 },
  discard: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.sm, cursor: 'pointer' },
  discardConfirm: { color: colors.danger, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdropCentered: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  sheetDesktop: { width: 440, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    cursor: 'pointer',
  },
  groupRowLoaded: { opacity: 0.6 },
  restBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  restBarDesktop: {
    left: undefined,
    right: spacing.xl,
    bottom: spacing.xl,
    width: 380,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    paddingBottom: spacing.md,
  },
  restBarDone: { borderColor: colors.success, backgroundColor: '#11261B' },
  restTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  restLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  restClock: { color: colors.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  restTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  restFill: { height: '100%', backgroundColor: colors.primary },
  restActions: { flexDirection: 'row', gap: spacing.sm },
  restButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  restButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  restButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  restButtonTextPrimary: { color: '#fff' },
  pressed: { opacity: 0.8 },
  summaryCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  summaryTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  prList: { alignItems: 'center', gap: 4, marginVertical: spacing.sm },
  prHeading: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  prName: { color: colors.text, fontSize: 15 },
});
