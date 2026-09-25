import { apiClient } from '@/lib/apiClient';
import type { Exercise, ExerciseFeedbackRating, UserExerciseFeedback } from '@/types/database';

export interface ExerciseFilters {
  search?: string;
  muscleGroup?: string;
  equipment?: string;
  difficulty?: string;
}

export async function fetchExercises(filters: ExerciseFilters = {}): Promise<Exercise[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.muscleGroup) params.set('muscle_group', filters.muscleGroup);
  if (filters.equipment) params.set('equipment', filters.equipment);
  if (filters.difficulty) params.set('difficulty', filters.difficulty);

  const query = params.toString();
  return apiClient.get<Exercise[]>(`/exercises${query ? `?${query}` : ''}`);
}

export async function fetchExerciseById(id: string): Promise<Exercise | null> {
  return apiClient.get<Exercise>(`/exercises/${id}`);
}

export async function fetchExerciseFeedbackMap(): Promise<Record<string, ExerciseFeedbackRating>> {
  const rows = await apiClient.get<UserExerciseFeedback[]>('/exercises/feedback/all');
  return Object.fromEntries(rows.map((row) => [row.exercise_id, row.rating]));
}

export async function setExerciseFeedback(
  exerciseId: string,
  rating: ExerciseFeedbackRating
): Promise<UserExerciseFeedback> {
  return apiClient.put<UserExerciseFeedback>(`/exercises/${exerciseId}/feedback`, { rating });
}

export async function fetchDistinctMuscleGroups(): Promise<string[]> {
  return apiClient.get<string[]>('/exercises/muscle-groups');
}

export async function fetchDistinctEquipment(): Promise<string[]> {
  return apiClient.get<string[]>('/exercises/equipment-options');
}
