import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchRecentWorkouts,
  fetchWorkoutSets,
  logManualWorkout,
  rateWorkout,
  type ManualWorkoutInput,
} from '@/api/workouts';
import type { Workout } from '@/types/database';
import { useAuthStore } from '@/stores/useAuthStore';

export function useRecentWorkouts() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['workouts', userId],
    queryFn: () => fetchRecentWorkouts(),
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
