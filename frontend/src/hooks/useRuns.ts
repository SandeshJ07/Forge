import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRunRoute, saveRun, type SaveRunInput } from '@/api/runs';
import { useAuthStore } from '@/stores/useAuthStore';

/** A run's full route, splits and elevation. Routes never change once saved, so they're cached for good. */
export function useRunRoute(workoutId: string | undefined, enabled = true) {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['run-route', userId, workoutId],
    queryFn: () => fetchRunRoute(workoutId as string),
    enabled: Boolean(userId && workoutId && enabled),
    staleTime: Infinity,
  });
}

export function useSaveRun() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveRunInput) => saveRun(input),
    onSuccess: () => {
      // A run is a workout: it shows up in the log, streak and stats.
      queryClient.invalidateQueries({ queryKey: ['workouts', userId] });
      queryClient.invalidateQueries({ queryKey: ['stats', userId] });
    },
  });
}
