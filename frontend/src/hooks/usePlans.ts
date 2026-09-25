import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchGenerationStatus,
  fetchLatestPlan,
  fetchPlanHistory,
  fetchPlanUsage,
  generatePlan,
  setPlanAccepted,
} from '@/api/plans';
import type { PlanPreferences } from '@/types/database';
import { useAuthStore } from '@/stores/useAuthStore';

const POLL_MS = 3000;

export function useLatestPlan() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['latest-plan', userId],
    queryFn: fetchLatestPlan,
    enabled: Boolean(userId),
  });
}

export function usePlanHistory() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['plan-history', userId],
    queryFn: fetchPlanHistory,
    enabled: Boolean(userId),
  });
}

/** Today's generations on the shared AI key, and how many are left. */
export function usePlanUsage() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['plan-usage', userId],
    queryFn: fetchPlanUsage,
    enabled: Boolean(userId),
    staleTime: 0,
  });
}

/**
 * Status of the user's most recent plan generation. Generation runs on the
 * server in the background, so this polls while a job is in progress and
 * refreshes the plan queries the moment it finishes — whichever screen the
 * user happens to be on. Safe to call from several components (one shared query).
 */
export function usePlanGeneration() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['plan-generation', userId],
    queryFn: fetchGenerationStatus,
    enabled: Boolean(userId),
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.status === 'generating' ? POLL_MS : false),
    refetchIntervalInBackground: true,
  });

  const status = query.data?.status;
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === 'generating' && status === 'ready') {
      queryClient.invalidateQueries({ queryKey: ['latest-plan', userId] });
      queryClient.invalidateQueries({ queryKey: ['plan-history', userId] });
    }
    // A failed generation doesn't count toward the daily limit, so it gives the use back.
    if (previous.current === 'generating' && status === 'failed') {
      queryClient.invalidateQueries({ queryKey: ['plan-usage', userId] });
    }
    previous.current = status;
  }, [status, queryClient, userId]);

  return query;
}

/** Starts a background generation. Only call from an explicit "Create" / "Generate" button press. */
export function useGeneratePlan() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: PlanPreferences) => generatePlan(preferences),
    onSuccess: (job) => {
      // Flip everyone watching to "generating" immediately; polling takes over from here.
      queryClient.setQueryData(['plan-generation', userId], {
        status: 'generating',
        plan_id: job.id,
        error: null,
        started_at: job.created_at,
      });
      queryClient.invalidateQueries({ queryKey: ['plan-generation', userId] });
    },
    // Success uses one up; a 429 means the cached count was stale.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['plan-usage', userId] }),
  });
}

export function useSetPlanAccepted() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, accepted }: { planId: string; accepted: boolean }) =>
      setPlanAccepted(planId, accepted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['latest-plan', userId] });
      queryClient.invalidateQueries({ queryKey: ['plan-history', userId] });
    },
  });
}
