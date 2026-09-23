import { apiClient } from '@/lib/apiClient';
import type { GeneratedPlan } from '@/types/database';

/**
 * Triggers POST /plans/generate on the backend, which summarizes recent
 * workout history + exercise feedback server-side and makes exactly one
 * Claude API call. Only invoke this from an explicit user action ("Generate
 * a plan" / "Regenerate") — never automatically or on a schedule, since it's
 * the one part of the stack with a real per-use cost.
 */
export async function generatePlan(): Promise<GeneratedPlan> {
  return apiClient.post<GeneratedPlan>('/plans/generate');
}

export async function fetchPlanHistory(): Promise<GeneratedPlan[]> {
  return apiClient.get<GeneratedPlan[]>('/plans');
}

export async function fetchLatestPlan(): Promise<GeneratedPlan | null> {
  return apiClient.get<GeneratedPlan | null>('/plans/latest');
}

export async function setPlanAccepted(planId: string, accepted: boolean): Promise<void> {
  await apiClient.patch(`/plans/${planId}`, { accepted });
}
