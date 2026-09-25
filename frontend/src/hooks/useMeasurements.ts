import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMeasurement,
  deleteMeasurement,
  fetchDistinctMeasurementTypes,
  fetchMeasurements,
  fetchProgressPhotos,
  pickAndUploadProgressPhoto,
} from '@/api/measurements';
import type { MeasurementType } from '@/types/database';
import { useAuthStore } from '@/stores/useAuthStore';

export function useMeasurements(type?: MeasurementType) {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['measurements', userId, type],
    queryFn: () => fetchMeasurements(type),
    enabled: Boolean(userId),
  });
}

export function useMeasurementTypes() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['measurement-types', userId],
    queryFn: fetchDistinctMeasurementTypes,
    enabled: Boolean(userId),
  });
}

export function useAddMeasurement() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: MeasurementType; value: number; unit: string; date: string }) =>
      addMeasurement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements', userId] });
      queryClient.invalidateQueries({ queryKey: ['measurement-types', userId] });
    },
  });
}

export function useDeleteMeasurement() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMeasurement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements', userId] });
    },
  });
}

export function useProgressPhotos() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['progress-photos', userId],
    queryFn: fetchProgressPhotos,
    enabled: Boolean(userId),
  });
}

export function useAddProgressPhoto() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => pickAndUploadProgressPhoto(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-photos', userId] });
    },
  });
}
