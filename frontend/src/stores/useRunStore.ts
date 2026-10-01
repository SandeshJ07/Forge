import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { RecordedPoint, RunActivity } from '@/lib/runTracking';

export type RunStatus = 'idle' | 'recording' | 'paused';

export interface RunRecording {
  activity: RunActivity;
  /** Epoch ms when Start was pressed. */
  startedAt: number;
  /** Total ms spent paused so far (not counting a pause in progress). */
  pausedMs: number;
  /** Epoch ms the current pause began; null while recording. */
  pausedAt: number | null;
  /** One list per recording stretch; a pause ends one and resuming starts the next. */
  segments: RecordedPoint[][];
}

interface RunState {
  status: RunStatus;
  run: RunRecording | null;
  start: (activity: RunActivity) => void;
  addPoint: (point: Omit<RecordedPoint, 't'> & { timestamp: number }) => void;
  pause: () => void;
  resume: () => void;
  discard: () => void;
}

/**
 * The run being recorded is saved on the device so a reload or a closed tab
 * doesn't lose it — but a long run is thousands of points, so writes are
 * batched instead of rewriting the whole route on every GPS fix.
 */
const SAVE_EVERY_MS = 5000;
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const batchedStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(name),
  setItem: (name, value) => {
    pending.set(name, value);
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      for (const [key, v] of pending) AsyncStorage.setItem(key, v).catch(() => {});
      pending.clear();
    }, SAVE_EVERY_MS);
  },
  removeItem: (name) => {
    pending.delete(name);
    return AsyncStorage.removeItem(name);
  },
};

/** Saves immediately (e.g. right after Pause / Finish), not waiting for the next batch. */
export function flushRunStorage(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  for (const [key, v] of pending) AsyncStorage.setItem(key, v).catch(() => {});
  pending.clear();
}

export const useRunStore = create<RunState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      run: null,

      start: (activity) =>
        set({ status: 'recording', run: { activity, startedAt: Date.now(), pausedMs: 0, pausedAt: null, segments: [[]] } }),

      addPoint: ({ timestamp, ...point }) => {
        const { status, run } = get();
        if (status !== 'recording' || !run) return;
        const t = Math.max(0, (timestamp - run.startedAt) / 1000);
        const segments = run.segments.slice();
        const last = segments[segments.length - 1] ?? [];
        segments[segments.length - 1] = [...last, { ...point, t: Math.round(t * 10) / 10 }];
        set({ run: { ...run, segments } });
      },

      pause: () => {
        const { status, run } = get();
        if (status !== 'recording' || !run) return;
        set({ status: 'paused', run: { ...run, pausedAt: Date.now() } });
        flushRunStorage();
      },

      resume: () => {
        const { status, run } = get();
        if (status !== 'paused' || !run) return;
        const pausedFor = run.pausedAt ? Date.now() - run.pausedAt : 0;
        set({
          status: 'recording',
          run: { ...run, pausedAt: null, pausedMs: run.pausedMs + pausedFor, segments: [...run.segments, []] },
        });
      },

      discard: () => {
        set({ status: 'idle', run: null });
        flushRunStorage();
      },
    }),
    {
      name: 'forge-run-recording',
      version: 1,
      storage: createJSONStorage(() => batchedStorage),
      partialize: (state) => ({ status: state.status, run: state.run }),
    }
  )
);

/** Time actually recording (pauses left out), in seconds, as of `now`. */
export function activeSeconds(run: RunRecording, now: number): number {
  const pausedNow = run.pausedAt ? now - run.pausedAt : 0;
  return Math.max(0, (now - run.startedAt - run.pausedMs - pausedNow) / 1000);
}
