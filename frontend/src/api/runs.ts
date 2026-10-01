import { apiClient } from '@/lib/apiClient';
import type { RecordedPoint, RunActivity } from '@/lib/runTracking';
import type { RunRoute } from '@/types/database';

export interface SaveRunInput {
  activity: RunActivity;
  title?: string;
  /** ISO time the run started. */
  startedAt: string;
  /** Start to finish, pauses included. */
  elapsedSeconds: number;
  segments: RecordedPoint[][];
}

/** Saves a recorded run as a workout with its route; the server computes distance, pace and splits. */
export async function saveRun(input: SaveRunInput): Promise<{ workout_id: string; distance_m: number; moving_seconds: number }> {
  return apiClient.post('/runs', {
    activity: input.activity,
    title: input.title ?? '',
    started_at: input.startedAt,
    elapsed_seconds: input.elapsedSeconds,
    segments: input.segments
      .filter((s) => s.length)
      .map((s) => s.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t, alt: p.alt ?? null, acc: p.acc ?? null }))),
  });
}

export async function fetchRunRoute(workoutId: string): Promise<RunRoute> {
  return apiClient.get<RunRoute>(`/runs/${workoutId}`);
}
