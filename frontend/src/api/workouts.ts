import { apiClient } from '@/lib/apiClient';
import type { Workout, WorkoutSet } from '@/types/database';

export interface ManualWorkoutInput {
  title: string;
  date: string;
  /** Seconds from start to finish, for guided sessions. */
  durationSeconds?: number;
  sets: {
    /** null for planned exercises with no glossary match — logged by name, no PR tracking. */
    exerciseId: string | null;
    exerciseName: string;
    weightKg: number | null;
    reps: number | null;
    rpe: number | null;
  }[];
}

export interface LogManualWorkoutResult {
  workoutId: string;
  newPersonalRecordExerciseIds: string[];
}

export async function logManualWorkout(input: ManualWorkoutInput): Promise<LogManualWorkoutResult> {
  const response = await apiClient.post<{ workout_id: string; new_personal_record_exercise_ids: string[] }>(
    '/workouts',
    {
      title: input.title,
      date: input.date,
      duration_seconds: input.durationSeconds,
      sets: input.sets.map((set) => ({
        exercise_id: set.exerciseId,
        exercise_name: set.exerciseName,
        weight_kg: set.weightKg,
        reps: set.reps,
        rpe: set.rpe,
      })),
    }
  );
  return {
    workoutId: response.workout_id,
    newPersonalRecordExerciseIds: response.new_personal_record_exercise_ids,
  };
}

export async function fetchRecentWorkouts(limit = 50): Promise<Workout[]> {
  return apiClient.get<Workout[]>(`/workouts?limit=${limit}`);
}

export async function fetchWorkoutSets(workoutId: string): Promise<WorkoutSet[]> {
  return apiClient.get<WorkoutSet[]>(`/workouts/${workoutId}/sets`);
}

export async function rateWorkout(
  workoutId: string,
  fields: Pick<Workout, 'perceived_exertion' | 'felt_rating' | 'enjoyed' | 'notes'>
): Promise<void> {
  await apiClient.patch(`/workouts/${workoutId}`, fields);
}
