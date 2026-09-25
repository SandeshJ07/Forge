import { apiClient } from '@/lib/apiClient';
import type { UserProfile } from '@/types/database';

export async function fetchUserProfile(): Promise<UserProfile> {
  return apiClient.get<UserProfile>('/profile');
}

export async function upsertUserProfile(
  fields: Partial<Omit<UserProfile, 'user_id' | 'anthropic_api_key_set' | 'gemini_api_key_set' | 'plan_preferences'>>
): Promise<UserProfile> {
  return apiClient.patch<UserProfile>('/profile', fields);
}

export async function completeOnboarding(): Promise<UserProfile> {
  return apiClient.post<UserProfile>('/profile/complete-onboarding');
}
