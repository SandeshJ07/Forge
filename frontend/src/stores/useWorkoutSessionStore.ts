import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlanGroup, TrackingType } from '@/types/database';
import { formatDuration, resolveTracking, targetToReps, targetToTime } from '@/lib/tracking';

/** Rest between the last set of one exercise and the first set of the next. */
export const BETWEEN_EXERCISE_REST_SECONDS = 120;
export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;
const DEFAULT_REST_SECONDS = 90;
const DEFAULT_TITLE = 'Workout';
/** An exercise's estimated start is never earlier than this before its first set is ticked. */
const MAX_START_ESTIMATE_MS = 10 * 60 * 1000;

export type SetField = 'weight' | 'reps' | 'distance' | 'time';

export interface SessionSet {
  weight: string;
  reps: string;
  /** In the exercise's distance unit (km/mi for cardio, m/yd for carries). */
  distance: string;
  /** "m:ss" or "h:mm:ss" (a bare number is read per tracking type — see parseDuration). */
  time: string;
  done: boolean;
  /** When the set was ticked off (epoch ms). */
  doneAt?: number;
  /** Stopwatch for timed sets: running since this moment. */
  timerStartedAt?: number;
}

export interface SessionExercise {
  key: string;
  exerciseId: string | null;
  name: string;
  tracking: TrackingType;
  /** Planned target, e.g. "8-10", "45 s" or "3 km" — empty for exercises added by hand. */
  targetReps: string;
  restSeconds: number;
  notes?: string;
  sets: SessionSet[];
  /** When the first set began (epoch ms), recorded automatically and saved with the sets. */
  startedAt?: number;
}

export interface RestTimer {
  endsAt: number; // epoch ms — derived from timestamps so it stays right across reloads/backgrounding
  totalSeconds: number;
  nextLabel: string;
  chimed: boolean;
}

export interface SessionWarmup {
  name: string;
  detail: string;
  howTo?: string;
  exerciseId?: string | null;
  done: boolean;
}

/**
 * The workout being logged. One at a time; persisted so it survives
 * navigation, reloads and app restarts. Exercises come from search, today's
 * plan suggestions, or whole plan groups.
 */
export interface WorkoutSession {
  title: string;
  /** When the workout happened (epoch ms, date and time of day). Back-dating is allowed. */
  date: number;
  /** When logging began — for the elapsed clock. */
  startedAt: number;
  /** Plan groups loaded into this workout, as "planId:groupIndex". */
  loadedGroups: string[];
  warmup: SessionWarmup[];
  exercises: SessionExercise[];
  rest: RestTimer | null;
  /** Last time a set was ticked off — helps estimate when the next exercise started. */
  lastDoneAt?: number;
}

export interface NewExercise {
  exerciseId: string | null;
  name: string;
  tracking?: TrackingType | null;
  sets?: number;
  targetReps?: string;
  restSeconds?: number;
  notes?: string;
}

interface SessionState {
  session: WorkoutSession | null;
  setTitle: (title: string) => void;
  /** Changes the day, keeping the time of day. */
  setDate: (date: Date) => void;
  /** Sets the full date and time. */
  setDateTime: (date: Date) => void;
  addExercise: (exercise: NewExercise) => void;
  addPlanGroup: (planId: string, groupIndex: number, group: PlanGroup) => void;
  removeExercise: (exerciseKey: string) => void;
  /** Moves an exercise up (-1) or down (+1) in the workout. */
  moveExercise: (exerciseKey: string, delta: -1 | 1) => void;
  /** This session only — the plan's rest time is left as is. */
  setRestSeconds: (exerciseKey: string, seconds: number) => void;
  updateSet: (exerciseKey: string, setIndex: number, field: SetField, value: string) => void;
  toggleSetDone: (exerciseKey: string, setIndex: number) => void;
  /** Starts or stops the stopwatch on a timed set; stopping fills in its time. */
  toggleSetTimer: (exerciseKey: string, setIndex: number) => void;
  addSet: (exerciseKey: string) => void;
  removeSet: (exerciseKey: string, setIndex: number) => void;
  toggleWarmup: (index: number) => void;
  adjustRest: (deltaSeconds: number) => void;
  skipRest: () => void;
  markChimed: () => void;
  end: () => void;
}

function emptySession(): WorkoutSession {
  const now = Date.now();
  return { title: DEFAULT_TITLE, date: now, startedAt: now, loadedGroups: [], warmup: [], exercises: [], rest: null };
}

function emptySet(weight = ''): SessionSet {
  return { weight, reps: '', distance: '', time: '', done: false };
}

function toSessionExercise(input: NewExercise): SessionExercise {
  const count = Math.max(1, input.sets ?? 1);
  return {
    key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    exerciseId: input.exerciseId,
    name: input.name,
    tracking: resolveTracking(input.tracking, input.name),
    targetReps: input.targetReps ?? '',
    restSeconds: input.restSeconds && input.restSeconds > 0 ? input.restSeconds : DEFAULT_REST_SECONDS,
    notes: input.notes,
    sets: Array.from({ length: count }, () => emptySet()),
  };
}

/**
 * When an exercise most likely started, if nothing recorded it: when the last
 * rest ran out, or — if the rest was cut short — right after the previous set.
 */
function estimateStart(session: WorkoutSession, now: number): number {
  const restEnded = session.rest && session.rest.endsAt <= now ? session.rest.endsAt : undefined;
  const candidate = restEnded ?? session.lastDoneAt ?? session.startedAt;
  return Math.min(now, Math.max(candidate, now - MAX_START_ESTIMATE_MS));
}

/** When an exercise finished: its last set's tick, once every set is done. */
export function exerciseEndTime(exercise: SessionExercise): number | undefined {
  if (!exercise.sets.length || exercise.sets.some((s) => !s.done)) return undefined;
  const times = exercise.sets.map((s) => s.doneAt ?? 0).filter(Boolean);
  return times.length ? Math.max(...times) : undefined;
}

export const useWorkoutSessionStore = create<SessionState>()(
  persist(
    (set, get) => {
      /** Apply a change to the session, creating it on first use. */
      const update = (fn: (s: WorkoutSession) => WorkoutSession) =>
        set((state) => ({ session: fn(state.session ?? emptySession()) }));

      const updateExercise = (exerciseKey: string, fn: (ex: SessionExercise, s: WorkoutSession) => SessionExercise) =>
        update((s) => ({ ...s, exercises: s.exercises.map((ex) => (ex.key === exerciseKey ? fn(ex, s) : ex)) }));

      return {
        session: null,

        setTitle: (title) => update((s) => ({ ...s, title })),

        setDate: (date) =>
          update((s) => {
            const current = new Date(s.date);
            const next = new Date(date);
            next.setHours(current.getHours(), current.getMinutes(), 0, 0);
            // Today at a time that hasn't happened yet isn't allowed.
            return { ...s, date: Math.min(next.getTime(), Date.now()) };
          }),

        setDateTime: (date) => update((s) => ({ ...s, date: Math.min(date.getTime(), Date.now()) })),

        addExercise: (exercise) => update((s) => ({ ...s, exercises: [...s.exercises, toSessionExercise(exercise)] })),

        addPlanGroup: (planId, groupIndex, group) =>
          update((s) => {
            const groupKey = `${planId}:${groupIndex}`;
            if (s.loadedGroups.includes(groupKey)) return s;
            const existing = new Set(s.exercises.map((e) => e.name.toLowerCase()));
            return {
              ...s,
              title: s.title === DEFAULT_TITLE && !s.exercises.length ? group.name : s.title,
              loadedGroups: [...s.loadedGroups, groupKey],
              warmup: [
                ...s.warmup,
                ...(group.warmup ?? []).map((w) => ({
                  name: w.exercise_name,
                  detail: w.duration_or_reps,
                  howTo: w.how_to,
                  exerciseId: w.exercise_id ?? null,
                  done: false,
                })),
              ],
              exercises: [
                ...s.exercises,
                ...group.exercises
                  .filter((e) => !existing.has(e.exercise_name.toLowerCase()))
                  .map((e) =>
                    toSessionExercise({
                      exerciseId: e.exercise_id,
                      name: e.exercise_name,
                      tracking: e.tracking,
                      sets: e.sets,
                      targetReps: e.reps,
                      restSeconds: e.rest_seconds,
                      notes: [e.intensity, e.notes].filter(Boolean).join(' · ') || undefined,
                    })
                  ),
              ],
            };
          }),

        removeExercise: (exerciseKey) =>
          update((s) => ({ ...s, exercises: s.exercises.filter((e) => e.key !== exerciseKey) })),

        moveExercise: (exerciseKey, delta) =>
          update((s) => {
            const from = s.exercises.findIndex((e) => e.key === exerciseKey);
            const to = from + delta;
            if (from === -1 || to < 0 || to >= s.exercises.length) return s;
            const exercises = [...s.exercises];
            [exercises[from], exercises[to]] = [exercises[to], exercises[from]];
            return { ...s, exercises };
          }),

        setRestSeconds: (exerciseKey, seconds) =>
          updateExercise(exerciseKey, (ex) => ({
            ...ex,
            restSeconds: Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, seconds)),
          })),

        updateSet: (exerciseKey, setIndex, field, value) =>
          updateExercise(exerciseKey, (ex) => ({
            ...ex,
            // Entering the first value is a good sign the exercise has begun.
            startedAt: ex.startedAt ?? (value ? Date.now() : undefined),
            sets: ex.sets.map((st, i) => (i === setIndex ? { ...st, [field]: value } : st)),
          })),

        toggleSetTimer: (exerciseKey, setIndex) =>
          updateExercise(exerciseKey, (ex) => {
            const now = Date.now();
            const target = ex.sets[setIndex];
            if (!target) return ex;
            const sets = ex.sets.map((st, i) => {
              if (i !== setIndex) return st;
              if (st.timerStartedAt) {
                return { ...st, time: formatDuration((now - st.timerStartedAt) / 1000), timerStartedAt: undefined };
              }
              return { ...st, timerStartedAt: now };
            });
            return { ...ex, startedAt: ex.startedAt ?? now, sets };
          }),

        toggleSetDone: (exerciseKey, setIndex) => {
          const session = get().session;
          if (!session) return;
          const exIndex = session.exercises.findIndex((e) => e.key === exerciseKey);
          if (exIndex === -1 || !session.exercises[exIndex].sets[setIndex]) return;
          const now = Date.now();
          const nowDone = !session.exercises[exIndex].sets[setIndex].done;

          const exercises = session.exercises.map((ex, i) => {
            if (i !== exIndex) return ex;
            return {
              ...ex,
              startedAt: ex.startedAt ?? (nowDone ? estimateStart(session, now) : undefined),
              sets: ex.sets.map((st, j) => {
                if (j !== setIndex) return st;
                if (!nowDone) return { ...st, done: false, doneAt: undefined };
                // Ticking an untouched set counts the target as done; a running stopwatch stops here.
                const time = st.timerStartedAt
                  ? formatDuration((now - st.timerStartedAt) / 1000)
                  : st.time || targetToTime(ex.targetReps);
                return {
                  ...st,
                  done: true,
                  doneAt: now,
                  timerStartedAt: undefined,
                  reps: st.reps || targetToReps(ex.targetReps),
                  time,
                };
              }),
            };
          });

          let rest: RestTimer | null = session.rest;
          if (nowDone) {
            const current = exercises[exIndex];
            const nextSet = current.sets.findIndex((st) => !st.done);
            const nextExercise =
              exercises.find((ex, i) => i > exIndex && ex.sets.some((st) => !st.done)) ??
              exercises.find((ex, i) => i !== exIndex && ex.sets.some((st) => !st.done));
            if (nextSet !== -1) {
              rest = {
                endsAt: now + current.restSeconds * 1000,
                totalSeconds: current.restSeconds,
                nextLabel: `${current.name} · set ${nextSet + 1} of ${current.sets.length}`,
                chimed: false,
              };
            } else if (nextExercise) {
              rest = {
                endsAt: now + BETWEEN_EXERCISE_REST_SECONDS * 1000,
                totalSeconds: BETWEEN_EXERCISE_REST_SECONDS,
                nextLabel: `Next exercise: ${nextExercise.name}`,
                chimed: false,
              };
            } else {
              rest = null; // last set of the workout
            }
          }
          set({ session: { ...session, exercises, rest, lastDoneAt: nowDone ? now : session.lastDoneAt } });
        },

        addSet: (exerciseKey) =>
          updateExercise(exerciseKey, (ex) => {
            const last = ex.sets[ex.sets.length - 1];
            return { ...ex, sets: [...ex.sets, emptySet(last?.weight ?? '')] };
          }),

        // Any set can go, including the last one — the exercise then waits for "+ Add set".
        removeSet: (exerciseKey, setIndex) =>
          updateExercise(exerciseKey, (ex) => ({ ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) })),

        toggleWarmup: (index) =>
          update((s) => ({ ...s, warmup: s.warmup.map((w, i) => (i === index ? { ...w, done: !w.done } : w)) })),

        adjustRest: (deltaSeconds) =>
          set((state) => {
            const rest = state.session?.rest;
            if (!state.session || !rest) return state;
            return {
              session: {
                ...state.session,
                rest: {
                  ...rest,
                  endsAt: Math.max(Date.now(), rest.endsAt + deltaSeconds * 1000),
                  totalSeconds: Math.max(rest.totalSeconds + deltaSeconds, 1),
                  chimed: false,
                },
              },
            };
          }),

        skipRest: () =>
          set((state) => ({
            // The rest ends now: that's when the next set most likely starts.
            session: state.session && {
              ...state.session,
              rest: null,
              lastDoneAt: state.session.rest ? Math.min(Date.now(), state.session.rest.endsAt) : state.session.lastDoneAt,
            },
          })),

        markChimed: () =>
          set((state) => ({
            session: state.session?.rest ? { ...state.session, rest: { ...state.session.rest, chimed: true } } : state.session,
          })),

        end: () => set({ session: null }),
      };
    },
    {
      name: 'forge-workout-session',
      // v3: tracking types, distance/time fields and exercise timing. v2 sessions are upgraded in place.
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ session: state.session }),
      migrate: (persisted, version) => {
        const session = (persisted as { session?: WorkoutSession | null } | undefined)?.session ?? null;
        if (version !== 2 || !session) return { session: null };
        return {
          session: {
            ...session,
            exercises: session.exercises.map((ex) => ({
              ...ex,
              tracking: resolveTracking(undefined, ex.name),
              sets: ex.sets.map((st) => ({ ...emptySet(), ...st })),
            })),
          },
        };
      },
    }
  )
);

/** Does the session have anything worth resuming? (An untouched draft doesn't count.) */
export function hasWorkoutInProgress(session: WorkoutSession | null): boolean {
  return Boolean(session && session.exercises.length > 0);
}
