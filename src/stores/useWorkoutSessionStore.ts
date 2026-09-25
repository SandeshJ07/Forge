import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlanDay } from '@/types/database';

/** Rest between the last set of one exercise and the first set of the next. */
export const BETWEEN_EXERCISE_REST_SECONDS = 120;
const DEFAULT_REST_SECONDS = 90;
const DEFAULT_TITLE = 'Workout';

export interface SessionSet {
  weight: string;
  reps: string;
  done: boolean;
}

export interface SessionExercise {
  key: string;
  exerciseId: string | null;
  name: string;
  /** Planned target, e.g. "8-10" — empty for exercises added by hand. */
  targetReps: string;
  restSeconds: number;
  notes?: string;
  sets: SessionSet[];
}

export interface RestTimer {
  endsAt: number; // epoch ms — derived from timestamps so it stays right across reloads/backgrounding
  totalSeconds: number;
  nextLabel: string;
  chimed: boolean;
}

/**
 * The workout being logged. One at a time; persisted so it survives
 * navigation, reloads and app restarts. Exercises come from search, today's
 * plan suggestions, or whole plan groups.
 */
export interface WorkoutSession {
  title: string;
  /** Day the workout counts for (epoch ms). Back-dating is allowed. */
  date: number;
  /** When logging began — for the elapsed clock and saved duration. */
  startedAt: number;
  /** Plan groups loaded into this workout, as "planId:dayIndex". */
  loadedGroups: string[];
  warmup: { name: string; detail: string; done: boolean }[];
  exercises: SessionExercise[];
  rest: RestTimer | null;
}

export interface NewExercise {
  exerciseId: string | null;
  name: string;
  sets?: number;
  targetReps?: string;
  restSeconds?: number;
  notes?: string;
}

interface SessionState {
  session: WorkoutSession | null;
  setTitle: (title: string) => void;
  setDate: (date: Date) => void;
  addExercise: (exercise: NewExercise) => void;
  addPlanGroup: (planId: string, dayIndex: number, day: PlanDay) => void;
  removeExercise: (exerciseKey: string) => void;
  updateSet: (exerciseKey: string, setIndex: number, field: 'weight' | 'reps', value: string) => void;
  toggleSetDone: (exerciseKey: string, setIndex: number) => void;
  addSet: (exerciseKey: string) => void;
  removeSet: (exerciseKey: string, setIndex: number) => void;
  toggleWarmup: (index: number) => void;
  adjustRest: (deltaSeconds: number) => void;
  skipRest: () => void;
  markChimed: () => void;
  end: () => void;
}

function firstNumber(text: string): string {
  // "8-10" → "8", "AMRAP" → "" — used only as the reps placeholder/default.
  return /\d+/.exec(text)?.[0] ?? '';
}

function emptySession(): WorkoutSession {
  const now = Date.now();
  return { title: DEFAULT_TITLE, date: now, startedAt: now, loadedGroups: [], warmup: [], exercises: [], rest: null };
}

function toSessionExercise(input: NewExercise): SessionExercise {
  const count = Math.max(1, input.sets ?? 1);
  return {
    key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    exerciseId: input.exerciseId,
    name: input.name,
    targetReps: input.targetReps ?? '',
    restSeconds: input.restSeconds && input.restSeconds > 0 ? input.restSeconds : DEFAULT_REST_SECONDS,
    notes: input.notes,
    sets: Array.from({ length: count }, () => ({ weight: '', reps: '', done: false })),
  };
}

export const useWorkoutSessionStore = create<SessionState>()(
  persist(
    (set, get) => {
      /** Apply a change to the session, creating it on first use. */
      const update = (fn: (s: WorkoutSession) => WorkoutSession) =>
        set((state) => ({ session: fn(state.session ?? emptySession()) }));

      return {
        session: null,

        setTitle: (title) => update((s) => ({ ...s, title })),

        setDate: (date) => update((s) => ({ ...s, date: date.getTime() })),

        addExercise: (exercise) => update((s) => ({ ...s, exercises: [...s.exercises, toSessionExercise(exercise)] })),

        addPlanGroup: (planId, dayIndex, day) =>
          update((s) => {
            const groupKey = `${planId}:${dayIndex}`;
            if (s.loadedGroups.includes(groupKey)) return s;
            const existing = new Set(s.exercises.map((e) => e.name.toLowerCase()));
            return {
              ...s,
              title: s.title === DEFAULT_TITLE && !s.exercises.length ? day.day_label : s.title,
              loadedGroups: [...s.loadedGroups, groupKey],
              warmup: [
                ...s.warmup,
                ...(day.warmup ?? []).map((w) => ({ name: w.exercise_name, detail: w.duration_or_reps, done: false })),
              ],
              exercises: [
                ...s.exercises,
                ...day.exercises
                  .filter((e) => !existing.has(e.exercise_name.toLowerCase()))
                  .map((e) =>
                    toSessionExercise({
                      exerciseId: e.exercise_id,
                      name: e.exercise_name,
                      sets: e.sets,
                      targetReps: e.reps,
                      restSeconds: e.rest_seconds,
                      notes: e.notes,
                    })
                  ),
              ],
            };
          }),

        removeExercise: (exerciseKey) =>
          update((s) => ({ ...s, exercises: s.exercises.filter((e) => e.key !== exerciseKey) })),

        updateSet: (exerciseKey, setIndex, field, value) =>
          update((s) => ({
            ...s,
            exercises: s.exercises.map((ex) =>
              ex.key !== exerciseKey
                ? ex
                : { ...ex, sets: ex.sets.map((st, i) => (i === setIndex ? { ...st, [field]: value } : st)) }
            ),
          })),

        toggleSetDone: (exerciseKey, setIndex) => {
          const session = get().session;
          if (!session) return;
          const exIndex = session.exercises.findIndex((e) => e.key === exerciseKey);
          if (exIndex === -1) return;
          const nowDone = !session.exercises[exIndex].sets[setIndex].done;

          const exercises = session.exercises.map((ex, i) =>
            i !== exIndex
              ? ex
              : {
                  ...ex,
                  sets: ex.sets.map((st, j) =>
                    j !== setIndex
                      ? st
                      : // Ticking an untouched set counts the target reps as done.
                        { ...st, done: nowDone, reps: nowDone && !st.reps ? firstNumber(ex.targetReps) : st.reps }
                  ),
                }
          );

          let rest: RestTimer | null = session.rest;
          if (nowDone) {
            const current = exercises[exIndex];
            const nextSet = current.sets.findIndex((st) => !st.done);
            const nextExercise =
              exercises.find((ex, i) => i > exIndex && ex.sets.some((st) => !st.done)) ??
              exercises.find((ex, i) => i !== exIndex && ex.sets.some((st) => !st.done));
            if (nextSet !== -1) {
              rest = {
                endsAt: Date.now() + current.restSeconds * 1000,
                totalSeconds: current.restSeconds,
                nextLabel: `${current.name} · set ${nextSet + 1} of ${current.sets.length}`,
                chimed: false,
              };
            } else if (nextExercise) {
              rest = {
                endsAt: Date.now() + BETWEEN_EXERCISE_REST_SECONDS * 1000,
                totalSeconds: BETWEEN_EXERCISE_REST_SECONDS,
                nextLabel: `Next exercise: ${nextExercise.name}`,
                chimed: false,
              };
            } else {
              rest = null; // last set of the workout
            }
          }
          set({ session: { ...session, exercises, rest } });
        },

        addSet: (exerciseKey) =>
          update((s) => ({
            ...s,
            exercises: s.exercises.map((ex) => {
              if (ex.key !== exerciseKey) return ex;
              const last = ex.sets[ex.sets.length - 1];
              return { ...ex, sets: [...ex.sets, { weight: last?.weight ?? '', reps: '', done: false }] };
            }),
          })),

        removeSet: (exerciseKey, setIndex) =>
          update((s) => ({
            ...s,
            exercises: s.exercises.map((ex) =>
              ex.key !== exerciseKey || ex.sets.length <= 1 ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) }
            ),
          })),

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

        skipRest: () => set((state) => ({ session: state.session && { ...state.session, rest: null } })),

        markChimed: () =>
          set((state) => ({
            session: state.session?.rest ? { ...state.session, rest: { ...state.session.rest, chimed: true } } : state.session,
          })),

        end: () => set({ session: null }),
      };
    },
    {
      name: 'forge-workout-session',
      version: 2, // v1 sessions (separate "start from plan" screen) are dropped rather than migrated
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ session: state.session }),
      migrate: () => ({ session: null }),
    }
  )
);

/** Does the session have anything worth resuming? (An untouched draft doesn't count.) */
export function hasWorkoutInProgress(session: WorkoutSession | null): boolean {
  return Boolean(session && session.exercises.length > 0);
}
