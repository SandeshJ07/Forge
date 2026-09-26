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
import { TimePickerField } from '@/components/ui/TimePickerField';
import { ExerciseListItem } from '@/components/ExerciseListItem';
import { formatClock, useNow } from '@/components/WorkoutSessionOverlay';
import { useExercises } from '@/hooks/useExercises';
import { useLatestPlan } from '@/hooks/usePlans';
import { useLogManualWorkout } from '@/hooks/useWorkouts';
import { usePersonalRecords } from '@/hooks/usePersonalRecords';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { useUnitStore } from '@/stores/useUnitStore';
import {
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  exerciseEndTime,
  useWorkoutSessionStore,
  type SessionExercise,
  type SetField,
} from '@/stores/useWorkoutSessionStore';
import { primeRestChime } from '@/lib/restChime';
import { formatWeight, LB_PER_KG } from '@/lib/format';
import {
  TRACKING_FIELDS,
  distanceUnit,
  parseDuration,
  targetToDistance,
  targetToReps,
  targetToTime,
  toMeters,
} from '@/lib/tracking';
import { ApiError } from '@/lib/apiClient';
import { formatWeekdays, planGroups, todayWeekday } from '@/lib/planGroups';
import type { Exercise, PlanGroup, UnitSystem } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const MIN_SEARCH_CHARS = 2;
const SEARCH_RESULT_LIMIT = 20;
const REST_STEP_SECONDS = 15;

function parseNumber(value: string): number | null {
  const n = Number(value.trim().replace(',', '.'));
  return value.trim() && Number.isFinite(n) ? n : null;
}

function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** The same time of day, moved onto `day` — exercise times follow the workout if it's back-dated. */
function onDay(time: number, day: number): number {
  const at = new Date(day);
  const t = new Date(time);
  at.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), 0);
  return at.getTime();
}

function hasValue(set: SessionExercise['sets'][number]): boolean {
  return Boolean(set.weight.trim() || set.reps.trim() || set.distance.trim() || set.time.trim());
}

/**
 * The one place to log a workout: take today's suggested exercises, add
 * exercises by search, or load a whole exercise group; tick sets off with a rest timer
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
  const [suggestionExpanded, setSuggestionExpanded] = useState(false);
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
  const groups = useMemo(() => planGroups(latestPlan?.plan), [latestPlan]);
  const todayIndex = groups.findIndex((g) => g.weekdays?.includes(todayWeekday()));
  const todayGroup = todayIndex >= 0 ? groups[todayIndex] : null;
  // Once any group is loaded the workout has its exercises; from then on only "Add exercise" is offered.
  const groupLoaded = Boolean(session?.loadedGroups.length);
  const showSuggestion = Boolean(todayGroup && !groupLoaded);

  const date = session?.date ?? now;
  const loggingToday = isSameDay(date, now);
  const elapsed = session && exercises.length ? (now - session.startedAt) / 1000 : 0;
  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const rest = session?.rest ?? null;
  const restRemaining = rest ? (rest.endsAt - now) / 1000 : 0;

  function addFromSearch(exercise: Exercise) {
    const timed = TRACKING_FIELDS[exercise.tracking_type].time;
    store.addExercise({ exerciseId: exercise.id, name: exercise.name, tracking: exercise.tracking_type, sets: timed ? 1 : 3 });
    setSearch('');
    setSearchOpen(false);
  }

  function loadGroup(groupIndex: number) {
    if (!latestPlan) return;
    store.addPlanGroup(latestPlan.id, groupIndex, groups[groupIndex]);
    setGroupsOpen(false);
  }

  async function handleSave() {
    if (!session) return;
    setErrorMessage(null);
    const toIso = (ms: number | undefined) => (ms ? new Date(onDay(ms, session.date)).toISOString() : null);
    const spans: { start: number; end: number }[] = [];
    const sets = session.exercises.flatMap((ex) => {
      const fields = TRACKING_FIELDS[ex.tracking];
      const unit = distanceUnit(ex.tracking, unitSystem);
      const logged = ex.sets.filter((s) => s.done || hasValue(s));
      // Saving finishes the workout: an exercise ends at its last ticked set even if some sets were skipped.
      const doneTimes = logged.map((s) => s.doneAt ?? 0).filter(Boolean);
      const end = exerciseEndTime(ex) ?? (doneTimes.length ? Math.max(...doneTimes) : undefined);
      if (ex.startedAt && end) spans.push({ start: onDay(ex.startedAt, session.date), end: onDay(end, session.date) });
      return logged.map((s, i) => {
        const weight = fields.weight ? parseNumber(s.weight) : null;
        const reps = fields.reps ? parseNumber(s.reps) : null;
        const distance = fields.distance ? parseNumber(s.distance) : null;
        return {
          exerciseId: ex.exerciseId,
          exerciseName: ex.name,
          weightKg: weight === null ? null : unitSystem === 'imperial' ? weight / LB_PER_KG : weight,
          reps: reps === null ? null : Math.round(reps),
          durationSeconds: fields.time ? parseDuration(s.time, ex.tracking) : null,
          distanceMeters: distance === null ? null : Math.round(toMeters(distance, unit) * 10) / 10,
          rpe: null,
          // Recorded automatically: the first set carries the exercise's start, each set its finish.
          startedAt: i === 0 ? toIso(ex.startedAt) : null,
          endedAt: toIso(s.doneAt),
        };
      });
    });
    if (!sets.length) {
      setErrorMessage('Enter at least one set, or tick one off, before saving.');
      return;
    }
    const workoutDate = new Date(session.date);
    // From the exercises' own times when there are any; otherwise, for a live session, from when logging began.
    const plausible = (seconds: number) => seconds > 0 && seconds <= 24 * 3600;
    // From the exercises' own recorded times when there are any;
    // otherwise, for a live session, from when logging began.
    const fromExercises = spans.length
      ? Math.round((Math.max(...spans.map((s) => s.end)) - Math.min(...spans.map((s) => s.start))) / 1000)
      : 0;
    const live = loggingToday ? Math.round((Date.now() - session.startedAt) / 1000) : 0;
    const duration = plausible(fromExercises) ? fromExercises : plausible(live) ? live : null;
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
        <TextField label="Title" value={session?.title ?? 'Workout'} onChangeText={store.setTitle} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <DatePickerField label="Date" value={new Date(date)} onChange={store.setDate} />
          </View>
          <View style={styles.flex}>
            <TimePickerField label="Start time" value={new Date(date)} onChange={store.setDateTime} />
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

        {showSuggestion && todayGroup ? (
          <Card style={[styles.card, styles.suggestCard]}>
            <Text style={styles.eyebrow}>Today's workout</Text>
            <View style={styles.suggestHead}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{todayGroup.name}</Text>
                <Text style={styles.muted}>
                  {[formatWeekdays(todayGroup.weekdays), todayGroup.focus].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Button label="Start" size="small" onPress={() => loadGroup(todayIndex)} />
            </View>
            <Pressable
              onPress={() => setSuggestionExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: suggestionExpanded }}
              style={styles.accordionToggle}
            >
              <Text style={styles.accordionText}>
                {suggestionExpanded ? 'Hide exercises' : `Show ${todayGroup.exercises.length} exercises`}
              </Text>
              <Ionicons name={suggestionExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
            </Pressable>
            {suggestionExpanded
              ? todayGroup.exercises.map((e) => (
                  <View key={e.exercise_name} style={styles.suggestRow}>
                    <Text style={[styles.suggestName, styles.flex]}>{e.exercise_name}</Text>
                    <Text style={styles.muted}>
                      {e.sets} × {e.reps}
                    </Text>
                  </View>
                ))
              : null}
          </Card>
        ) : null}

        {session?.warmup.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Warm-up</Text>
            {session.warmup.map((w, i) => (
              <View key={i} style={styles.warmupRow}>
                <Pressable
                  onPress={() => store.toggleWarmup(i)}
                  style={styles.warmupCheck}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: w.done }}
                  accessibilityLabel={`${w.name}, ${w.detail}`}
                >
                  <Ionicons name={w.done ? 'checkbox' : 'square-outline'} size={20} color={w.done ? colors.success : colors.textMuted} />
                  <View style={styles.flex}>
                    <Text style={[styles.warmupText, w.done && styles.struck]}>
                      {w.name} — {w.detail}
                    </Text>
                    {w.howTo && !w.done ? <Text style={styles.warmupHowTo}>{w.howTo}</Text> : null}
                  </View>
                </Pressable>
                {w.exerciseId ? (
                  <Pressable
                    onPress={() => router.push(`/exercise/${w.exerciseId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`How to do ${w.name}`}
                    hitSlop={10}
                    style={styles.infoButton}
                  >
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        {exercises.map((ex, index) => (
          <ExerciseCard
            key={ex.key}
            exercise={ex}
            now={now}
            unitSystem={unitSystem}
            weightUnit={weightUnit}
            onMove={(delta) => store.moveExercise(ex.key, delta)}
            canMoveUp={index > 0}
            canMoveDown={index < exercises.length - 1}
            onTimer={(i) => store.toggleSetTimer(ex.key, i)}
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
            onRestChange={(seconds) => store.setRestSeconds(ex.key, seconds)}
            onInfo={ex.exerciseId ? () => router.push(`/exercise/${ex.exerciseId}`) : undefined}
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
                accessibilityLabel="Search exercises"
              />
              <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
            </View>
            {/* Nothing is listed until the user types: this is a search, not a browser. */}
            {query.length < MIN_SEARCH_CHARS ? null : searching && !results ? (
              <Text style={styles.muted}>Searching…</Text>
            ) : results?.length ? (
              results.slice(0, SEARCH_RESULT_LIMIT).map((exercise) => (
                <ExerciseListItem key={exercise.id} exercise={exercise} onPress={() => addFromSearch(exercise)} />
              ))
            ) : (
              <Text style={styles.muted}>No exercises match “{query}”.</Text>
            )}
          </Card>
        ) : (
          <Button label="+ Add exercise" variant={exercises.length ? 'secondary' : 'primary'} onPress={() => setSearchOpen(true)} />
        )}

        {groupLoaded ? null : groups.length ? (
          <Button label="Load an exercise group" variant="secondary" onPress={() => setGroupsOpen(true)} />
        ) : latestPlan === null ? (
          <Text style={[styles.link]} onPress={() => router.push('/plan/new')} accessibilityRole="link">
            Create exercise groups with AI
          </Text>
        ) : null}

        {exercises.length ? (
          <>
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            <Button label="Save workout" onPress={handleSave} loading={logWorkout.isPending} />
            <Text style={[styles.discard, confirmDiscard && styles.discardConfirm]} onPress={handleDiscard} accessibilityRole="button">
              {confirmDiscard ? 'Tap again to discard this workout' : 'Discard workout'}
            </Text>
          </>
        ) : null}
        {rest ? <View style={{ height: 130 }} /> : null}
      </ScreenContainer>

      <PlanGroupsSheet
        visible={groupsOpen}
        groups={groups}
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
  groups,
  loaded,
  todayIndex,
  onPick,
  onClose,
}: {
  visible: boolean;
  groups: PlanGroup[];
  loaded: (index: number) => boolean;
  todayIndex: number;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const router = useRouter();
  return (
    <Modal visible={visible} transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, isDesktopWeb && styles.backdropCentered]} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, isDesktopWeb ? styles.sheetDesktop : { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        >
          <View style={styles.searchHead}>
            <Text style={styles.cardTitle}>Load an exercise group</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.muted}>Adds every exercise in the group, with its sets, reps and rest.</Text>
          {groups.map((group, i) => {
            const isLoaded = loaded(i);
            const days = formatWeekdays(group.weekdays);
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
                    {group.name}
                    {i === todayIndex ? '  · Today' : ''}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {[`${group.exercises.length} exercises`, group.focus, days].filter(Boolean).join(' · ')}
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
          <Text
            style={styles.link}
            onPress={() => {
              onClose();
              router.navigate('/plan');
            }}
            accessibilityRole="link"
          >
            Manage exercise groups
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ExerciseCard({
  exercise,
  now,
  unitSystem,
  weightUnit,
  best,
  bestLabel,
  canMoveUp,
  canMoveDown,
  onMove,
  onTimer,
  onChange,
  onToggle,
  onAddSet,
  onRemoveSet,
  onRemove,
  onRestChange,
  onInfo,
}: {
  exercise: SessionExercise;
  now: number;
  unitSystem: UnitSystem;
  weightUnit: string;
  best?: number;
  bestLabel: (kg: number) => string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (delta: -1 | 1) => void;
  onTimer: (setIndex: number) => void;
  onChange: (setIndex: number, field: SetField, value: string) => void;
  onToggle: (setIndex: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onRemove: () => void;
  onRestChange: (seconds: number) => void;
  /** Opens the exercise's how-to page; omitted for exercises not in the library. */
  onInfo?: () => void;
}) {
  const fields = TRACKING_FIELDS[exercise.tracking];
  const distUnit = distanceUnit(exercise.tracking, unitSystem);
  const allDone = exercise.sets.length > 0 && exercise.sets.every((s) => s.done);
  const started = exercise.startedAt;
  const ended = exerciseEndTime(exercise);
  const meta = [
    exercise.targetReps ? `${exercise.sets.length} × ${exercise.targetReps}` : null,
    best && fields.weight ? `best ${bestLabel(best)}` : null,
  ].filter(Boolean);

  // Placeholders show the plan's target so an untouched, ticked set reads as "done as planned".
  const placeholders = {
    weight: '0',
    reps: targetToReps(exercise.targetReps) || '0',
    distance: targetToDistance(exercise.targetReps, distUnit) || '0',
    time: targetToTime(exercise.targetReps) || (exercise.tracking === 'duration' ? '0:45' : '20:00'),
  };
  const columns: { field: SetField; label: string; keyboard: 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation' }[] = [
    ...(fields.weight ? [{ field: 'weight' as const, label: fields.addedWeight ? `+${weightUnit}` : weightUnit, keyboard: 'decimal-pad' as const }] : []),
    ...(fields.distance ? [{ field: 'distance' as const, label: distUnit, keyboard: 'decimal-pad' as const }] : []),
    ...(fields.reps ? [{ field: 'reps' as const, label: 'Reps', keyboard: 'number-pad' as const }] : []),
    ...(fields.time ? [{ field: 'time' as const, label: 'Time', keyboard: 'numbers-and-punctuation' as const }] : []),
  ];

  const elapsed = started ? Math.max(0, ((ended ?? now) - started) / 1000) : 0;

  return (
    <Card style={[styles.card, allDone && styles.cardDone]}>
      <View style={styles.exerciseHead}>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, styles.titleText]}>{exercise.name}</Text>
            {onInfo ? (
              <Pressable
                onPress={onInfo}
                accessibilityRole="button"
                accessibilityLabel={`How to do ${exercise.name}`}
                hitSlop={10}
                style={styles.infoButton}
              >
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
          {meta.length ? <Text style={styles.muted}>{meta.join(' · ')}</Text> : null}
        </View>
        {allDone ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : null}
        <View style={styles.moveButtons}>
          <Pressable
            onPress={() => onMove(-1)}
            disabled={!canMoveUp}
            accessibilityRole="button"
            accessibilityLabel={`Move ${exercise.name} up`}
            hitSlop={6}
            style={[styles.moveButton, !canMoveUp && styles.restStepDisabled]}
          >
            <Ionicons name="chevron-up" size={16} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => onMove(1)}
            disabled={!canMoveDown}
            accessibilityRole="button"
            accessibilityLabel={`Move ${exercise.name} down`}
            hitSlop={6}
            style={[styles.moveButton, !canMoveDown && styles.restStepDisabled]}
          >
            <Ionicons name="chevron-down" size={16} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.removeLink} onPress={onRemove} accessibilityRole="button">
          Remove
        </Text>
      </View>
      {exercise.notes ? <Text style={styles.notes}>{exercise.notes}</Text> : null}

      {/* Start and finish are recorded automatically and saved with the sets; only the elapsed time is shown. */}
      {started ? (
        <View style={styles.timingRow} accessibilityLabel={`${ended ? 'Took' : 'Elapsed'} ${formatClock(elapsed)}`}>
          <Ionicons name={ended ? 'checkmark-done-outline' : 'stopwatch-outline'} size={15} color={colors.textMuted} />
          <Text style={styles.muted}>{ended ? 'Took' : 'Elapsed'}</Text>
          <Text style={[styles.elapsed, !ended && styles.elapsedLive]}>{formatClock(elapsed)}</Text>
        </View>
      ) : null}

      {exercise.sets.length > 1 || !fields.time ? (
        <View style={styles.restEdit}>
          <Ionicons name="timer-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.muted, styles.flex]}>Rest between sets</Text>
          <Pressable
            onPress={() => onRestChange(exercise.restSeconds - REST_STEP_SECONDS)}
            disabled={exercise.restSeconds <= MIN_REST_SECONDS}
            accessibilityRole="button"
            accessibilityLabel={`Shorter rest for ${exercise.name}`}
            hitSlop={6}
            style={[styles.restStep, exercise.restSeconds <= MIN_REST_SECONDS && styles.restStepDisabled]}
          >
            <Ionicons name="remove" size={16} color={colors.text} />
          </Pressable>
          <Text style={styles.restValue} accessibilityLabel={`Rest ${formatClock(exercise.restSeconds)}`}>
            {formatClock(exercise.restSeconds)}
          </Text>
          <Pressable
            onPress={() => onRestChange(exercise.restSeconds + REST_STEP_SECONDS)}
            disabled={exercise.restSeconds >= MAX_REST_SECONDS}
            accessibilityRole="button"
            accessibilityLabel={`Longer rest for ${exercise.name}`}
            hitSlop={6}
            style={[styles.restStep, exercise.restSeconds >= MAX_REST_SECONDS && styles.restStepDisabled]}
          >
            <Ionicons name="add" size={16} color={colors.text} />
          </Pressable>
        </View>
      ) : null}

      {exercise.sets.length ? (
        <View style={styles.setRow}>
          <Text style={[styles.colLabel, styles.setCol]}>Set</Text>
          {columns.map((c) => (
            <Text key={c.field} style={[styles.colLabel, styles.inputCol]}>
              {c.label}
            </Text>
          ))}
          {fields.time ? <View style={styles.timerCol} /> : null}
          <View style={styles.checkCol} />
          <View style={styles.deleteCol} />
        </View>
      ) : (
        <Text style={styles.muted}>No sets — add one below.</Text>
      )}
      {exercise.sets.map((set, i) => {
        const running = Boolean(set.timerStartedAt);
        return (
          <View key={i} style={[styles.setRow, set.done && styles.setRowDone]}>
            <View style={styles.setCol}>
              <Text style={styles.setNumber}>{i + 1}</Text>
            </View>
            {columns.map((c) =>
              c.field === 'time' && running ? (
                <View key={c.field} style={[styles.input, styles.inputCol, styles.runningTimer]}>
                  <Text style={styles.runningTimerText}>{formatClock((now - (set.timerStartedAt ?? now)) / 1000)}</Text>
                </View>
              ) : (
                <TextInput
                  key={c.field}
                  value={set[c.field]}
                  onChangeText={(v) => onChange(i, c.field, v)}
                  placeholder={placeholders[c.field]}
                  placeholderTextColor={colors.textMuted}
                  keyboardType={c.keyboard}
                  style={[styles.input, styles.inputCol]}
                  accessibilityLabel={
                    c.field === 'time'
                      ? `${exercise.name} set ${i + 1} time, minutes and seconds`
                      : `${exercise.name} set ${i + 1} ${c.label}`
                  }
                />
              )
            )}
            {fields.time ? (
              <Pressable
                onPress={() => onTimer(i)}
                disabled={set.done}
                accessibilityRole="button"
                accessibilityLabel={`${running ? 'Stop' : 'Start'} timer for ${exercise.name} set ${i + 1}`}
                hitSlop={4}
                style={[styles.timerButton, styles.timerCol, running && styles.timerButtonRunning, set.done && styles.restStepDisabled]}
              >
                <Ionicons name={running ? 'stop' : 'play'} size={16} color={running ? '#fff' : colors.primary} />
              </Pressable>
            ) : null}
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
            <Pressable
              onPress={() => onRemoveSet(i)}
              accessibilityRole="button"
              accessibilityLabel={`Remove set ${i + 1} of ${exercise.name}`}
              hitSlop={6}
              style={[styles.deleteCol, styles.deleteButton]}
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        );
      })}
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
  row: { flexDirection: 'row', gap: spacing.sm },
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
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suggestName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  accordionToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', cursor: 'pointer' },
  accordionText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  restEdit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  restStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  restStepDisabled: { opacity: 0.4 },
  restValue: { color: colors.text, fontSize: 15, fontWeight: '700', minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] },
  warmupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 4 },
  warmupCheck: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, cursor: 'pointer' },
  warmupHowTo: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  moveButtons: { flexDirection: 'row', gap: 4 },
  moveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  timingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  elapsed: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  elapsedLive: { color: colors.primary },
  timerCol: { width: 36 },
  timerButton: {
    height: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  timerButtonRunning: { backgroundColor: colors.danger, borderColor: colors.danger },
  runningTimer: { justifyContent: 'center', borderColor: colors.primary },
  runningTimerText: { color: colors.primary, fontSize: 17, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  deleteCol: { width: 24 },
  deleteButton: { height: 40, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

  warmupText: { color: colors.text, fontSize: 14, flex: 1 },
  struck: { color: colors.textMuted, textDecorationLine: 'line-through' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { flexShrink: 1 },
  infoButton: { cursor: 'pointer' },
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
