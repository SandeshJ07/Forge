import { apiClient } from '@/lib/apiClient';
import type { DietAccess, DietGenerationStatus, DietPlan, DietPreferences } from '@/types/database';

/** Whether the user can make diet plans — they need their own Claude, Gemini or Groq key. */
export async function fetchDietAccess(): Promise<DietAccess> {
  return apiClient.get<DietAccess>('/diet-plans/access');
}

/**
 * Starts a background generation on the user's own AI key (202 with a
 * 'generating' row); poll fetchDietGenerationStatus(). Only call this from
 * an explicit button press — every call is billed to the user's key.
 */
export async function generateDietPlan(preferences: DietPreferences): Promise<DietPlan> {
  return apiClient.post<DietPlan>('/diet-plans/generate', { preferences });
}

export async function fetchDietGenerationStatus(): Promise<DietGenerationStatus> {
  return apiClient.get<DietGenerationStatus>('/diet-plans/generation');
}

/** The newest finished diet plan, or null. */
export async function fetchLatestDietPlan(): Promise<DietPlan | null> {
  return apiClient.get<DietPlan | null>('/diet-plans/latest');
}

/** The choices from the last request (even a failed one), to pre-fill the form. */
export async function fetchLastDietPreferences(): Promise<Partial<DietPreferences>> {
  return apiClient.get<Partial<DietPreferences>>('/diet-plans/last-preferences');
}
