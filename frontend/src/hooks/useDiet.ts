import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDietAccess,
  fetchDietGenerationStatus,
  fetchLastDietPreferences,
  fetchLatestDietPlan,
  generateDietPlan,
} from '@/api/diet';
import type { DietPreferences } from '@/types/database';
import { useAuthStore } from '@/stores/useAuthStore';

const POLL_MS = 3000;

/** Whether the user has their own AI key (diet plans never use the server's shared key). */
export function useDietAccess() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['diet-access', userId],
    queryFn: fetchDietAccess,
    enabled: Boolean(userId),
    staleTime: 0,
  });
}

export function useLatestDietPlan() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['latest-diet-plan', userId],
    queryFn: fetchLatestDietPlan,
    enabled: Boolean(userId),
  });
}

export function useLastDietPreferences() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['diet-preferences', userId],
    queryFn: fetchLastDietPreferences,
    enabled: Boolean(userId),
  });
}

/** Polls while a diet plan is being generated, and refreshes the latest plan the moment it's ready. */
export function useDietGeneration() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['diet-generation', userId],
    queryFn: fetchDietGenerationStatus,
    enabled: Boolean(userId),
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.status === 'generating' ? POLL_MS : false),
    refetchIntervalInBackground: true,
  });

  const status = query.data?.status;
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === 'generating' && status === 'ready') {
      queryClient.invalidateQueries({ queryKey: ['latest-diet-plan', userId] });
    }
    previous.current = status;
  }, [status, queryClient, userId]);

  return query;
}

/** Starts a background generation. Only from an explicit button press — it's billed to the user's key. */
export function useGenerateDietPlan() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: DietPreferences) => generateDietPlan(preferences),
    onSuccess: (job) => {
      queryClient.setQueryData(['diet-generation', userId], {
        status: 'generating',
        plan_id: job.id,
        error: null,
        started_at: job.created_at,
      });
      queryClient.invalidateQueries({ queryKey: ['diet-generation', userId] });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['diet-preferences', userId] }),
  });
}
