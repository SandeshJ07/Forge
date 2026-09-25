import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchRecentWorkouts,
  fetchWorkoutsBetween,
  fetchWorkoutSets,
  logManualWorkout,
  rateWorkout,
  type ManualWorkoutInput,
} from '@/api/workouts';
import type { Workout } from '@/types/database';
import { useAuthStore } from '@/stores/useAuthStore';
import { fetchStatsOverview } from '@/api/stats';

export function useRecentWorkouts() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['workouts', userId],
    queryFn: () => fetchRecentWorkouts(),
    enabled: Boolean(userId),
  });
}

/**
 * Longer history for the streak calendar and best-streak stat. Keyed under
 * ['workouts', userId] so logging or rating a workout refreshes it too.
 */
export function useWorkoutHistory() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['workouts', userId, 'history'],
    queryFn: () => fetchRecentWorkouts(500),
    enabled: Boolean(userId),
  });
}

/** One local calendar month of workouts (`month` is any date in it). Refreshes with the other ['workouts', userId] queries. */
export function useWorkoutsInMonth(month: Date) {
  const userId = useAuthStore((s) => s.session?.userId);
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  return useQuery({
    queryKey: ['workouts', userId, 'month', start.getFullYear(), start.getMonth()],
    queryFn: () => fetchWorkoutsBetween(start, end),
    enabled: Boolean(userId),
  });
}

export function useWorkoutSets(workoutId: string | undefined) {
  return useQuery({
    queryKey: ['workout-sets', workoutId],
    queryFn: () => fetchWorkoutSets(workoutId as string),
    enabled: Boolean(workoutId),
  });
}

export function useLogManualWorkout() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualWorkoutInput) => logManualWorkout(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', userId] });
      queryClient.invalidateQueries({ queryKey: ['personal-records', userId] });
      queryClient.invalidateQueries({ queryKey: ['stats', userId] });
    },
  });
}

export function useRateWorkout() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workoutId,
      fields,
    }: {
      workoutId: string;
      fields: Pick<Workout, 'perceived_exertion' | 'felt_rating' | 'enjoyed' | 'notes'>;
    }) => rateWorkout(workoutId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', userId] });
    },
  });
}

/** Motivational aggregates for Home (this vs last month, milestones, strength gains, lifetime totals). */
export function useStatsOverview() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['stats', userId],
    queryFn: fetchStatsOverview,
    enabled: Boolean(userId),
  });
}
