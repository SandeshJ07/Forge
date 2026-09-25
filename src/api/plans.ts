import { apiClient } from '@/lib/apiClient';
import type { GeneratedPlan, PlanGenerationStatus, PlanPreferences } from '@/types/database';

/**
 * Starts a background generation (POST /plans/generate → 202 with a
 * 'generating' placeholder); poll fetchGenerationStatus() for the result.
 * The backend summarizes recent
 * workout history + exercise feedback server-side and makes exactly one call
 * to the user's chosen AI provider, shaped by the optional preferences. Only invoke this from an explicit user action ("Generate
 * a plan" / "Regenerate") — never automatically or on a schedule, since it's
 * the one part of the stack with a real per-use cost.
 */
export async function generatePlan(preferences: PlanPreferences = {}): Promise<GeneratedPlan> {
  return apiClient.post<GeneratedPlan>('/plans/generate', { preferences });
}

export async function fetchGenerationStatus(): Promise<PlanGenerationStatus> {
  return apiClient.get<PlanGenerationStatus>('/plans/generation');
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
