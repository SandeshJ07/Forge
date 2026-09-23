import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLatestPlan, fetchPlanHistory, generatePlan, setPlanAccepted } from '@/api/plans';
import { useAuthStore } from '@/stores/useAuthStore';

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

/** Only call from an explicit "Generate" / "Regenerate" button press. */
export function useGeneratePlan() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generatePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['latest-plan', userId] });
      queryClient.invalidateQueries({ queryKey: ['plan-history', userId] });
    },
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
