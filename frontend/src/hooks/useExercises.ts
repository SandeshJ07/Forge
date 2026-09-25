import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDistinctEquipment,
  fetchDistinctMuscleGroups,
  fetchExerciseById,
  fetchExerciseFeedbackMap,
  fetchExercises,
  setExerciseFeedback,
  type ExerciseFilters,
} from '@/api/exercises';
import type { ExerciseFeedbackRating } from '@/types/database';
import { useAuthStore } from '@/stores/useAuthStore';

export function useExercises(filters: ExerciseFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['exercises', filters],
    queryFn: () => fetchExercises(filters),
    enabled: options.enabled ?? true,
  });
}

export function useExercise(id: string | undefined) {
  return useQuery({
    queryKey: ['exercise', id],
    queryFn: () => fetchExerciseById(id as string),
    enabled: Boolean(id),
  });
}

export function useMuscleGroupOptions() {
  return useQuery({ queryKey: ['muscle-groups'], queryFn: fetchDistinctMuscleGroups, staleTime: Infinity });
}

export function useEquipmentOptions() {
  return useQuery({ queryKey: ['equipment-options'], queryFn: fetchDistinctEquipment, staleTime: Infinity });
}

export function useExerciseFeedbackMap() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['exercise-feedback', userId],
    queryFn: fetchExerciseFeedbackMap,
    enabled: Boolean(userId),
  });
}

export function useSetExerciseFeedback() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ exerciseId, rating }: { exerciseId: string; rating: ExerciseFeedbackRating }) =>
      setExerciseFeedback(exerciseId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-feedback', userId] });
    },
  });
}
