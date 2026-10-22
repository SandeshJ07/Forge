import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Exercise, PlanExercise, PlanGroup, PlanPayload, Weekday } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { ExerciseListItem } from '@/components/ExerciseListItem';
import { useExercises } from '@/hooks/useExercises';
import { formatWeekdays, planGroups, todayWeekday, WEEKDAY_ORDER, WEEKDAY_SHORT } from '@/lib/planGroups';
import { TRACKING_FIELDS } from '@/lib/tracking';
import { colors, radii, spacing } from '@/constants/theme';

const MIN_SEARCH_CHARS = 2;

interface PlanViewProps {
  plan: PlanPayload;
  /** Shows a compact per-group "Start workout" button when provided. */
  onStartGroup?: (groupIndex: number) => void;
  /** Label for that button, e.g. "Resume workout" while a session is running. */
  startLabel?: (groupIndex: number) => string;
  /**
   * Makes each day editable on its own: an Edit button on every day card, which
   * then saves just that day through this callback (may be async; a thrown
   * error is shown on the card and the edit stays open).
   */
  onSaveGroup?: (groupIndex: number, group: PlanGroup) => Promise<unknown> | void;
  /**
   * Adds "Ask AI to change this day" to the day editor: returns the AI's version of
   * the day (not saved) for the user to check, tweak and save.
   */
  onAiEditGroup?: (groupIndex: number, group: PlanGroup, instruction: string) => Promise<PlanGroup>;
  /** AI day edits left today on the shared key (null/undefined = unlimited or unknown). */
  aiEditsRemaining?: number | null;
}

function formatRest(seconds: number): string {
  return seconds >= 60 && seconds % 30 === 0 ? `${seconds / 60} min` : `${seconds}s`;
}

/** What's wrong with an edited day, or null when it can be saved. */
function groupProblem(group: PlanGroup): string | null {
  if (!group.name.trim()) return 'Give this day a name.';
  if (!group.exercises.length) return 'Add at least one exercise.';
  const blank = group.exercises.find((e) => !e.reps.trim());
  if (blank) return `Enter a target for ${blank.exercise_name}, e.g. 8-12.`;
  return null;
}

/** A plan's exercise groups ("days"); each one editable on its own when onSaveGroup is given. */
export function PlanView({ plan, onStartGroup, startLabel, onSaveGroup, onAiEditGroup, aiEditsRemaining }: PlanViewProps) {
  const groups = planGroups(plan);
  const [editing, setEditing] = useState<{ index: number; draft: PlanGroup } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing(index: number) {
    setEditing({ index, draft: groups[index] });
    setError(null);
  }

  async function saveEditing() {
    if (!editing || !onSaveGroup) return;
    const draft = { ...editing.draft, name: editing.draft.name.trim(), focus: (editing.draft.focus ?? '').trim() };
    const problem = groupProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveGroup(editing.index, draft);
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this day. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{plan.title}</Text>
      {plan.rationale ? <Text style={styles.rationale}>{plan.rationale}</Text> : null}
      {plan.progression ? (
        <View style={styles.progression}>
          <Ionicons name="trending-up" size={16} color={colors.primary} />
          <Text style={styles.progressionText}>{plan.progression}</Text>
        </View>
      ) : null}

      {groups.map((group, index) =>
        editing?.index === index ? (
          <GroupCard
            key={index}
            group={editing.draft}
            onChange={(draft) => {
              setEditing({ index, draft });
              setError(null);
            }}
            takenDays={new Set(groups.filter((_, i) => i !== index).flatMap((g) => g.weekdays ?? []))}
            header={
              onAiEditGroup ? (
                <AiEditBox
                  remaining={aiEditsRemaining}
                  disabled={saving}
                  onSubmit={async (instruction) => {
                    const before = editing.draft;
                    const draft = await onAiEditGroup(index, before, instruction);
                    setEditing({ index, draft });
                    setError(null);
                    return () => setEditing({ index, draft: before });
                  }}
                />
              ) : null
            }
            footer={
              <View style={styles.editFooter}>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.editButtons}>
                  <View style={styles.flex}>
                    <Button label="Cancel" size="small" variant="secondary" onPress={() => setEditing(null)} disabled={saving} />
                  </View>
                  <View style={styles.flex}>
                    <Button label="Save day" size="small" onPress={saveEditing} loading={saving} />
                  </View>
                </View>
              </View>
            }
          />
        ) : (
          <GroupCard
            key={index}
            group={group}
            // One day at a time: the other days' Edit buttons wait until this one is saved or cancelled.
            onEdit={onSaveGroup && !editing ? () => startEditing(index) : undefined}
            footer={
              onStartGroup ? (
                <View style={styles.startRow}>
                  <Button label={startLabel?.(index) ?? 'Start workout'} size="small" onPress={() => onStartGroup(index)} />
                </View>
              ) : null
            }
          />
        )
      )}
    </View>
  );
}

/** One day's card: read-only (with an optional Edit button), or its editor when onChange is given. */
function GroupCard({
  group,
  onEdit,
  onChange,
  takenDays,
  header,
  footer,
}: {
  group: PlanGroup;
  onEdit?: () => void;
  onChange?: (group: PlanGroup) => void;
  /** Weekdays other days already use (a weekday belongs to one day only). */
  takenDays?: Set<Weekday>;
  /** Shown at the top of the editor (the AI box). */
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const today = todayWeekday();
  const editing = Boolean(onChange);
  const weekdays = group.weekdays ?? [];

  const update = (patch: Partial<PlanGroup>) => onChange?.({ ...group, ...patch });

  function updateExercise(exerciseIndex: number, patch: Partial<PlanExercise>) {
    update({ exercises: group.exercises.map((e, i) => (i === exerciseIndex ? { ...e, ...patch } : e)) });
  }

  function moveExercise(exerciseIndex: number, delta: -1 | 1) {
    const to = exerciseIndex + delta;
    if (to < 0 || to >= group.exercises.length) return;
    const exercises = [...group.exercises];
    [exercises[exerciseIndex], exercises[to]] = [exercises[to], exercises[exerciseIndex]];
    update({ exercises });
  }

  function toggleWeekday(day: Weekday) {
    const next = weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day];
    update({ weekdays: WEEKDAY_ORDER.filter((d) => next.includes(d)) });
  }

  return (
    <View style={[styles.dayCard, editing && styles.dayCardEditing]}>
      {editing ? (
        <View style={styles.editHead}>
          <Text style={styles.editEyebrow}>Editing this day</Text>
          {header}
          <View style={styles.editorRow}>
            <View style={[styles.editorField, styles.flex]}>
              <Text style={styles.editorLabel}>Name</Text>
              <TextInput
                value={group.name}
                onChangeText={(name) => update({ name })}
                placeholder="e.g. Push"
                placeholderTextColor={colors.textMuted}
                maxLength={60}
                style={styles.editorInput}
                accessibilityLabel="Day name"
              />
            </View>
            <View style={[styles.editorField, styles.flex]}>
              <Text style={styles.editorLabel}>Focus</Text>
              <TextInput
                value={group.focus ?? ''}
                onChangeText={(focus) => update({ focus })}
                placeholder="e.g. Chest, Triceps"
                placeholderTextColor={colors.textMuted}
                maxLength={120}
                style={styles.editorInput}
                accessibilityLabel="Day focus"
              />
            </View>
          </View>
          <View style={styles.editorField}>
            <Text style={styles.editorLabel}>Days</Text>
            <ChipGroup>
              {WEEKDAY_ORDER.map((d) => (
                <Chip
                  key={d}
                  label={WEEKDAY_SHORT[d]}
                  showCheck
                  selected={weekdays.includes(d)}
                  disabled={takenDays?.has(d) && !weekdays.includes(d)}
                  onPress={() => toggleWeekday(d)}
                />
              ))}
            </ChipGroup>
            <Text style={styles.howTo}>
              {weekdays.length ? 'Suggested on these days when you log a workout.' : 'No days — load it whenever you like.'}
              {takenDays?.size ? ' Greyed-out days belong to another day of the plan.' : ''}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.groupHead}>
            <Text style={styles.dayLabel}>{group.name}</Text>
            <View style={styles.headRight}>
              <View style={[styles.dayBadge, weekdays.includes(today) && styles.dayBadgeToday]}>
                <Text style={[styles.dayBadgeText, weekdays.includes(today) && styles.dayBadgeTextToday]}>
                  {formatWeekdays(weekdays) ?? 'Any day'}
                </Text>
              </View>
              {onEdit ? (
                <Pressable
                  onPress={onEdit}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${group.name}`}
                  hitSlop={6}
                  style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                >
                  <Ionicons name="pencil" size={13} color={colors.text} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {group.focus || group.estimated_minutes ? (
            <Text style={styles.dayFocus}>
              {[group.focus, group.estimated_minutes ? `~${group.estimated_minutes} min` : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </>
      )}

      {group.warmup?.length ? (
        <View style={styles.warmupSection}>
          <Text style={styles.warmupLabel}>Warm-up</Text>
          {group.warmup.map((item, warmupIndex) => (
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
                  onPress={() => update({ warmup: group.warmup.filter((_, i) => i !== warmupIndex) })}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {group.exercises.map((exercise, exerciseIndex) => (
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
                  onPress={() => moveExercise(exerciseIndex, -1)}
                />
                <IconButton
                  icon="chevron-down"
                  label={`Move ${exercise.exercise_name} down`}
                  disabled={exerciseIndex === group.exercises.length - 1}
                  onPress={() => moveExercise(exerciseIndex, 1)}
                />
                <IconButton
                  icon="trash-outline"
                  label={`Remove ${exercise.exercise_name}`}
                  danger
                  onPress={() => update({ exercises: group.exercises.filter((_, i) => i !== exerciseIndex) })}
                />
              </View>
            ) : null}
          </View>

          {editing ? (
            <ExerciseEditor exercise={exercise} onChange={(patch) => updateExercise(exerciseIndex, patch)} />
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
            update({
              exercises: [
                ...group.exercises,
                {
                  exercise_id: e.id,
                  exercise_name: e.name,
                  tracking: e.tracking_type,
                  sets: TRACKING_FIELDS[e.tracking_type].time ? 1 : 3,
                  reps: TRACKING_FIELDS[e.tracking_type].time ? (e.tracking_type === 'duration' ? '45 s' : '20 min') : '8-12',
                  rest_seconds: 90,
                },
              ],
            })
          }
        />
      ) : null}

      {footer}
    </View>
  );
}

const AI_EXAMPLES = ['Swap squats for leg press', 'Make it 45 minutes', 'More core work', 'No barbell today'];

/**
 * "Ask AI to change this day": the instruction goes to the AI with the day as it is now;
 * its version replaces the draft (Undo puts the old one back). Nothing is saved until Save day.
 */
function AiEditBox({
  remaining,
  disabled,
  onSubmit,
}: {
  remaining?: number | null;
  disabled?: boolean;
  /** Resolves with an undo function. */
  onSubmit: (instruction: string) => Promise<() => void>;
}) {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<(() => void) | null>(null);
  const outOfEdits = remaining === 0;

  async function submit() {
    const text = instruction.trim();
    if (text.length < 3) {
      setError('Tell the AI what to change, e.g. "swap squats for leg press".');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const undoFn = await onSubmit(text);
      setUndo(() => undoFn);
      setInstruction('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The AI couldn\'t change this day. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.aiBox}>
      <View style={styles.aiHead}>
        <Ionicons name="sparkles" size={15} color={colors.primary} />
        <Text style={styles.aiTitle}>Ask AI to change this day</Text>
        {remaining != null ? <Text style={styles.aiCount}>{remaining} left today</Text> : null}
      </View>
      {undo ? (
        <View style={styles.aiDone}>
          <Text style={[styles.howTo, styles.flex]}>Done — check the AI's version below, then Save day.</Text>
          <Text
            style={styles.cancelLink}
            onPress={() => {
              undo();
              setUndo(null);
            }}
            accessibilityRole="button"
          >
            Undo
          </Text>
        </View>
      ) : null}
      <TextInput
        value={instruction}
        onChangeText={(v) => {
          setInstruction(v);
          setError(null);
        }}
        placeholder="e.g. Swap squats for leg press and keep it under 45 minutes"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
        editable={!busy}
        style={[styles.editorInput, styles.aiInput]}
        accessibilityLabel="What should the AI change?"
      />
      {!instruction ? (
        <View style={styles.aiExamples}>
          {AI_EXAMPLES.map((example) => (
            <Text key={example} style={styles.aiExample} onPress={() => setInstruction(example)} accessibilityRole="button">
              {example}
            </Text>
          ))}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {outOfEdits ? (
        <Text style={styles.howTo}>No AI edits left today — you can still change the day by hand below.</Text>
      ) : (
        <Button
          label={busy ? 'Working on it… (10–30 s)' : 'Change with AI'}
          size="small"
          variant="secondary"
          onPress={submit}
          loading={false}
          disabled={busy || disabled}
        />
      )}
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
  dayCardEditing: { borderColor: colors.primary },
  editHead: { gap: spacing.sm, marginBottom: spacing.xs },
  editEyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    cursor: 'pointer',
  },
  editButtonText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  editFooter: { gap: spacing.sm, marginTop: spacing.sm },
  aiBox: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.background,
  },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  aiCount: { color: colors.textMuted, fontSize: 12 },
  aiDone: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiInput: { height: undefined, minHeight: 60, paddingVertical: spacing.sm, textAlignVertical: 'top' },
  aiExamples: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  aiExample: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    cursor: 'pointer',
  },
  editButtons: { flexDirection: 'row', gap: spacing.sm },
  error: { color: colors.danger, fontSize: 13 },
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
